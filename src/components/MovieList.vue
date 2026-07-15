<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { ChevronRight, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

defineProps({ movies: { type: Array, required: true } })
const emit = defineEmits(['open-detail', 'mark-watched'])
const armedId = ref(null)
const completingId = ref(null)
let confirmTimer

function openRow(movie, event) {
  emit('open-detail', { movie, source: event.currentTarget })
}

function posterStyle(movie) {
  const path = movie.backdropUrl || movie.posterUrl || movie.backdrop_path || movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
    return { backgroundImage: `url(${src})` }
  }
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : {}
}

function confirmWatched(movie) {
  if (armedId.value !== movie.id) {
    armedId.value = movie.id
    window.clearTimeout(confirmTimer)
    confirmTimer = window.setTimeout(() => { armedId.value = null }, 2400)
    return
  }
  armedId.value = null
  completingId.value = movie.id
  window.setTimeout(() => {
    emit('mark-watched', movie.id)
    completingId.value = null
  }, 920)
}

onBeforeUnmount(() => window.clearTimeout(confirmTimer))
</script>

<template>
  <div class="movie-list" aria-label="电影列表视图">
    <article v-for="(movie, index) in movies" :key="movie.id" class="movie-list-item" :style="{ '--row-order': index }" role="button" tabindex="0" :aria-label="`查看${movie.title}详情`" @click="openRow(movie, $event)" @keydown.enter.prevent="openRow(movie, $event)">
      <div class="movie-list-poster" :class="`movie-list-poster--${movie.poster}`" :style="posterStyle(movie)"></div>
      <div class="movie-list-copy">
        <p>{{ movie.meta }} · {{ movie.year }}</p>
        <h3>{{ movie.title }}</h3>
        <div>
          <span :class="{ unrated: movie.rating === null }"><Star :size="12" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '未评分' }}</span>
        </div>
      </div>
      <span v-if="movie.watched" class="movie-list-arrow" aria-hidden="true"><ChevronRight :size="18" /></span>
      <button v-else class="watch-ring" :class="{ armed: armedId === movie.id, completing: completingId === movie.id }" :aria-label="armedId === movie.id ? `再次确认将${movie.title}标记为已观看` : `将${movie.title}标记为已观看`" @click.stop="confirmWatched(movie)">
        <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-track" cx="18" cy="18" r="14"/><circle class="ring-progress" cx="18" cy="18" r="14"/><path class="ring-check" d="m11.5 18.2 4.2 4.1 8.8-9"/></svg><span v-if="armedId === movie.id" class="confirm-dot">!</span>
      </button>
    </article>
    <p v-if="!movies.length" class="movie-list-empty">这里还没有电影。</p>
  </div>
</template>

<style lang="scss" scoped>
.movie-list { display: grid; gap: 8px; max-height: 342px; padding: 0 22px 8px; overflow-y: auto; scrollbar-width: none; }
.movie-list::-webkit-scrollbar { display: none; }
.movie-list-item { display: grid; grid-template-columns: 58px 1fr 34px; align-items: center; gap: 11px; min-height: 74px; padding: 8px 10px; border: 1px solid #e5e6e8; border-radius: 19px; outline:0; background:rgba(255,255,255,.94); box-shadow:0 6px 16px rgba(18,19,22,.055); backdrop-filter:blur(16px) saturate(1.08); cursor:pointer; transition: transform .42s cubic-bezier(.16,1,.3,1), box-shadow .35s ease; animation: row-in .86s cubic-bezier(.22,.7,.2,1) both; animation-delay:calc(var(--row-order,0) * 72ms); }
.movie-list-item:hover { transform: translateY(-1px) scale(1.012); box-shadow: 0 9px 19px rgba(18,19,22,.07); }
.movie-list-poster { width: 58px; height: 58px; border-radius: 14px; background-size: cover; background-position: center; }
.movie-list-poster--pop { background: radial-gradient(circle at 60% 20%, #ffcc74 0 9%, transparent 10%), linear-gradient(155deg, #4bb5cd, #1c4e80 50%, #061425); }
.movie-list-poster--crayon { background: radial-gradient(circle at 25% 20%, #ffde68 0 14%, transparent 15%), linear-gradient(155deg, #61c1de, #eca55c 51%, #b33730); }
.movie-list-poster--coco { background: radial-gradient(circle at 63% 19%, #ffda6b 0 12%, transparent 13%), linear-gradient(150deg, #3a61ad, #8b4074 56%, #f29b53); }
.movie-list-copy { min-width: 0; }
.movie-list-copy p { color: #8f9095; font-size: 8px; font-weight: 600; }
.movie-list-copy h3 { margin: 3px 0 5px; overflow: hidden; font-size: 13px; line-height: 1.25; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
.movie-list-copy > div { display: flex; gap: 10px; }
.movie-list-copy span { display: inline-flex; align-items: center; gap: 3px; color: #515258; font-size: 9px; font-weight: 700; }
.movie-list-copy span:first-child svg { color: #f2b900; }
.movie-list-copy span.pending { color: #b58000; }
.movie-list-arrow { display: grid; place-items: center; width: 32px; height: 32px; color: #fff; border-radius: 50%; background: #1e1f22; transition: transform .3s cubic-bezier(.16,1,.3,1); }
.movie-list-item:hover .movie-list-arrow, .movie-list-item:focus-visible .movie-list-arrow { transform: translateX(2px) scale(1.04); }
.movie-list-empty { padding: 40px 0; color: #999a9f; text-align: center; font-size: 12px; }
@keyframes row-in { 0% { opacity: 0; transform: translateY(24px) scale(.97); } 72% { opacity: 1; transform: translateY(-2px) scale(1.012); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .movie-list-item { animation: none; } }
</style>
