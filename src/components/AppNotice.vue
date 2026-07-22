<script setup lang="ts">
import { Check, Info, TriangleAlert, X } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  tone: { type: String, default: 'success' },
  placement: { type: String, default: 'library' },
  motion: { type: String, default: 'medium' },
  duration: { type: Number, default: 2600 },
  closable: { type: Boolean, default: false },
  stackIndex: { type: Number, default: 0 },
})
defineEmits(['close'])

const icons = { success: Check, warning: TriangleAlert, info: Info }
</script>

<template>
  <aside
    class="app-notice"
    :class="[`is-${tone}`, `app-notice--${placement}`, `app-notice--motion-${motion}`]"
    :style="{ '--notice-duration': `${duration}ms`, '--notice-stack-index': stackIndex, zIndex: 145 - stackIndex }"
    role="status"
    aria-live="polite"
    :aria-label="`${title}，点击关闭提示`"
    @click="$emit('close')"
  >
    <span class="app-notice__icon"><component :is="icons[tone] || Info" :size="15" /></span>
    <div class="app-notice__copy"><strong>{{ title }}</strong><p v-if="message">{{ message }}</p></div>
    <button v-if="closable" class="app-notice__close" aria-label="关闭提示" @click.stop="$emit('close')"><X :size="13" /></button>
  </aside>
</template>

<style scoped>
@property --notice-progress { syntax:'<number>'; inherits:false; initial-value:0; }
.app-notice{--notice-color:#4b9a70;position:absolute;z-index:145;isolation:isolate;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:62px;margin-top:calc(var(--notice-stack-index,0) * 13px);padding:9px 9px 9px 10px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--notice-color) 24%,transparent);border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 15px 35px rgba(20,26,24,.2);backdrop-filter:blur(20px) saturate(1.25);cursor:pointer;pointer-events:auto}
.app-notice::before{content:'';position:absolute;z-index:2;inset:-1px;padding:2px;border-radius:inherit;background:conic-gradient(from -90deg,var(--notice-color) calc(var(--notice-progress) * 1turn),rgba(210,214,217,.3) 0);pointer-events:none;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:notice-progress var(--notice-duration) linear forwards}
.app-notice.is-warning{--notice-color:#d29b34}.app-notice.is-info{--notice-color:#5a89bd}
.app-notice--library,.app-notice--home{top:max(60px,calc(env(safe-area-inset-top) + 46px));right:max(12px,env(safe-area-inset-right));width:210px}.app-notice--record{top:max(64px,calc(env(safe-area-inset-top) + 50px));right:max(12px,env(safe-area-inset-right));width:min(230px,calc(100vw - 24px))}.app-notice--settings{top:max(60px,calc(env(safe-area-inset-top) + 46px));right:max(10px,env(safe-area-inset-right));width:210px}.app-notice--detail{top:max(70px,calc(env(safe-area-inset-top) + 54px));right:max(10px,env(safe-area-inset-right));width:230px;color:#fff;background:rgba(18,23,24,.9);border-color:color-mix(in srgb,var(--notice-color) 45%,rgba(255,255,255,.15));box-shadow:0 18px 38px rgba(0,0,0,.32)}
.app-notice__icon{display:grid;place-items:center;width:30px;height:30px;color:#fff;border-radius:50%;background:var(--notice-color);box-shadow:0 6px 13px color-mix(in srgb,var(--notice-color) 30%,transparent)}
.app-notice__copy{min-width:0;display:grid;gap:3px}.app-notice strong{color:#272a2d;font-size:10px}.app-notice p{overflow:hidden;margin:0;color:#7e8186;font-size:8px;line-height:1.35;text-overflow:ellipsis;white-space:nowrap}.app-notice--detail strong{color:#fff8ef}.app-notice--detail p{color:rgba(255,255,255,.6)}
.app-notice__close{display:grid;place-items:center;width:24px;height:24px;padding:0;color:#91949a;border:0;background:transparent}.app-notice--detail .app-notice__close{color:rgba(255,255,255,.58)}
.app-notice--motion-high{transform-origin:86% -24px;animation:notice-gravity-drop .72s cubic-bezier(.16,1,.3,1) both}.app-notice--motion-medium{animation:notice-side-in .48s cubic-bezier(.16,1,.3,1) both}.app-notice--motion-low{animation:notice-low-in .2s ease-out both}
.notice-stack-move{transition:margin-top .28s cubic-bezier(.16,1,.3,1)}
.app-notice--motion-high.notice-stack-leave-active{animation:none;transition:opacity .18s ease,transform .24s cubic-bezier(.4,0,1,1),filter .18s ease}.app-notice--motion-high.notice-stack-leave-to{opacity:0;filter:blur(1px);transform:translate3d(8px,-12px,0) scale(.97)}.app-notice--motion-medium.notice-stack-leave-active{animation:none;transition:opacity .15s ease,transform .2s ease}.app-notice--motion-medium.notice-stack-leave-to{opacity:0;transform:translateX(18px) scale(.98)}.app-notice--motion-low.notice-stack-leave-active{animation:none;transition:opacity .1s ease}.app-notice--motion-low.notice-stack-leave-to{opacity:0}
@keyframes notice-gravity-drop{0%{opacity:0;transform:translate3d(24px,-76px,0) rotate(4deg) scale(.88);filter:blur(3px)}58%{opacity:1;transform:translate3d(-5px,7px,0) rotate(-.8deg) scale(1.025);filter:blur(0)}78%{transform:translate3d(2px,-2px,0) rotate(.25deg) scale(.995)}100%{opacity:1;transform:none;filter:blur(0)}}@keyframes notice-side-in{from{opacity:0;transform:translate3d(38px,0,0) scale(.96)}to{opacity:1;transform:none}}@keyframes notice-low-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}@keyframes notice-progress{from{--notice-progress:0}to{--notice-progress:1}}
@media(prefers-reduced-motion:reduce){.app-notice,.app-notice::before{animation:none}}
</style>
