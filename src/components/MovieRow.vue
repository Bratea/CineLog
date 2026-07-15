<script setup>
import { Check, Circle, Ellipsis, Star } from 'lucide-vue-next'

defineProps({
  movie: { type: Object, required: true },
})
</script>

<template>
  <article class="movie-row" tabindex="0">
    <div class="poster" :class="`poster--${movie.poster}`" aria-hidden="true">
      <span class="poster-title">{{ movie.posterText }}</span>
      <span class="poster-light"></span>
    </div>

    <div class="movie-copy">
      <div class="movie-title-line">
        <h3>{{ movie.title }}</h3>
        <button aria-label="更多操作"><Ellipsis :size="22" stroke-width="2.8" /></button>
      </div>
      <p>{{ movie.originalTitle }}</p>
      <p class="meta">{{ movie.meta }} · {{ movie.year }}</p>
      <div class="movie-footer">
        <span class="rating"><Star :size="17" fill="currentColor" stroke-width="0" />{{ movie.rating }}</span>
        <span class="watch-status" :class="{ wanted: !movie.watched }">
          <Check v-if="movie.watched" :size="13" stroke-width="3" />
          <Circle v-else :size="17" stroke-width="2" />
          {{ movie.watched ? '已看过' : '想看' }}
        </span>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
.movie-row { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 16px; min-height: 123px; padding: 0 0 18px; margin-bottom: 18px; border-bottom: 1px solid #ececed; outline: none; transition: transform .18s ease; }
.movie-row:focus-visible { border-radius: 14px; outline: 2px solid #222; outline-offset: 4px; }
.movie-row:hover { transform: translateX(2px); }
.poster { position: relative; overflow: hidden; display: flex; align-items: end; min-height: 116px; padding: 8px; border-radius: 13px; color: #fff; isolation: isolate; box-shadow: inset 0 0 0 1px rgba(255,255,255,.17), 0 9px 15px rgba(0,0,0,.14); }
.poster::before { content: ''; position: absolute; z-index: -1; inset: 0; background: inherit; }
.poster::after { content: ''; position: absolute; z-index: -1; inset: 48% 0 0; background: linear-gradient(transparent, rgba(0, 0, 0, .76)); }
.poster-title { font-size: 10px; font-weight: 800; line-height: 1.08; letter-spacing: -.05em; text-transform: uppercase; }
.poster-light { position: absolute; top: -18px; right: -21px; width: 73px; height: 73px; border-radius: 50%; background: rgba(255,255,255,.52); filter: blur(8px); }
.poster--pop { background: radial-gradient(circle at 32% 20%, #eaa2ea 0 12%, transparent 13%), linear-gradient(145deg, #03265c, #88214f 55%, #f8b463); }
.poster--demon { background: radial-gradient(circle at 70% 10%, #e48d3a 0 7%, transparent 8%), repeating-linear-gradient(148deg, transparent 0 10px, rgba(0,0,0,.18) 11px 13px), linear-gradient(155deg, #201108, #9a3d0b 58%, #112a3d); }
.poster--crayon { background: radial-gradient(circle at 50% 24%, #f0d319 0 16%, transparent 17%), linear-gradient(150deg, #0d8ebf, #f2d12b 48%, #ef4e1a); }
.poster--coco { background: radial-gradient(circle at 67% 24%, #f5d75d 0 12%, transparent 13%), linear-gradient(145deg, #203c82, #67367c 50%, #e67b37); }
.movie-copy { min-width: 0; display: flex; flex-direction: column; padding: 3px 0 1px; }
.movie-title-line { display: flex; align-items: start; justify-content: space-between; gap: 7px; }
h3 { margin: 0; color: #171719; font-size: 16px; line-height: 1.35; letter-spacing: -.045em; }
.movie-title-line button { display: grid; place-items: center; flex: none; width: 26px; height: 26px; margin-top: -4px; padding: 0; color: #202024; background: transparent; border: 0; }
p { margin: 5px 0 0; overflow: hidden; color: #898a8f; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.meta { color: #77787d; }
.movie-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; }
.rating, .watch-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; }
.rating { color: #252528; font-weight: 650; }
.rating svg { color: #f2b200; }
.watch-status { color: #6f7075; }
.watch-status svg:first-child { display: grid; place-items: center; box-sizing: content-box; padding: 3px; border-radius: 50%; color: #fff; background: #1d1d20; }
.watch-status.wanted { color: #77787c; }
.watch-status.wanted svg { color: #1d1d20; }
</style>
