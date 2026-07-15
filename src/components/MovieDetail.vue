<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  LoaderCircle,
  Pencil,
  Play,
  Star,
  Tag,
  UserRound,
} from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({
  movie: { type: Object, required: true },
  entryMode: { type: String, default: 'home' },
})
const emit = defineEmits(['back', 'navigate', 'update-watched'])

const liked = ref(false)
const overviewExpanded = ref(false)
const scrollProgress = ref(0)
const swipeStart = ref(null)
const swipeAxis = ref(null)
const swipeX = ref(0)
const isSwipeDragging = ref(false)
const swipeTransition = ref(true)
const isSwitching = ref(false)
const switchDirection = ref(0)
const isReturning = ref(false)

let switchTimer
let backTimer

const imageUrl = (path, size = 'original') => {
  if (!path) return ''
  return path.startsWith('http') ? path : `https://image.tmdb.org/t/p/${size}${path}`
}

const posterStyle = computed(() => {
  const path = props.movie.backdropUrl || props.movie.posterUrl || props.movie.backdrop_path || props.movie.poster_path
  if (path) return { backgroundImage: `url(${imageUrl(path)})` }
  if (props.movie.poster === 'demon') return { backgroundImage: `url(${cinematicAnimeCollage})` }
  return {}
})

const genres = computed(() => {
  if (props.movie.genres?.length) return props.movie.genres.map((genre) => typeof genre === 'string' ? genre : genre.name).filter(Boolean)
  return String(props.movie.meta || '')
    .split('·')
    .map((item) => item.trim())
    .filter((item) => item && !['TMDB', '电影', '电视剧'].includes(item) && item !== props.movie.year)
})

const tmdbScore = computed(() => props.movie.tmdbRating ?? props.movie.vote_average ?? null)
const personalScore = computed(() => props.movie.personalRating ?? (props.movie.watched ? props.movie.rating : null))
const runtimeLabel = computed(() => {
  const minutes = Number(props.movie.runtime)
  if (!minutes) return '片长待补充'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}小时${rest ? `${rest}分钟` : ''}` : `${rest}分钟`
})
const releaseLabel = computed(() => props.movie.releaseDate || props.movie.release_date || props.movie.year || '上映日期待定')
const voteLabel = computed(() => {
  const count = Number(props.movie.tmdbVoteCount || props.movie.vote_count || 0)
  if (!count) return '暂无评分人数'
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)} 万人评分`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k 人评分`
  return `${count} 人评分`
})
const people = computed(() => [props.movie.director, ...(props.movie.cast || [])].filter(Boolean).slice(0, 8))
const canExpandOverview = computed(() => String(props.movie.overview || '').length > 92)
const trailerUrl = computed(() => props.movie.trailer?.site === 'YouTube' && props.movie.trailer.key
  ? `https://www.youtube.com/watch?v=${props.movie.trailer.key}`
  : '')
const detailMotionStyle = computed(() => ({ '--scroll': scrollProgress.value, '--swipe-x': `${swipeX.value}px` }))

function handleScroll(event) {
  scrollProgress.value = Math.min(1, event.currentTarget.scrollTop / 230)
}

function setWatched(value) {
  emit('update-watched', value)
}

function openTrailer() {
  if (trailerUrl.value) window.open(trailerUrl.value, '_blank', 'noopener,noreferrer')
}

