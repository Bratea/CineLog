<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, DatabaseBackup, FileSpreadsheet, FileText, Info, Share2 } from 'lucide-vue-next'
import { getDatabaseInfo, getDatabaseSnapshot } from '../services/localDatabase'
import type { Movie } from '../types'

const props = defineProps<{ movies: Movie[] }>()
const emit = defineEmits<{
  exported: [message: string]
  error: [message: string]
}>()

type ExportFieldId = 'title' | 'originalTitle' | 'watched' | 'year' | 'watchedDate' | 'rating' | 'genres' | 'review'

const fields: Array<{ id: ExportFieldId; label: string; column: string }> = [
  { id: 'title', label: '电影名字', column: '电影名字' },
  { id: 'originalTitle', label: '电影原名', column: '电影原名' },
  { id: 'watched', label: '观看状态', column: '观看状态' },
  { id: 'year', label: '上映年份', column: '上映年份' },
  { id: 'watchedDate', label: '观看日期', column: '观看日期' },
  { id: 'rating', label: '个人评分', column: '个人评分' },
  { id: 'genres', label: '电影分类', column: '电影分类' },
  { id: 'review', label: '观后感', column: '观后感' },
]

const selectedFields = ref<ExportFieldId[]>(['title'])
const exporting = ref<'txt' | 'excel' | 'database' | null>(null)
const selectedFieldDefinitions = computed(() => fields.filter((field) => selectedFields.value.includes(field.id)))

function toggleField(id: ExportFieldId) {
  if (selectedFields.value.includes(id)) {
    if (selectedFields.value.length === 1) return
    selectedFields.value = selectedFields.value.filter((field) => field !== id)
    return
  }
  selectedFields.value = [...selectedFields.value, id]
}

function genreLabel(movie: Movie) {
  return (movie.genres || [])
    .map((genre) => typeof genre === 'string' ? genre : genre.name)
    .filter(Boolean)
    .join('、')
}

function valueFor(movie: Movie, field: ExportFieldId): string | number {
  if (field === 'title') return movie.title || ''
  if (field === 'originalTitle') return movie.originalTitle || movie.original_title || ''
  if (field === 'watched') return movie.watched ? '已观看' : '未观看'
  if (field === 'year') return movie.year || movie.releaseDate?.slice(0, 4) || movie.release_date?.slice(0, 4) || ''
  if (field === 'watchedDate') return movie.watchedDate || movie.recordDate || ''
  if (field === 'rating') return movie.personalRating ?? movie.rating ?? ''
  if (field === 'genres') return genreLabel(movie)
  return movie.review || movie.feeling || ''
}

function exportRows() {
  return props.movies.map((movie) => Object.fromEntries(
    selectedFieldDefinitions.value.map((field) => [field.column, valueFor(movie, field.id)]),
  ))
}

function safeCell(value: unknown) {
  return String(value ?? '').replace(/\t/g, ' ').replace(/\r?\n/g, ' ')
}

function dateStamp() {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `${date}-${time}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportTxt() {
  if (!props.movies.length || exporting.value) return
  exporting.value = 'txt'
  try {
    const columns = selectedFieldDefinitions.value.map((field) => field.column)
    const lines = [
      columns.join('\t'),
      ...props.movies.map((movie) => selectedFieldDefinitions.value.map((field) => safeCell(valueFor(movie, field.id))).join('\t')),
    ]
    downloadBlob(new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/plain;charset=utf-8' }), `CineLog-片单-${dateStamp()}.txt`)
    emit('exported', `已导出 ${props.movies.length} 部电影的 TXT 片单`)
  } catch {
    emit('error', 'TXT 导出失败，请稍后再试')
  } finally {
    exporting.value = null
  }
}

async function exportExcel() {
  if (!props.movies.length || exporting.value) return
  exporting.value = 'excel'
  try {
    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.json_to_sheet(exportRows())
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CineLog片单')
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `CineLog-片单-${dateStamp()}.xlsx`,
    )
    emit('exported', `已导出 ${props.movies.length} 部电影的 Excel 片单`)
  } catch {
    emit('error', 'Excel 导出失败，请稍后再试')
  } finally {
    exporting.value = null
  }
}

async function exportDatabase() {
  if (exporting.value) return
  exporting.value = 'database'
  try {
    const [database, data] = await Promise.all([getDatabaseInfo(), getDatabaseSnapshot()])
    const backup = {
      format: 'CineLog database backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      database: {
        engine: database.engine,
        name: database.name,
        schemaVersion: database.version,
      },
      data,
    }
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }),
      `CineLog-数据库备份-${dateStamp()}.json`,
    )
    emit('exported', '完整数据库备份已导出')
  } catch {
    emit('error', '数据库导出失败，请稍后再试')
  } finally {
    exporting.value = null
  }
}
</script>

<template>
  <section class="share-data-settings settings-piece" style="--settings-order: 1">
    <header class="share-data-summary">
      <i><Share2 :size="22" /></i>
      <div><span>可分享的观影记录</span><strong>{{ movies.length }} 部电影</strong><small>文件只在当前设备生成</small></div>
    </header>

    <section class="share-export-card">
      <header><strong>导出片单</strong><span>选择格式后会保存到设备</span></header>
      <div class="share-export-actions">
        <button type="button" :disabled="!movies.length || !!exporting" @click="exportTxt">
          <i><FileText :size="21" /></i>
          <span><strong>{{ exporting === 'txt' ? '正在导出…' : '导出到 TXT' }}</strong><small>轻量文本，方便直接分享</small></span>
        </button>
        <button type="button" :disabled="!movies.length || !!exporting" @click="exportExcel">
          <i><FileSpreadsheet :size="21" /></i>
          <span><strong>{{ exporting === 'excel' ? '正在导出…' : '导出到 Excel' }}</strong><small>表格格式，方便整理筛选</small></span>
        </button>
      </div>
      <p v-if="!movies.length" class="share-empty-hint"><Info :size="14" />片库还没有电影，添加记录后即可导出片单。</p>
    </section>

    <section class="share-field-card">
      <header><strong>片单包含内容</strong><span>默认只导出电影名字</span></header>
      <div class="share-field-options" role="group" aria-label="选择片单导出字段">
        <button
          v-for="field in fields"
          :key="field.id"
          type="button"
          :class="{ selected: selectedFields.includes(field.id) }"
          :aria-pressed="selectedFields.includes(field.id)"
          @click="toggleField(field.id)"
        ><i><Check :size="12" /></i>{{ field.label }}</button>
      </div>
      <small>至少保留一项；TXT 和 Excel 会使用相同的内容选择。</small>
    </section>

    <section class="database-export-card">
      <div><i><DatabaseBackup :size="20" /></i><span><strong>按数据库导出</strong><small>完整备份全部本地记录和字段，不受上方选择影响。</small></span></div>
      <button type="button" :disabled="!!exporting" @click="exportDatabase">{{ exporting === 'database' ? '正在备份…' : '导出数据库' }}</button>
    </section>

    <p class="share-data-note"><Info :size="14" />数据库备份使用 JSON 格式，适合留存完整数据；片单分享请优先使用 TXT 或 Excel。</p>
  </section>
</template>
