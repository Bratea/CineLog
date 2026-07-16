<script setup lang="ts">
import { Check, Info, TriangleAlert, X } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  tone: { type: String, default: 'success' },
  placement: { type: String, default: 'library' },
  duration: { type: Number, default: 2600 },
  closable: { type: Boolean, default: false },
})
defineEmits(['close'])

const icons = { success: Check, warning: TriangleAlert, info: Info }
</script>

<template>
  <aside
    class="app-notice"
    :class="[`is-${tone}`, `app-notice--${placement}`]"
    :style="{ '--notice-duration': `${duration}ms` }"
    role="status"
    aria-live="polite"
  >
    <span class="app-notice__icon"><component :is="icons[tone] || Info" :size="15" /></span>
    <div class="app-notice__copy"><strong>{{ title }}</strong><p v-if="message">{{ message }}</p></div>
    <button v-if="closable" class="app-notice__close" aria-label="关闭提示" @click="$emit('close')"><X :size="13" /></button>
  </aside>
</template>

<style scoped>
@property --notice-progress { syntax:'<number>'; inherits:false; initial-value:0; }
.app-notice{--notice-color:#4b9a70;position:absolute;z-index:45;isolation:isolate;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:62px;padding:9px 9px 9px 10px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--notice-color) 24%,transparent);border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 15px 35px rgba(20,26,24,.2);backdrop-filter:blur(20px) saturate(1.25);animation:notice-in .46s cubic-bezier(.16,1,.3,1) both}
.app-notice::before{content:'';position:absolute;z-index:2;inset:-1px;padding:2px;border-radius:inherit;background:conic-gradient(from -90deg,var(--notice-color) calc(var(--notice-progress) * 1turn),rgba(210,214,217,.3) 0);pointer-events:none;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:notice-progress var(--notice-duration) linear forwards}
.app-notice.is-warning{--notice-color:#d29b34}.app-notice.is-info{--notice-color:#5a89bd}
.app-notice--library,.app-notice--home{top:72px;right:20px;width:210px}.app-notice--record{top:76px;right:58px;width:min(230px,calc(100% - 76px))}.app-notice--detail{top:82px;right:18px;width:230px;color:#fff;background:rgba(18,23,24,.9);border-color:color-mix(in srgb,var(--notice-color) 45%,rgba(255,255,255,.15));box-shadow:0 18px 38px rgba(0,0,0,.32)}
.app-notice__icon{display:grid;place-items:center;width:30px;height:30px;color:#fff;border-radius:50%;background:var(--notice-color);box-shadow:0 6px 13px color-mix(in srgb,var(--notice-color) 30%,transparent)}
.app-notice__copy{min-width:0;display:grid;gap:3px}.app-notice strong{color:#272a2d;font-size:10px}.app-notice p{overflow:hidden;margin:0;color:#7e8186;font-size:8px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}.app-notice--detail strong{color:#fff8ef}.app-notice--detail p{color:rgba(255,255,255,.6)}
.app-notice__close{display:grid;place-items:center;width:24px;height:24px;padding:0;color:#91949a;border:0;background:transparent}.app-notice--detail .app-notice__close{color:rgba(255,255,255,.58)}
@keyframes notice-in{from{opacity:0;transform:translate3d(20px,-8px,0) scale(.92)}to{opacity:1;transform:none}}@keyframes notice-progress{from{--notice-progress:0}to{--notice-progress:1}}
@media(prefers-reduced-motion:reduce){.app-notice,.app-notice::before{animation:none}}
</style>
