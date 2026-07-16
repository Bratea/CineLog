<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircle2, CircleAlert, Database, HardDrive, RefreshCw, ShieldCheck, Table2 } from 'lucide-vue-next'
import { getDatabaseInfo } from '../services/localDatabase'

const info = ref(null)
const state = ref('loading')
const message = ref('')

const usageLabel = computed(() => formatBytes(info.value?.storageUsage))
const quotaLabel = computed(() => info.value?.storageQuota ? formatBytes(info.value.storageQuota) : '应用私有空间')
const updatedLabel = computed(() => info.value?.updatedAt
  ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(info.value.updatedAt)
  : '本次打开已确认')

function formatBytes(value) {
  const bytes = Number(value || 0)
  if (!bytes) return '少于 1 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function refreshDatabaseInfo() {
  state.value = 'loading'
  message.value = ''
  try {
    info.value = await getDatabaseInfo()
    state.value = 'ready'
  } catch (error) {
    state.value = 'error'
    message.value = error?.message || '无法读取本地数据库状态'
  }
}

onMounted(refreshDatabaseInfo)
</script>

<template>
  <section class="database-settings settings-piece" style="--settings-order: 1">
    <div v-if="state === 'loading'" class="database-loading"><RefreshCw :size="20" /><span>正在读取本地数据库…</span></div>

    <div v-else-if="state === 'error'" class="database-error">
      <CircleAlert :size="22" />
      <div><strong>数据库状态读取失败</strong><span>{{ message }}</span></div>
      <button type="button" @click="refreshDatabaseInfo">重新检查</button>
    </div>

    <template v-else>
      <header class="database-status-card">
        <i><Database :size="22" /></i>
        <div><span>当前数据库</span><strong>{{ info.engine }}</strong><small>{{ info.platform }}</small></div>
        <b><CheckCircle2 :size="13" />连接正常</b>
      </header>

      <div class="database-metrics">
        <article><span>电影记录</span><strong>{{ info.movieRecords }}</strong><small>条</small></article>
        <article><span>状态数据</span><strong>{{ info.stateEntries }}</strong><small>项</small></article>
        <article><span>本地占用</span><strong>{{ usageLabel }}</strong><small>已用</small></article>
      </div>

      <section class="database-detail-card">
        <header><div><strong>数据库信息</strong><span>仅展示安全的本地配置</span></div><button type="button" :class="{ spinning: state === 'loading' }" @click="refreshDatabaseInfo"><RefreshCw :size="14" />刷新</button></header>
        <dl>
          <div><dt><HardDrive :size="15" />数据库名称</dt><dd>{{ info.name }}</dd></div>
          <div><dt><Table2 :size="15" />{{ info.containerLabel }}</dt><dd>{{ info.containerName }}</dd></div>
          <div><dt><Database :size="15" />结构版本</dt><dd>Version {{ info.version }}</dd></div>
          <div><dt><ShieldCheck :size="15" />安全方式</dt><dd>{{ info.encryption }}</dd></div>
          <div><dt><HardDrive :size="15" />存储上限</dt><dd>{{ quotaLabel }}</dd></div>
          <div><dt><CheckCircle2 :size="15" />最后确认</dt><dd>{{ updatedLabel }}</dd></div>
        </dl>
      </section>

      <p class="database-note"><ShieldCheck :size="15" />数据库只保存在当前设备中，不会把连接密码或文件路径显示在页面上。</p>
    </template>
  </section>
</template>