function detailPointerDown(event) {
  if (isSwitching.value || isReturning.value || event.target.closest('button, a, input, textarea, [role="group"]')) return
  swipeStart.value = { x: event.clientX, y: event.clientY }
  swipeAxis.value = null
  swipeTransition.value = false
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function detailPointerMove(event) {
  if (!swipeStart.value) return
  const deltaX = event.clientX - swipeStart.value.x
  const deltaY = event.clientY - swipeStart.value.y
  if (!swipeAxis.value && Math.hypot(deltaX, deltaY) > 8) {
    swipeAxis.value = Math.abs(deltaX) > Math.abs(deltaY) * 1.12 ? 'horizontal' : 'vertical'
    isSwipeDragging.value = swipeAxis.value === 'horizontal'
  }
  if (swipeAxis.value === 'horizontal') {
    event.preventDefault()
    swipeX.value = Math.max(-150, Math.min(150, deltaX * .82))
  }
}

function detailPointerUp(event) {
  if (!swipeStart.value) return
  const deltaX = event.clientX - swipeStart.value.x
  if (swipeAxis.value === 'horizontal' && Math.abs(deltaX) > 58) switchMovie(deltaX < 0 ? 1 : -1)
  else {
    swipeTransition.value = true
    swipeX.value = 0
  }
  swipeStart.value = null
  swipeAxis.value = null
  isSwipeDragging.value = false
}

function cancelDetailSwipe() {
  swipeStart.value = null
  swipeAxis.value = null
  isSwipeDragging.value = false
  swipeTransition.value = true
  swipeX.value = 0
}

function switchMovie(direction) {
  if (isSwitching.value) return
  switchDirection.value = direction
  isSwitching.value = true
  swipeTransition.value = true
  swipeX.value = direction > 0 ? -460 : 460
  switchTimer = window.setTimeout(() => emit('navigate', direction), 270)
}

function requestBack() {
  if (isReturning.value) return
  isReturning.value = true
  backTimer = window.setTimeout(() => emit('back'), 460)
}

watch(() => props.movie.id, async () => {
  window.clearTimeout(switchTimer)
  overviewExpanded.value = false
  liked.value = Boolean(props.movie.favourite)
  scrollProgress.value = 0
  swipeTransition.value = false
  swipeX.value = switchDirection.value > 0 ? 96 : -96
  await nextTick()
  window.requestAnimationFrame(() => {
    swipeTransition.value = true
    swipeX.value = 0
    isSwitching.value = false
  })
}, { immediate: true })

onBeforeUnmount(() => {
  window.clearTimeout(switchTimer)
  window.clearTimeout(backTimer)
})
</script>

<template>
  <article
    class="movie-detail"
    :class="[`movie-detail--${movie.poster}`, `entry-${entryMode}`, { 'is-swipe-dragging': isSwipeDragging, 'has-swipe-transition': swipeTransition, 'is-switching': isSwitching, 'is-returning': isReturning }]"
    :style="detailMotionStyle"
    @pointerdown="detailPointerDown"
    @pointermove="detailPointerMove"
    @pointerup="detailPointerUp"
    @pointercancel="cancelDetailSwipe"
  >
    <div class="detail-backdrop" :style="posterStyle"></div>
    <header class="detail-topbar">
      <button aria-label="返回" @click="requestBack"><ArrowLeft :size="21" /></button>
      <div class="detail-swipe-hint" aria-hidden="true">左右滑动切换</div>
      <button :class="{ active: liked }" aria-label="收藏" @click="liked = !liked"><Heart :size="20" :fill="liked ? 'currentColor' : 'none'" /></button>
    </header>

    <div class="detail-scroll" @scroll.passive="handleScroll">
      <section class="detail-hero-copy">
        <p class="detail-original">{{ movie.originalTitle }}</p>
        <h1>{{ movie.title }}</h1>
        <div class="detail-meta">
          <span>{{ movie.year }}</span><i></i>
          <span>{{ genres.slice(0, 3).join('、') || '类型待补充' }}</span><i></i>
          <span>{{ movie.watched ? '已观看' : '未观看' }}</span>
        </div>
      </section>

      <div class="detail-content">
        <p v-if="movie.tagline" class="detail-tagline">“{{ movie.tagline }}”</p>

        <div v-if="movie.detailState === 'loading'" class="detail-load-state">
          <LoaderCircle :size="15" /><span>正在补全 TMDB 影片资料…</span>
        </div>
        <div v-else-if="movie.detailState === 'error'" class="detail-load-state is-error">
          <span>{{ movie.detailError }}</span>
        </div>

        <section class="score-actions" aria-label="TMDB 评分与预告片">
          <div class="tmdb-score-card">
            <span>TMDB 评分</span>
            <div><strong>{{ tmdbScore ?? '—' }}</strong><small>/10</small></div>
            <p><Star :size="13" fill="currentColor" />{{ voteLabel }}</p>
          </div>
          <button class="trailer-card" :disabled="!trailerUrl" @click="openTrailer">
            <i><Play :size="17" fill="currentColor" /></i>
            <span><strong>预告片</strong><small>{{ trailerUrl ? '观看官方预告' : '暂无可用视频' }}</small></span>
          </button>
        </section>

        <section class="quick-facts" aria-label="影片基础资料">
          <span><CalendarDays :size="14" />{{ releaseLabel }}</span>
          <span><Clock3 :size="14" />{{ runtimeLabel }}</span>
          <span><Tag :size="14" />{{ movie.certification || genres[0] || '分级待定' }}</span>
        </section>

        <section class="detail-panel synopsis-panel">
          <h2>剧情简介</h2>
          <p :class="{ expanded: overviewExpanded }">{{ movie.overview || '暂无剧情简介。TMDB 详情加载完成后会在这里展示影片介绍。' }}</p>
          <button v-if="canExpandOverview" class="text-action" @click="overviewExpanded = !overviewExpanded">
            {{ overviewExpanded ? '收起' : '展开' }}<ChevronDown :size="14" :class="{ rotated: overviewExpanded }" />
          </button>
        </section>

        <section v-if="people.length" class="detail-panel people-panel">
          <div class="section-heading"><h2>主要演职员</h2><small>导演与主演</small></div>
          <div class="people-rail">
            <article v-for="person in people" :key="`${person.id}-${person.role}`" class="person-card">
              <div class="person-photo" :style="person.profile_path ? { backgroundImage: `url(${imageUrl(person.profile_path, 'w185')})` } : {}">
                <UserRound v-if="!person.profile_path" :size="20" />
              </div>
              <strong>{{ person.name }}</strong>
              <span>{{ person.role }}</span>
            </article>
          </div>
        </section>

        <section class="detail-panel record-panel">
          <div class="section-heading"><h2>我的记录</h2><small>{{ movie.watched ? '观影已完成' : '待看清单' }}</small></div>
          <div class="record-grid">
            <div><span>我的评分</span><strong>{{ personalScore ?? '—' }}<small v-if="personalScore">/10</small></strong></div>
            <div><span>观看日期</span><strong>{{ movie.watchedDate || (movie.watched ? movie.year : '尚未观看') }}</strong></div>
          </div>
          <blockquote>“{{ movie.feeling || (movie.watched ? '还没有写下短评。' : '加入待看清单，留给下一次观影。') }}”</blockquote>
        </section>

        <div class="detail-end">影片资料由 TMDB 提供</div>
      </div>
    </div>

    <footer class="detail-dock">
      <button class="edit-dock" aria-label="编辑电影记录"><Pencil :size="17" /><span>编辑记录</span></button>
      <div class="watch-switch" :class="{ watched: movie.watched }" role="group" aria-label="观看状态">
        <span class="switch-thumb" aria-hidden="true"></span>
        <button :class="{ selected: !movie.watched }" @click="setWatched(false)">未观看</button>
        <button :class="{ selected: movie.watched }" @click="setWatched(true)"><Check :size="12" />已观看</button>
      </div>
    </footer>
  </article>
</template>

<style scoped lang="scss">
.movie-detail { --accent:#f2b85b; --screen:#07100f; --swipe-x:0px; position:absolute; z-index:12; inset:0; overflow:hidden; color:#f7f1e8; background:var(--screen); touch-action:pan-y; translate:var(--swipe-x) 0; transform-origin:50% 28%; will-change:translate,transform,clip-path; animation:detail-unfold .66s cubic-bezier(.18,.88,.2,1) both; }
.movie-detail.has-swipe-transition { transition:translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease; }
.movie-detail.entry-list { animation:detail-list-in .58s cubic-bezier(.18,.88,.2,1) both; }
.movie-detail.is-swipe-dragging { transition:none; }.movie-detail.is-switching{opacity:.92}.movie-detail.is-returning{pointer-events:none;animation:detail-return-home .46s cubic-bezier(.55,.04,.82,.32) both!important}.movie-detail.entry-list.is-returning{animation-name:detail-return-list!important}
.movie-detail--pop{--accent:#efaa74}.movie-detail--crayon{--accent:#ffd06c}.movie-detail--coco{--accent:#df9e72}
.detail-backdrop{position:absolute;inset:0 0 auto;height:50%;background-size:cover;background-position:center 24%;opacity:calc(1 - var(--scroll) * .34);transform:scale(calc(1.035 + var(--scroll) * .03)) translateY(calc(var(--scroll) * -13px));transition:opacity .12s linear,transform .12s linear;animation:backdrop-open .72s cubic-bezier(.18,.88,.2,1) both}.detail-backdrop::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 0 45%,rgba(7,16,15,.12) 58%,rgba(7,16,15,.76) 83%,var(--screen) 100%)}
.detail-topbar{position:absolute;z-index:5;top:24px;right:18px;left:18px;display:flex;align-items:center;justify-content:space-between}.detail-topbar button{display:grid;place-items:center;width:42px;height:42px;padding:0;color:#fff7ef;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(12,18,18,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 20px rgba(0,0,0,.18);backdrop-filter:blur(18px) saturate(1.35)}.detail-topbar button.active{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.detail-swipe-hint{padding:6px 10px;color:rgba(255,247,239,.58);border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(13,16,18,.18);backdrop-filter:blur(14px);font-size:8px;font-weight:700;letter-spacing:.03em;pointer-events:none}
.detail-scroll{position:absolute;inset:0;padding:0 18px 112px;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}.detail-scroll::-webkit-scrollbar{display:none}.detail-hero-copy{display:flex;min-height:430px;flex-direction:column;justify-content:end;padding:100px 3px 28px;animation:detail-copy-in .72s cubic-bezier(.16,1,.3,1) .2s both}.detail-original{margin:0 0 7px;color:rgba(255,247,239,.68);font:11px Georgia,serif;letter-spacing:.04em}.detail-hero-copy h1{max-width:350px;margin:0;font:500 29px/1.18 Georgia,'Songti SC',serif;letter-spacing:-.045em;text-shadow:0 3px 18px rgba(0,0,0,.42)}.detail-meta{display:flex;align-items:center;gap:9px;margin-top:15px;color:rgba(255,247,239,.68);font-size:9px}.detail-meta i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.45)}
.detail-content{display:grid;gap:12px;padding-bottom:28px}.detail-tagline{margin:0 4px 2px;color:var(--accent);font:13px/1.6 Georgia,'Songti SC',serif}.detail-load-state{display:flex;align-items:center;gap:7px;padding:10px 12px;color:rgba(247,241,232,.66);border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);font-size:9px}.detail-load-state svg{color:var(--accent);animation:loading-spin .9s linear infinite}.detail-load-state.is-error{color:#e7a69a;border-color:rgba(231,166,154,.16)}
.score-actions{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.tmdb-score-card,.trailer-card{min-height:108px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}.tmdb-score-card>span{color:rgba(247,241,232,.53);font-size:9px}.tmdb-score-card>div{display:flex;align-items:baseline;margin-top:5px}.tmdb-score-card strong{color:var(--accent);font:500 28px Georgia,serif}.tmdb-score-card small{margin-left:3px;color:rgba(247,241,232,.38);font-size:9px}.tmdb-score-card p{display:flex;align-items:center;gap:5px;margin:7px 0 0;color:rgba(247,241,232,.48);font-size:8px}.tmdb-score-card p svg{color:var(--accent)}.trailer-card{display:flex;align-items:center;gap:10px;color:#f8f0e6;text-align:left}.trailer-card:disabled{color:rgba(247,241,232,.38)}.trailer-card i{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;color:var(--accent);border:1px solid var(--accent);border-radius:50%}.trailer-card span,.trailer-card strong,.trailer-card small{display:block}.trailer-card strong{font-size:11px}.trailer-card small{margin-top:5px;color:rgba(247,241,232,.45);font-size:8px;line-height:1.35}
.quick-facts{display:flex;align-items:center;gap:0;overflow-x:auto;padding:12px 5px;color:rgba(247,241,232,.59);border:1px solid rgba(255,255,255,.085);border-radius:16px;background:rgba(255,255,255,.025);scrollbar-width:none}.quick-facts span{display:flex;align-items:center;flex:0 0 auto;gap:5px;padding:0 11px;font-size:8px;white-space:nowrap}.quick-facts span+span{border-left:1px solid rgba(255,255,255,.1)}.quick-facts svg{color:rgba(247,241,232,.72)}
.detail-panel{position:relative;overflow:hidden;padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 13px 28px rgba(0,0,0,.12);backdrop-filter:blur(15px) saturate(1.15)}.detail-panel h2{margin:0;color:#fbf3e9;font:500 17px Georgia,'Songti SC',serif}.section-heading{display:flex;align-items:center;justify-content:space-between}.section-heading small{color:rgba(247,241,232,.32);font-size:8px}.synopsis-panel p{display:-webkit-box;overflow:hidden;margin:13px 0 0;color:rgba(247,241,232,.65);font-size:10px;line-height:1.85;-webkit-box-orient:vertical;-webkit-line-clamp:4}.synopsis-panel p.expanded{display:block}.text-action{display:flex;align-items:center;gap:2px;margin:10px 0 0 auto;padding:0;color:var(--accent);border:0;background:transparent;font-size:9px;font-weight:750}.text-action svg{transition:transform .25s}.text-action svg.rotated{transform:rotate(180deg)}
.people-panel{padding-right:0}.people-panel .section-heading{padding-right:18px}.people-rail{display:flex;gap:9px;overflow-x:auto;margin-top:13px;padding:0 18px 3px 0;scrollbar-width:none}.person-card{flex:0 0 72px;min-width:0}.person-photo{display:grid;place-items:center;width:72px;height:84px;color:rgba(247,241,232,.28);border-radius:14px;background:rgba(255,255,255,.05) center/cover no-repeat}.person-card strong,.person-card span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.person-card strong{margin-top:7px;color:rgba(247,241,232,.84);font-size:9px}.person-card span{margin-top:3px;color:var(--accent);font-size:7px}
.record-grid{display:grid;grid-template-columns:repeat(2,1fr);margin-top:15px}.record-grid>div{padding:0 12px}.record-grid>div:first-child{padding-left:0}.record-grid>div+div{border-left:1px solid rgba(255,255,255,.12)}.record-grid span,.record-grid strong{display:block}.record-grid span{color:rgba(247,241,232,.45);font-size:8px}.record-grid strong{margin-top:6px;color:var(--accent);font:500 18px Georgia,'Songti SC',serif}.record-grid strong small{font-size:8px}.record-grid>div+div strong{color:rgba(247,241,232,.82);font-size:12px}.record-panel blockquote{margin:15px 0 0;padding-top:13px;color:rgba(247,241,232,.62);border-top:1px solid rgba(255,255,255,.08);font:11px/1.65 Georgia,'Songti SC',serif}.detail-end{padding:9px 0 2px;color:rgba(247,241,232,.23);font-size:8px;text-align:center}
.detail-dock{position:absolute;z-index:6;right:12px;bottom:16px;left:12px;display:flex;align-items:center;gap:8px;padding:5px;border:1px solid rgba(255,255,255,.13);border-radius:20px;background:rgba(14,20,20,.8);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 13px 27px rgba(0,0,0,.32);backdrop-filter:blur(22px) saturate(1.3)}.detail-dock button{pointer-events:auto}.edit-dock{display:flex;align-items:center;justify-content:center;gap:6px;width:104px;height:42px;padding:0;color:var(--accent);border:0;border-radius:15px;background:transparent;font-size:9px;font-weight:750}.watch-switch{position:relative;display:grid;flex:1;grid-template-columns:repeat(2,1fr);height:42px;padding:3px;border:1px solid rgba(255,255,255,.13);border-radius:15px;background:rgba(255,255,255,.03);pointer-events:auto}.switch-thumb{position:absolute;z-index:0;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border:1px solid rgba(255,255,255,.14);border-radius:12px;background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.05));transition:transform .48s cubic-bezier(.16,1,.3,1),background .3s}.watch-switch.watched .switch-thumb{transform:translateX(100%);background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 46%,rgba(255,255,255,.1)),color-mix(in srgb,var(--accent) 18%,rgba(255,255,255,.04)))}.watch-switch button{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:0;color:rgba(255,255,255,.42);border:0;background:transparent;font-size:9px;font-weight:700}.watch-switch button.selected{color:#fff8ef}
@keyframes loading-spin{to{transform:rotate(360deg)}}@keyframes detail-unfold{0%{opacity:.58;clip-path:inset(15% 11% 48% 11% round 24px);transform:translateY(-28px) scale(.95)}48%{opacity:1;clip-path:inset(3% 3% 24% 3% round 15px);transform:translateY(-4px) scale(.992)}100%{opacity:1;clip-path:inset(0 round 0);transform:translateY(0) scale(1)}}
@keyframes backdrop-open{from{background-position:center 34%;transform:scale(1.13) translateY(-16px);filter:saturate(1.1)}to{background-position:center 24%;transform:scale(calc(1.035 + var(--scroll) * .03)) translateY(calc(var(--scroll) * -13px));filter:saturate(1)}}@keyframes detail-copy-in{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:translateY(0)}}@keyframes detail-list-in{from{opacity:.35;transform:scale(1.018)}to{opacity:1;transform:scale(1)}}@keyframes detail-return-home{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(10% 9% 35% 9% round 24px);transform:translateY(18px) scale(.96)}100%{opacity:0;clip-path:inset(20% 15% 47% 15% round 28px);transform:translateY(42px) scale(.88)}}@keyframes detail-return-list{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(18% 36% 46% 8% round 20px);transform:translate(-26px,24px) scale(.94)}100%{opacity:0;clip-path:inset(38% 74% 50% 6% round 14px);transform:translate(-54px,38px) scale(.82)}}
@media(max-height:760px){.detail-hero-copy{min-height:385px}}@media(prefers-reduced-motion:reduce){.movie-detail,.detail-backdrop,.detail-hero-copy,.detail-load-state svg{animation:none}.detail-backdrop,.switch-thumb{transition:none}}
</style>
