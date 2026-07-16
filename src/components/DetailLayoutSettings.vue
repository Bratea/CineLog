<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { ChevronDown, ChevronUp, GripVertical, RotateCcw } from 'lucide-vue-next'
import type { DetailLayoutModule } from '../types'

const props = defineProps<{ modules: DetailLayoutModule[] }>()

const emit = defineEmits(['update:modules', 'reset'])
const dragId = ref('')
let holdTimer: number | undefined
let pendingHold: { x: number; y: number; pointerType: string; element: HTMLElement } | null = null

function cloneModules() {
  return props.modules.map((item) => ({ ...item }))
}

function moveModule(id, direction) {
  const modules = cloneModules()
  const from = modules.findIndex((item) => item.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= modules.length) return
  const [moved] = modules.splice(from, 1)
  modules.splice(to, 0, moved)
  emit('update:modules', modules)
}

function startHold(event: PointerEvent, id: string) {
  if (event.button != null && event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  clearTimeout(holdTimer)
  pendingHold = { x: event.clientX, y: event.clientY, pointerType: event.pointerType, element }
  element.setPointerCapture?.(event.pointerId)
  holdTimer = window.setTimeout(() => {
    if (!pendingHold) return
    dragId.value = id
    document.body.classList.add('category-drag-active')
    navigator.vibrate?.(18)
  }, event.pointerType === 'touch' ? 300 : 350)
}

function cancelPendingHold(event: PointerEvent) {
  if (!dragId.value && pendingHold) {
    const tolerance = pendingHold.pointerType === 'touch' ? 18 : 8
    if (Math.hypot(event.clientX - pendingHold.x, event.clientY - pendingHold.y) <= tolerance) return
    clearTimeout(holdTimer)
    pendingHold = null
  }
}

function moveHold(event: PointerEvent) {
  if (!dragId.value) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-layout-id]') as HTMLElement | null
  const targetId = target?.dataset.layoutId
  if (!targetId || targetId === dragId.value) return
  const modules = cloneModules()
  const from = modules.findIndex((item) => item.id === dragId.value)
  const to = modules.findIndex((item) => item.id === targetId)
  if (from < 0 || to < 0) return
  const [moved] = modules.splice(from, 1)
  modules.splice(to, 0, moved)
  emit('update:modules', modules)
}

function endHold(event?: PointerEvent) {
  clearTimeout(holdTimer)
  const element = pendingHold?.element
  if (element && event?.pointerId != null && element.hasPointerCapture?.(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }
  pendingHold = null
  dragId.value = ''
  document.body.classList.remove('category-drag-active')
}

onBeforeUnmount(() => {
  clearTimeout(holdTimer)
  document.body.classList.remove('category-drag-active')
})
</script>

<template>
  <section class="detail-layout-manager settings-piece" style="--settings-order: 1" @pointermove="moveHold" @pointerup="endHold" @pointercancel="endHold">
    <header class="detail-layout-intro">
      <div><strong>展示优先级</strong><span>排在越上面的模块，会在电影详情中越早出现</span></div>
      <button type="button" @click="emit('reset')"><RotateCcw :size="14" />恢复默认</button>
    </header>

    <div class="detail-layout-preview" aria-label="电影详情模块顺序预览">
      <i v-for="(item, index) in modules" :key="item.id" :class="`is-${item.tone}`" :title="item.label"><span>{{ index + 1 }}</span></i>
    </div>

    <div class="detail-layout-list">
      <article
        v-for="(item, index) in modules"
        :key="item.id"
        :data-layout-id="item.id"
        :class="{ dragging: dragId === item.id }"
        @pointerdown="startHold($event, item.id)"
        @pointermove="cancelPendingHold"
        @contextmenu.prevent
      >
        <span class="detail-layout-rank">{{ String(index + 1).padStart(2, '0') }}</span>
        <i class="detail-layout-grip"><GripVertical :size="17" /></i>
        <div><strong>{{ item.label }}</strong><small>{{ item.description }}</small></div>
        <nav aria-label="调整模块顺序">
          <button type="button" :disabled="index === 0" :aria-label="`${item.label}上移`" @pointerdown.stop @click="moveModule(item.id, -1)"><ChevronUp :size="14" /></button>
          <button type="button" :disabled="index === modules.length - 1" :aria-label="`${item.label}下移`" @pointerdown.stop @click="moveModule(item.id, 1)"><ChevronDown :size="14" /></button>
        </nav>
      </article>
    </div>

    <p class="detail-layout-hint"><GripVertical :size="14" />长按任意模块后拖动，也可以使用右侧按钮精确调整。</p>
  </section>
</template>
