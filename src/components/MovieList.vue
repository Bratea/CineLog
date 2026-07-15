<script setup>
import { Check, ChevronRight, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

defineProps({ movies: { type: Array, required: true } })
</script>

<template>
  <div class="movie-list" aria-label="电影列表视图">
    <article v-for="movie in movies" :key="movie.id" class="movie-list-item">
      <div class="movie-list-poster" :class="`movie-list-poster--${movie.poster}`" :style="movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : {}"></div>
      <div class="movie-list-copy">
        <p>{{ movie.meta }} · {{ movie.year }}</p>
        <h3>{{ movie.title }}</h3>
        <div>
          <span :class="{ unrated: movie.rating === null }"><Star :size="12" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '未评分' }}</span>
          <span :class="{ pending: !movie.watched }"><Check :size="10" />{{ movie.watched ? '已观看' : '未观看' }}</span>
        </div>
      </div>
      <button aria-label="查看电影详情"><ChevronRight :size="18" /></button>
    </article>
    <p v-if="!movies.length" class="movie-list-empty">这里还没有电影。</p>
  </div>
</template>

<style lang="scss" scoped>
.movie-list { display: grid; gap: 8px; max-height: 342px; padding: 0 22px 8px; overflow-y: auto; scrollbar-width: none; }
.movie-list::-webkit-scrollbar { display: none; }
.movie-list-item { display: grid; grid-template-columns: 58px 1fr 34px; align-items: center; gap: 11px; min-height: 74px; padding: 8px 10px; border: 1px solid #ececef; border-radius: 19px; background: #fff; box-shadow: 0 4px 12px rgba(18,19,22,.035); transition: transform .42s cubic-bezier(.16,1,.3,1), box-shadow .35s ease; animation: row-in .58s cubic-bezier(.16,1,.3,1) both; }
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
.movie-list-item > button { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; color: #fff; border: 0; border-radius: 50%; background: #1e1f22; transition: transform .3s cubic-bezier(.16,1,.3,1); }
.movie-list-item > button:hover { transform: translateX(2px) scale(1.04); }
.movie-list-empty { padding: 40px 0; color: #999a9f; text-align: center; font-size: 12px; }
@keyframes row-in { 0% { opacity: 0; transform: translateY(15px) scale(.97); } 72% { opacity: 1; transform: translateY(-1px) scale(1.018); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) { .movie-list-item { animation: none; } }
</style>
