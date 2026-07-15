<script setup>
import { X } from 'lucide-vue-next'

defineProps({
  src: { type: String, required: true },
  alt: { type: String, default: '图片预览' },
  title: { type: String, default: '图片预览' },
  fit: { type: String, default: 'contain' },
})
defineEmits(['close'])
</script>

<template>
  <div class="image-viewer-backdrop" role="dialog" aria-modal="true" :aria-label="title" @click.self="$emit('close')">
    <section class="image-viewer-window">
      <header>
        <div class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
        <span>{{ title }}</span>
        <button aria-label="关闭图片查看器" @click="$emit('close')"><X :size="17" /></button>
      </header>
      <div class="image-viewer-stage"><img :src="src" :alt="alt" :style="{ objectFit: fit }" /></div>
    </section>
  </div>
</template>

<style scoped>
.image-viewer-backdrop{position:absolute;z-index:30;inset:0;display:grid;place-items:center;padding:18px;background:rgba(2,7,8,.68);backdrop-filter:blur(15px) saturate(.9);animation:viewer-fade .24s ease both}
.image-viewer-window{width:100%;overflow:hidden;border:1px solid rgba(255,255,255,.24);border-radius:23px;background:rgba(12,18,19,.9);box-shadow:0 30px 70px rgba(0,0,0,.52);animation:viewer-pop .48s cubic-bezier(.16,1,.3,1) both}
.image-viewer-window header{display:grid;grid-template-columns:72px minmax(0,1fr) 34px;align-items:center;height:48px;padding:0 10px 0 14px;border-bottom:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.025));backdrop-filter:blur(20px)}
.traffic-lights{display:flex;gap:7px}.traffic-lights i{width:10px;height:10px;border-radius:50%;background:#ff5f57;box-shadow:inset 0 -1px 1px rgba(0,0,0,.2)}.traffic-lights i:nth-child(2){background:#febc2e}.traffic-lights i:nth-child(3){background:#28c840}
.image-viewer-window header>span{overflow:hidden;color:rgba(255,255,255,.68);font-size:9px;text-align:center;text-overflow:ellipsis;white-space:nowrap}.image-viewer-window header button{display:grid;place-items:center;width:32px;height:32px;padding:0;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(255,255,255,.07)}
.image-viewer-stage{display:grid;place-items:center;height:min(620px,72vh);padding:12px;box-sizing:border-box;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.07),transparent 58%),#07100f}.image-viewer-stage img{display:block;max-width:100%;max-height:100%;border-radius:13px;box-shadow:0 15px 34px rgba(0,0,0,.35)}
@keyframes viewer-fade{from{opacity:0}to{opacity:1}}@keyframes viewer-pop{from{opacity:0;filter:blur(8px);transform:translateY(24px) scale(.92)}to{opacity:1;filter:none;transform:none}}
@media(prefers-reduced-motion:reduce){.image-viewer-backdrop,.image-viewer-window{animation:none}}
</style>
