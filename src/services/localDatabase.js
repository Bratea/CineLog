import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

const DATABASE_NAME = 'cinelog'
const DATABASE_VERSION = 1
const STORE_NAME = 'app-state'

let webDatabasePromise
let nativeDatabasePromise

function openWebDatabase() {
  if (webDatabasePromise) return webDatabasePromise

  webDatabasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('cinelog-local', DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('本地数据库升级被其他页面阻止'))
  })

  return webDatabasePromise
}

async function runWebTransaction(mode, operation) {
  const database = await openWebDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode)
    const store = transaction.objectStore(STORE_NAME)
    const request = operation(store)

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

async function openNativeDatabase() {
  if (nativeDatabasePromise) return nativeDatabasePromise

  nativeDatabasePromise = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const consistency = await sqlite.checkConnectionsConsistency()
    const existing = await sqlite.isConnection(DATABASE_NAME, false)
    const connection = consistency.result && existing.result
      ? await sqlite.retrieveConnection(DATABASE_NAME, false)
      : await sqlite.createConnection(DATABASE_NAME, false, 'no-encryption', DATABASE_VERSION, false)

    const isOpen = await connection.isDBOpen()
    if (!isOpen.result) await connection.open()
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
    return connection
  })()

  return nativeDatabasePromise
}

export function isNativeDatabase() {
  return Capacitor.isNativePlatform()
}

export async function getLocalValue(key) {
  if (!isNativeDatabase()) {
    return runWebTransaction('readonly', (store) => store.get(key))
  }

  const database = await openNativeDatabase()
  const result = await database.query('SELECT value FROM app_state WHERE key = ? LIMIT 1', [key])
  const rawValue = result.values?.[0]?.value
  if (typeof rawValue === 'string') return JSON.parse(rawValue)

  // First native launch: move the previous WebView IndexedDB value into SQLite.
  const legacyValue = await runWebTransaction('readonly', (store) => store.get(key))
  if (legacyValue !== undefined) {
    await database.run(
      'INSERT OR REPLACE INTO app_state (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(legacyValue), Date.now()],
    )
  }
  return legacyValue
}

export async function setLocalValue(key, value) {
  if (!isNativeDatabase()) {
    return runWebTransaction('readwrite', (store) => store.put(value, key))
  }

  const database = await openNativeDatabase()
  await database.run(
    `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), Date.now()],
  )
}

export async function getDatabaseInfo() {
  if (!isNativeDatabase()) {
    const database = await openWebDatabase()
    const stateEntries = await runWebTransaction('readonly', (store) => store.count())
    const movieRecords = await runWebTransaction('readonly', (store) => store.get('movie-records'))
    const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null
    return {
      status: database ? 'connected' : 'error',
      platform: '网页本地数据库',
      engine: 'IndexedDB',
      name: 'cinelog-local',
      version: DATABASE_VERSION,
      containerLabel: '对象仓库',
      containerName: STORE_NAME,
      encryption: '浏览器沙盒保护',
      stateEntries: Number(stateEntries || 0),
      movieRecords: Array.isArray(movieRecords) ? movieRecords.length : 0,
      updatedAt: null,
      storageUsage: Number(estimate?.usage || 0),
      storageQuota: Number(estimate?.quota || 0),
    }
  }

  const database = await openNativeDatabase()
  const summary = await database.query('SELECT COUNT(*) AS count, MAX(updated_at) AS updated_at FROM app_state')
  const records = await database.query('SELECT value FROM app_state WHERE key = ? LIMIT 1', ['movie-records'])
  const pageCount = await database.query('PRAGMA page_count')
  const pageSize = await database.query('PRAGMA page_size')
  const rawRecords = records.values?.[0]?.value
  let movieRecords = []
  try {
    movieRecords = typeof rawRecords === 'string' ? JSON.parse(rawRecords) : []
  } catch {
    movieRecords = []
  }

  return {
    status: 'connected',
    platform: 'Android 本地数据库',
    engine: 'SQLite',
    name: DATABASE_NAME,
    version: DATABASE_VERSION,
    containerLabel: '数据表',
    containerName: 'app_state',
    encryption: '未加密，仅应用私有目录可访问',
    stateEntries: Number(summary.values?.[0]?.count || 0),
    movieRecords: Array.isArray(movieRecords) ? movieRecords.length : 0,
    updatedAt: Number(summary.values?.[0]?.updated_at || 0) || null,
    storageUsage: Number(pageCount.values?.[0]?.page_count || 0) * Number(pageSize.values?.[0]?.page_size || 0),
    storageQuota: 0,
  }
}
