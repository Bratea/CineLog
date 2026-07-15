<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, Check, Flame, Heart, Pencil, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({ movie: { type: Object, required: true } })
const emit = defineEmits(['back', 'update-watched'])
const liked = ref(false)
const scrollProgress = ref(0)

const posterStyle = computed(() => {
  const path = props.movie.backdropUrl || props.movie.posterUrl || props.movie.backdrop_path || props.movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
    return { backgroundImage: `url(${src})` }
  }
  if (props.movie.poster === 'demon') return { backgroundImage: `url(${cinematicAnimeCollage})` }
  return {}
})

function handleScroll(event) {
  scrollProgress.value = Math.min(1, event.currentTarget.scrollTop / 260)
}

function setWatched(value) {
  emit('update-watched', value)
}
</script>

<template>
  <article class="movie-detail" :class="`movie-detail--${movie.poster}`" :style="{ '--scroll': scrollProgress }">
    <div class="detail-backdrop" :style="posterStyle"></div>
    <header class="detail-topbar">
      <button aria-label="返回" @click="emit('back')"><ArrowLeft :size="21" /></button>
      <button :class="{ active: liked }" aria-label="收藏" @click="liked = !liked"><Heart :size="20" :fill="liked ? 'currentColor' : 'none'" /></button>
    </header>

    <div class="detail-scroll" @scroll.passive="handleScroll">
      <section class="detail-hero-copy">
        <p class="detail-original">{{ movie.originalTitle }}</p>
        <h1>{{ movie.title }}</h1>
        <div class="detail-score"><Flame :size="18" fill="currentColor" /><strong>{{ movie.rating ?? '—' }}</strong><span>个人评分</span></div>
        <div class="detail-meta">
          <span>{{ movie.year }}</span><i></i><span>{{ movie.meta }}</span><i></i><span>{{ movie.watched ? '已观看' : '未观看' }}</span>
        </div>
      </section>

      <div class="glass-flow">
        <section class="glass-panel synopsis-panel">
          <h2>剧情简介</h2>
          <p>{{ movie.overview || '影片的故事、角色与世界观信息将在这里展示。接入 TMDB 后，当前电影的简介会随封面与资料一起呈现。' }}</p>
        </section>

        <section class="glass-panel review-panel">
          <div class="section-title"><h2>我的影评</h2><time>{{ movie.year }}</time></div>
          <blockquote>“{{ movie.feeling }}”</blockquote>
          <div class="review-rating"><Star v-for="n in 5" :key="n" :size="16" fill="currentColor" /><span>{{ movie.rating ?? '未评分' }}</span></div>
        </section>

        <section class="detail-stats" aria-label="电影记录数据">
          <div><strong>{{ movie.year }}</strong><span>上映年份</span></div>
          <div><strong>{{ movie.rating ?? '—' }}</strong><span>我的评分</span></div>
          <div><strong>{{ movie.watched ? '已看' : '未看' }}</strong><span>观看状态</span></div>
        </section>
      </div>
    </div>

    <footer class="detail-dock">
      <button class="edit-dock" aria-label="编辑电影记录"><Pencil :size="18" /><span>编辑</span></button>
      <div class="watch-switch" :class="{ watched: movie.watched }" role="group" aria-label="观看状态">
        <span class="switch-thumb" aria-hidden="true"></span>
        <button :class="{ selected: !movie.watched }" @click="setWatched(false)">未观看</button>
        <button :class="{ selected: movie.watched }" @click="setWatched(true)"><Check :size="12" />已观看</button>
      </div>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.movie-detail { --accent: #f0a05b; --screen: #0a0e10; position: absolute; z-index: 12; inset: 0; overflow: hidden; color: #f6f0e9; background: var(--screen); animation: detail-in .55s cubic-bezier(.16,1,.3,1) both; }
.movie-detail--pop { --accent: #efaa74; }.movie-detail--crayon { --accent: #ffd06c; }.movie-detail--coco { --accent: #df9e72; }
.detail-backdrop { position: absolute; inset: 0 0 auto; height: 66%; background-size: cover; background-position: center 24%; opacity: calc(1 - var(--scroll) * .36); transform: scale(calc(1.04 + var(--scroll) * .035)) translateY(calc(var(--scroll) * -18px)); transition: opacity .12s linear, transform .12s linear; }
.movie-detail--pop .detail-backdrop { background-image: radial-gradient(circle at 60% 18%,#ffd47d 0 8%,transparent 9%),linear-gradient(150deg,#4bb5cd,#1c4e80 48%,#061425); }.movie-detail--crayon .detail-backdrop { background-image: radial-gradient(circle at 25% 20%,#ffde68 0 12%,transparent 13%),linear-gradient(155deg,#61c1de,#eca55c 51%,#8d2726); }.movie-detail--coco .detail-backdrop { background-image: radial-gradient(circle at 63% 19%,#ffda6b 0 11%,transparent 12%),linear-gradient(150deg,#3a61ad,#8b4074 56%,#e18349); }
.detail-backdrop::after { content:''; position:absolute; inset:0; background: linear-gradient(180deg, transparent 0 54%, rgba(10,14,16,.12) 64%, rgba(10,14,16,.68) 82%, var(--screen) 100%); }
.detail-topbar { position:absolute; z-index:5; top:25px; right:18px; left:18px; display:flex; justify-content:space-between; transform:translateY(calc(var(--scroll) * -8px)); }
.detail-topbar button { display:grid; place-items:center; width:42px; height:42px; padding:0; color:#fff7ef; border:1px solid rgba(255,255,255,.38); border-radius:50%; background:rgba(15,18,19,.2); box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 8px 20px rgba(0,0,0,.16); backdrop-filter:blur(18px) saturate(1.4); }
.detail-topbar button.active { color:var(--accent); border-color:color-mix(in srgb,var(--accent) 55%,transparent); }
.detail-scroll { position:absolute; inset:0; padding:0 20px 118px; overflow-y:auto; scrollbar-width:none; overscroll-behavior:contain; }.detail-scroll::-webkit-scrollbar{display:none}
.detail-hero-copy { min-height:570px; display:flex; flex-direction:column; justify-content:end; padding:100px 2px 34px; }
.detail-original { margin:0 0 8px; color:rgba(255,247,239,.62); font:11px Georgia,serif; letter-spacing:.07em; }.detail-hero-copy h1 { max-width:340px; margin:0; font:500 31px/1.16 Georgia,'Songti SC',serif; letter-spacing:-.04em; text-shadow:0 3px 18px rgba(0,0,0,.42); }
.detail-score { display:flex; align-items:baseline; gap:7px; margin-top:16px; color:var(--accent); }.detail-score strong{font:500 27px Georgia,serif}.detail-score span{color:rgba(255,247,239,.55);font-size:10px}
.detail-meta { display:flex; align-items:center; gap:10px; margin-top:18px; color:rgba(255,247,239,.62); font-size:10px; }.detail-meta i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.42)}
.glass-flow { display:grid; gap:14px; padding-bottom:36px; }
.glass-panel { position:relative; overflow:hidden; padding:20px; border:1px solid rgba(255,255,255,calc(.12 + var(--scroll) * .16)); border-radius:24px; background:linear-gradient(145deg,rgba(255,255,255,calc(.035 + var(--scroll) * .04)),rgba(255,255,255,.018)); box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -18px 34px rgba(0,0,0,.16),0 16px 30px rgba(0,0,0,.18); backdrop-filter:blur(calc(13px + var(--scroll) * 11px)) saturate(calc(1.05 + var(--scroll) * .35)); }
.glass-panel::after { content:''; position:absolute; top:-45%; right:-26%; width:62%; height:110%; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,.12),transparent 66%); transform:rotate(-18deg); pointer-events:none; }
.glass-panel h2 { position:relative; z-index:1; margin:0; color:#f9f1e8; font:500 18px Georgia,'Songti SC',serif; }.glass-panel p{position:relative;z-index:1;margin:14px 0 0;color:rgba(246,240,233,.68);font-size:11px;line-height:1.9}
.section-title{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between}.section-title time{color:rgba(246,240,233,.35);font-size:9px}.review-panel blockquote{position:relative;z-index:1;margin:16px 0 0;color:var(--accent);font:14px/1.7 Georgia,'Songti SC',serif}.review-rating{position:relative;z-index:1;display:flex;align-items:center;gap:4px;margin-top:18px;color:var(--accent)}.review-rating span{margin-left:5px;font:12px Georgia,serif}
.detail-stats{display:grid;grid-template-columns:repeat(3,1fr);padding:20px 4px;color:rgba(246,240,233,.72);text-align:center}.detail-stats div+div{border-left:1px solid rgba(255,255,255,.1)}.detail-stats strong,.detail-stats span{display:block}.detail-stats strong{font:16px Georgia,serif}.detail-stats span{margin-top:5px;color:rgba(246,240,233,.32);font-size:8px}
.detail-dock{position:absolute;z-index:6;right:14px;bottom:20px;left:0;display:flex;align-items:center;justify-content:space-between;pointer-events:none}.detail-dock button{pointer-events:auto}
.edit-dock{display:flex;align-items:center;gap:7px;width:84px;height:50px;padding:0 12px 0 18px;color:#fff5ec;border:1px solid rgba(255,255,255,.22);border-left:0;border-radius:0 19px 19px 0;background:rgba(23,26,27,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),8px 12px 24px rgba(0,0,0,.28);backdrop-filter:blur(20px) saturate(1.35);font-size:11px;font-weight:700}.edit-dock svg{color:var(--accent)}
.watch-switch{position:relative;display:grid;grid-template-columns:repeat(2,1fr);width:196px;height:50px;padding:4px;border:1px solid rgba(255,255,255,.2);border-radius:19px;background:rgba(23,26,27,.72);box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 12px 25px rgba(0,0,0,.28);backdrop-filter:blur(20px) saturate(1.35);pointer-events:auto}.switch-thumb{position:absolute;z-index:0;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border:1px solid rgba(255,255,255,.18);border-radius:15px;background:linear-gradient(145deg,rgba(255,255,255,.17),rgba(255,255,255,.06));box-shadow:inset 0 1px 0 rgba(255,255,255,.24),0 5px 13px rgba(0,0,0,.22);transition:transform .48s cubic-bezier(.16,1,.3,1),background .3s}.watch-switch.watched .switch-thumb{transform:translateX(100%);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 60%,rgba(255,255,255,.12)),color-mix(in srgb,var(--accent) 24%,rgba(255,255,255,.04)))}.watch-switch button{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:0;color:rgba(255,255,255,.46);border:0;background:transparent;font-size:10px;font-weight:650}.watch-switch button.selected{color:#fff8ef}
@keyframes detail-in{from{opacity:0;transform:translateY(18px) scale(.985)}}@media(max-height:760px){.detail-hero-copy{min-height:510px}}@media(prefers-reduced-motion:reduce){.movie-detail{animation:none}.detail-backdrop,.switch-thumb{transition:none}}
</style>
