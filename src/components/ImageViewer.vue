<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft, ChevronRight, X } from 'lucide-vue-next'

type ViewerImage = { src: string; title?: string; alt?: string; fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down' }
const props = withDefaults(defineProps<{ src: string; alt?: string; title?: string; fit?: ViewerImage['fit']; images?: ViewerImage[]; initialIndex?: number }>(), {
  alt: '图片预览', title: '图片预览', fit: 'contain', images: () => [], initialIndex: 0,
})
defineEmits(['close'])
const activeIndex = ref(Math.max(0, props.initialIndex))
const pointerStart = ref<number | null>(null)
const items = computed<ViewerImage[]>(() => props.images.length ? props.images : [{ src: props.src, title: props.title, alt: props.alt, fit: props.fit }])
const activeImage = computed(() => items.value[Math.min(activeIndex.value, items.value.length - 1)] || items.value[0])
function move(direction: number) { activeIndex.value = (activeIndex.value + direction + items.value.length) % items.value.length }
function pointerDown(event: PointerEvent) { pointerStart.value = event.clientX; (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId) }
function pointerUp(event: PointerEvent) { if (pointerStart.value == null) return; const delta = event.clientX - pointerStart.value; pointerStart.value = null; if (Math.abs(delta) > 42 && items.value.length > 1) move(delta < 0 ? 1 : -1) }
</script>

<template>
  <div class="image-viewer-backdrop" role="dialog" aria-modal="true" :aria-label="activeImage.title || title" @click.self="$emit('close')">
    <section class="image-viewer-window">
      <header><div class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div><span>{{ activeImage.title || title }}</span><button aria-label="关闭图片查看器" @click="$emit('close')"><X :size="17" /></button></header>
      <div class="image-viewer-stage" @pointerdown="pointerDown" @pointerup="pointerUp" @pointercancel="pointerStart = null" @contextmenu.prevent>
        <div v-if="items.length > 1" class="image-viewer-indicator">{{ activeIndex + 1 }} / {{ items.length }}</div>
        <button v-if="items.length > 1" class="image-viewer-arrow is-left" aria-label="上一张" @pointerdown.stop @click="move(-1)"><ChevronLeft :size="20" /></button>
        <img :key="activeImage.src" :src="activeImage.src" :alt="activeImage.alt || alt" :style="{ objectFit: activeImage.fit || fit }" draggable="false" />
        <button v-if="items.length > 1" class="image-viewer-arrow is-right" aria-label="下一张" @pointerdown.stop @click="move(1)"><ChevronRight :size="20" /></button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.image-viewer-backdrop{position:absolute;z-index:30;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,8,.68);backdrop-filter:blur(15px) saturate(.9);animation:viewer-fade .24s ease both}.image-viewer-window{width:100%;overflow:hidden;border:1px solid rgba(255,255,255,.24);border-radius:23px;background:rgba(12,18,19,.9);box-shadow:0 30px 70px rgba(0,0,0,.52);animation:viewer-pop .42s cubic-bezier(.16,1,.3,1) both}.image-viewer-window header{display:grid;grid-template-columns:72px minmax(0,1fr) 34px;align-items:center;height:48px;padding:0 10px 0 14px;border-bottom:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.05)}.traffic-lights{display:flex;gap:7px}.traffic-lights i{width:10px;height:10px;border-radius:50%;background:#ff5f57}.traffic-lights i:nth-child(2){background:#febc2e}.traffic-lights i:nth-child(3){background:#28c840}.image-viewer-window header>span{overflow:hidden;color:rgba(255,255,255,.68);font-size:9px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.image-viewer-window header button{display:grid;place-items:center;width:32px;height:32px;padding:0;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(255,255,255,.07)}.image-viewer-stage{position:relative;display:grid;place-items:center;height:min(620px,72vh);padding:12px;box-sizing:border-box;background:#07100f;touch-action:pan-y}.image-viewer-stage img{display:block;max-width:100%;max-height:100%;border-radius:13px;box-shadow:0 15px 34px rgba(0,0,0,.35);user-select:none;animation:image-change .22s ease}.image-viewer-indicator{position:absolute;z-index:3;top:12px;left:50%;padding:5px 9px;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:999px;background:rgba(3,8,9,.62);font-size:9px;transform:translateX(-50%)}.image-viewer-arrow{position:absolute;z-index:3;top:50%;display:grid;place-items:center;width:36px;height:36px;padding:0;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(3,8,9,.58);transform:translateY(-50%)}.image-viewer-arrow.is-left{left:10px}.image-viewer-arrow.is-right{right:10px}@keyframes viewer-fade{from{opacity:0}}@keyframes viewer-pop{from{opacity:0;transform:translateY(18px) scale(.94)}}@keyframes image-change{from{opacity:.45;transform:scale(.985)}}@media(prefers-reduced-motion:reduce){.image-viewer-backdrop,.image-viewer-window,.image-viewer-stage img{animation:none}}
</style>
