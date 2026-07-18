<script setup lang="ts">
import { computed } from 'vue'
import AppNotice from './AppNotice.vue'

type NoticeItem = { id: number; title: string; message?: string; tone?: string; type?: string }
const props = withDefaults(defineProps<{
  notices: NoticeItem[]
  placement?: string
  motion?: string
  duration?: number
  closable?: boolean
}>(), { placement: 'home', motion: 'medium', duration: 2600, closable: false })
const emit = defineEmits<{ dismiss: [id: number] }>()
const visibleNotices = computed(() => props.notices.slice(0, props.motion === 'high' ? 5 : 3))
</script>

<template>
  <TransitionGroup name="notice-stack">
    <AppNotice
      v-for="(notice, index) in visibleNotices"
      :key="notice.id"
      :title="notice.title"
      :message="notice.message"
      :tone="notice.tone || notice.type || 'info'"
      :placement="placement"
      :motion="motion"
      :duration="duration"
      :closable="closable"
      :stack-index="index"
      @close="emit('dismiss', notice.id)"
    />
  </TransitionGroup>
</template>
