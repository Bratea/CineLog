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
  X,
} from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({
  movie: { type: Object, required: true },
  entryMode: { type: String, default: 'home' },
  layoutOrder: { type: Array, default: () => ['tagline', 'score', 'trailer', 'facts', 'synopsis', 'people', 'record'] },
})
const emit = defineEmits(['back', 'navigate', 'update-watched', 'update-record'])

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
const editOpen = ref(false)
const draftRating = ref(0)
const draftDate = ref('')
const draftReview = ref('')
const ratingBurst = ref(false)
const ratingBurstKey = ref(0)
const detailScroll = ref(null)

let switchTimer
let backTimer
let burstTimer
let revealObserver

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
const canExpandOverview = computed(() => String(props.movie.overview || '').length > 48)
const trailerUrl = computed(() => {
  const directUrl = props.movie.trailerUrl || props.movie.videoUrl || props.movie.trailer?.url
  if (directUrl) return directUrl
  if (props.movie.trailer?.site === 'YouTube' && props.movie.trailer.key) return `https://www.youtube.com/watch?v=${props.movie.trailer.key}`
  if (props.movie.trailer?.site === 'Vimeo' && props.movie.trailer.key) return `https://vimeo.com/${props.movie.trailer.key}`
  return ''
})
const movieStills = computed(() => {
  const supplied = props.movie.stills || props.movie.backdrops || []
  const paths = supplied.map((item) => typeof item === 'string' ? item : item?.file_path || item?.path).filter(Boolean)
  const fallback = [props.movie.backdrop_path, props.movie.backdropUrl, props.movie.poster_path, props.movie.posterUrl].filter(Boolean)
  return [...new Set([...paths, ...fallback])].slice(0, 8)
})
const detailMotionStyle = computed(() => ({ '--scroll': scrollProgress.value, '--swipe-x': `${swipeX.value}px` }))
const moduleOrder = (id) => {
  const index = props.layoutOrder.indexOf(id)
  return index < 0 ? 50 : index + 1
}

function handleScroll(event) {
  const rawProgress = Math.min(1, event.currentTarget.scrollTop / 360)
  scrollProgress.value = rawProgress * rawProgress * (3 - 2 * rawProgress)
}

function observeRevealSections({ reset = false } = {}) {
  revealObserver?.disconnect()
  const root = detailScroll.value
  if (!root || typeof IntersectionObserver === 'undefined') return

  if (reset) root.querySelectorAll('.reveal-section').forEach((section) => section.classList.remove('is-visible'))
  const targets = root.querySelectorAll('.reveal-section:not(.is-visible)')
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      revealObserver?.unobserve(entry.target)
    })
  }, { root, threshold: 0.14, rootMargin: '0px 0px -8% 0px' })
  targets.forEach((section) => revealObserver.observe(section))
}

function setWatched(value) {
  emit('update-watched', value)
}

function toggleWatched() {
  setWatched(!props.movie.watched)
}

function openRecordEditor() {
  draftRating.value = personalScore.value || 0
  draftDate.value = props.movie.watchedDate || ''
  draftReview.value = props.movie.feeling || ''
  editOpen.value = true
}

function selectRating(score) {
  draftRating.value = score * 2
  ratingBurstKey.value += 1
  ratingBurst.value = false
  window.clearTimeout(burstTimer)
  window.requestAnimationFrame(() => {
    ratingBurst.value = true
    burstTimer = window.setTimeout(() => { ratingBurst.value = false }, 760)
  })
}

function saveRecord() {
  emit('update-record', {
    rating: draftRating.value,
    date: draftDate.value,
    review: draftReview.value,
  })
  editOpen.value = false
}

function openTrailer() {
  if (trailerUrl.value) window.open(trailerUrl.value, '_blank', 'noopener,noreferrer')
}

function detailPointerDown(event) {
  if (isSwitching.value || isReturning.value || event.target.closest('button, a, input, textarea, [role="group"], .people-rail, .stills-rail')) return
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
  editOpen.value = false
  liked.value = Boolean(props.movie.favourite)
  scrollProgress.value = 0
  swipeTransition.value = false
  swipeX.value = switchDirection.value > 0 ? 96 : -96
  await nextTick()
  observeRevealSections({ reset: true })
  window.requestAnimationFrame(() => {
    swipeTransition.value = true
    swipeX.value = 0
    isSwitching.value = false
  })
}, { immediate: true })

watch([() => props.movie.detailState, () => people.value.length], async () => {
  await nextTick()
  observeRevealSections()
})

onBeforeUnmount(() => {
  window.clearTimeout(switchTimer)
  window.clearTimeout(backTimer)
  window.clearTimeout(burstTimer)
  revealObserver?.disconnect()
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

    <div ref="detailScroll" class="detail-scroll" @scroll.passive="handleScroll">
      <section :key="`hero-${movie.id}`" class="detail-hero-copy">
        <p class="detail-original">{{ movie.originalTitle }}</p>
        <div class="detail-title-row">
          <h1>{{ movie.title }}</h1>
          <span class="release-chip"><CalendarDays :size="11" />{{ releaseLabel }}</span>
        </div>
        <div class="detail-meta">
          <span>{{ movie.year }}</span><i></i>
          <span>{{ genres.slice(0, 3).join('、') || '类型待补充' }}</span><i></i>
          <span>{{ movie.watched ? '已观看' : '未观看' }}</span>
        </div>
      </section>

      <div :key="`content-${movie.id}`" class="detail-content">
        <p v-if="movie.tagline" class="detail-tagline detail-module" :style="{ order: moduleOrder('tagline') }">“{{ movie.tagline }}”</p>

        <div v-if="movie.detailState === 'loading'" class="detail-load-state">
          <LoaderCircle :size="15" /><span>正在补全 TMDB 影片资料…</span>
        </div>
        <div v-else-if="movie.detailState === 'error'" class="detail-load-state is-error">
          <span>{{ movie.detailError }}</span>
        </div>

        <section class="score-actions detail-module reveal-section" :style="{ order: Math.min(moduleOrder('score'), moduleOrder('trailer')) }" aria-label="评分与预告片">
          <div class="tmdb-score-card">
            <span>TMDB 评分</span>
            <div><strong>{{ tmdbScore ?? '—' }}</strong><small>/10</small></div>
            <p><Star :size="13" fill="currentColor" />{{ voteLabel }}</p>
          </div>
          <button class="trailer-card" :disabled="!trailerUrl" @click="openTrailer">
            <i><Play :size="17" fill="currentColor" /></i>
            <span><strong>{{ trailerUrl ? '预告片' : '预告片链接' }}</strong><small>{{ trailerUrl ? '播放网络视频' : '暂未提供 URL' }}</small></span>
          </button>
        </section>

        <section class="quick-facts detail-module reveal-section" :style="{ order: moduleOrder('facts') }" aria-label="影片基础资料">
          <span><Clock3 :size="14" />{{ runtimeLabel }}</span>
          <span><Tag :size="14" />{{ movie.certification || genres[0] || '分级待定' }}</span>
        </section>

        <section class="detail-panel synopsis-panel detail-module reveal-section" :style="{ order: moduleOrder('synopsis') }">
          <h2>剧情简介</h2>
          <p :class="{ expanded: overviewExpanded }">{{ movie.overview || '暂无剧情简介。TMDB 详情加载完成后会在这里展示影片介绍。' }}</p>
          <button v-if="canExpandOverview" class="text-action" @click="overviewExpanded = !overviewExpanded">
            {{ overviewExpanded ? '收起' : '展开' }}<ChevronDown :size="14" :class="{ rotated: overviewExpanded }" />
          </button>
        </section>

        <section v-if="people.length" class="detail-panel people-panel detail-module reveal-section" :style="{ order: moduleOrder('people') }">
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

        <section class="detail-panel record-panel detail-module reveal-section" :style="{ order: moduleOrder('record') }">
          <div class="section-heading"><h2>我的记录</h2><small>{{ movie.watched ? '观影已完成' : '待看清单' }}</small></div>
          <div class="record-grid">
            <div><span>我的评分</span><strong>{{ personalScore ?? '—' }}<small v-if="personalScore">/10</small></strong></div>
            <div><span>观看日期</span><strong>{{ movie.watchedDate || (movie.watched ? movie.year : '尚未观看') }}</strong></div>
          </div>
          <blockquote>“{{ movie.feeling || (movie.watched ? '还没有写下短评。' : '加入待看清单，留给下一次观影。') }}”</blockquote>
        </section>

        <section v-if="movieStills.length" class="detail-panel stills-panel detail-module reveal-section" style="order:98">
          <div class="section-heading"><h2>电影剧照</h2><small>左右滑动查看</small></div>
          <div class="stills-rail">
            <figure v-for="(still, index) in movieStills" :key="`${still}-${index}`" :style="{ backgroundImage: `url(${imageUrl(still, 'w780')})` }">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
            </figure>
          </div>
        </section>

        <div class="detail-end" style="order: 99">影片资料由 TMDB 提供</div>
      </div>
    </div>

    <Transition name="record-editor">
      <div v-if="editOpen" class="record-editor-backdrop" @click.self="editOpen = false">
        <section class="record-editor-sheet" role="dialog" aria-modal="true" aria-label="编辑我的记录">
          <div class="record-editor-handle" aria-hidden="true"></div>
          <header>
            <div><small>MY MOVIE LOG</small><h2>编辑我的记录</h2></div>
            <button aria-label="关闭编辑" @click="editOpen = false"><X :size="18" /></button>
          </header>

          <section class="rating-editor">
            <div class="editor-label"><span>我的评分</span><strong>{{ draftRating || '—' }}<small>/10</small></strong></div>
            <div class="rating-stars" role="group" aria-label="个人评分">
              <button v-for="score in 5" :key="score" type="button" :class="{ selected: draftRating >= score * 2 }" :aria-label="`${score * 2} 分`" @click="selectRating(score)">
                <Star :size="26" :fill="draftRating >= score * 2 ? 'currentColor' : 'none'" />
              </button>
              <div v-if="ratingBurst" :key="ratingBurstKey" class="star-burst" aria-hidden="true">
                <Star v-for="particle in 12" :key="particle" :style="{ '--particle': particle }" :size="10" fill="currentColor" />
              </div>
            </div>
          </section>

          <label class="record-field">
            <span>观看日期</span>
            <input v-model="draftDate" type="date" />
          </label>
          <label class="record-field record-review-field">
            <span>个人评论</span>
            <textarea v-model="draftReview" rows="4" placeholder="写下这次观影留下的感受……"></textarea>
          </label>
          <button class="record-save" @click="saveRecord"><Check :size="16" />保存记录</button>
        </section>
      </div>
    </Transition>

    <footer class="detail-dock">
      <button class="edit-dock" aria-label="编辑我的记录" @click="openRecordEditor"><Pencil :size="24" /></button>
      <div class="watch-island">
        <button class="watch-toggle" :class="{ watched: movie.watched }" :aria-label="`当前${movie.watched ? '已观看' : '未观看'}，点击切换`" @click="toggleWatched">
          <Check v-if="movie.watched" :size="13" /><span>{{ movie.watched ? '已观看' : '未观看' }}</span>
        </button>
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
.detail-backdrop{position:absolute;inset:0 auto auto 0;width:100%;height:calc(54% + var(--scroll) * 46%);background-size:cover;background-position:center 20%;opacity:1;transform:scale(calc(1.035 + var(--scroll) * .018)) translateY(calc(var(--scroll) * -5px));transform-origin:50% 0;transition:height .3s cubic-bezier(.22,.61,.36,1),transform .26s ease-out;animation:backdrop-open .72s cubic-bezier(.18,.88,.2,1) both}.detail-backdrop::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 0 calc(42% + var(--scroll) * 17%),rgba(7,16,15,.18) calc(59% + var(--scroll) * 15%),rgba(7,16,15,.86) calc(84% + var(--scroll) * 10%),var(--screen) 100%);transition:opacity .28s ease}
.detail-topbar{position:absolute;z-index:5;top:24px;right:18px;left:18px;display:flex;align-items:center;justify-content:space-between}.detail-topbar button{display:grid;place-items:center;width:42px;height:42px;padding:0;color:#fff7ef;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(12,18,18,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 20px rgba(0,0,0,.18);backdrop-filter:blur(18px) saturate(1.35)}.detail-topbar button.active{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.detail-swipe-hint{padding:6px 10px;color:rgba(255,247,239,.58);border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(13,16,18,.18);backdrop-filter:blur(14px);font-size:8px;font-weight:700;letter-spacing:.03em;pointer-events:none}
.detail-scroll{position:absolute;inset:0;padding:0 18px 112px;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}.detail-scroll::-webkit-scrollbar{display:none}.detail-hero-copy{display:flex;min-height:430px;flex-direction:column;justify-content:end;padding:100px 3px 28px;animation:detail-copy-in .72s cubic-bezier(.16,1,.3,1) .2s both}.detail-original{margin:0 0 7px;color:rgba(255,247,239,.68);font:11px Georgia,serif;letter-spacing:.04em}.detail-hero-copy h1{max-width:350px;margin:0;font:500 29px/1.18 Georgia,'Songti SC',serif;letter-spacing:-.045em;text-shadow:0 3px 18px rgba(0,0,0,.42)}.detail-meta{display:flex;align-items:center;gap:9px;margin-top:15px;color:rgba(255,247,239,.68);font-size:9px}.detail-meta i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.45)}
.detail-content{display:grid;gap:18px;padding-bottom:28px}.detail-tagline{margin:0 4px 2px;color:var(--accent);font:13px/1.6 Georgia,'Songti SC',serif}.detail-load-state{display:flex;align-items:center;gap:7px;padding:10px 12px;color:rgba(247,241,232,.66);border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);font-size:9px}.detail-load-state svg{color:var(--accent);animation:loading-spin .9s linear infinite}.detail-load-state.is-error{color:#e7a69a;border-color:rgba(231,166,154,.16)}.reveal-section{--reveal-delay:0ms;opacity:0;filter:blur(7px);transform:translateY(42px) scale(.975);transition:opacity .64s ease var(--reveal-delay),filter .62s ease var(--reveal-delay),transform .82s cubic-bezier(.16,1,.3,1) var(--reveal-delay);will-change:opacity,filter,transform}.reveal-section.is-visible{opacity:1;filter:blur(0);transform:translateY(0) scale(1)}.score-actions{--reveal-delay:20ms}.quick-facts{--reveal-delay:55ms}.synopsis-panel{--reveal-delay:90ms}.people-panel{--reveal-delay:105ms}.record-panel{--reveal-delay:120ms}
.score-actions{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.tmdb-score-card,.trailer-card{min-height:108px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}.tmdb-score-card{position:relative;overflow:hidden;border-color:color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.17));background:linear-gradient(145deg,rgba(10,21,21,.9),rgba(13,24,24,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(0,0,0,.2);backdrop-filter:blur(18px) saturate(1.2)}.tmdb-score-card::before{content:'';position:absolute;top:0;right:14px;left:14px;height:2px;border-radius:0 0 8px 8px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.7}.tmdb-score-card>span{color:rgba(255,248,239,.78);font-size:9px;font-weight:750;letter-spacing:.02em}.tmdb-score-card>div{display:flex;align-items:baseline;margin-top:5px}.tmdb-score-card strong{color:var(--accent);font:500 31px Georgia,serif;text-shadow:0 2px 14px color-mix(in srgb,var(--accent) 28%,transparent)}.tmdb-score-card small{margin-left:3px;color:rgba(255,248,239,.62);font-size:9px}.tmdb-score-card p{display:flex;align-items:center;gap:5px;margin:7px 0 0;color:rgba(255,248,239,.7);font-size:8px}.tmdb-score-card p svg{color:var(--accent)}.trailer-card{display:flex;align-items:center;gap:10px;color:#f8f0e6;text-align:left}.trailer-card:disabled{color:rgba(247,241,232,.48)}.trailer-card i{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;color:var(--accent);border:1px solid var(--accent);border-radius:50%}.trailer-card span,.trailer-card strong,.trailer-card small{display:block}.trailer-card strong{font-size:11px}.trailer-card small{margin-top:5px;color:rgba(247,241,232,.58);font-size:8px;line-height:1.35}
.quick-facts{display:flex;align-items:center;gap:0;overflow-x:auto;padding:12px 5px;color:rgba(247,241,232,.59);border:1px solid rgba(255,255,255,.085);border-radius:16px;background:rgba(255,255,255,.025);scrollbar-width:none}.quick-facts span{display:flex;align-items:center;flex:0 0 auto;gap:5px;padding:0 11px;font-size:8px;white-space:nowrap}.quick-facts span+span{border-left:1px solid rgba(255,255,255,.1)}.quick-facts svg{color:rgba(247,241,232,.72)}
.detail-panel{position:relative;overflow:hidden;padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 13px 28px rgba(0,0,0,.12);backdrop-filter:blur(15px) saturate(1.15)}.detail-panel h2{margin:0;color:#fbf3e9;font:500 17px Georgia,'Songti SC',serif}.section-heading{display:flex;align-items:center;justify-content:space-between}.section-heading small{color:rgba(247,241,232,.32);font-size:8px}.synopsis-panel p{display:-webkit-box;overflow:hidden;margin:13px 0 0;color:rgba(247,241,232,.65);font-size:10px;line-height:1.85;-webkit-box-orient:vertical;-webkit-line-clamp:4}.synopsis-panel p.expanded{display:block}.text-action{display:flex;align-items:center;gap:2px;margin:10px 0 0 auto;padding:0;color:var(--accent);border:0;background:transparent;font-size:9px;font-weight:750}.text-action svg{transition:transform .25s}.text-action svg.rotated{transform:rotate(180deg)}
.people-panel{padding-right:0}.people-panel .section-heading{padding-right:18px}.people-rail{display:flex;gap:9px;overflow-x:auto;margin-top:13px;padding:0 18px 8px 0;scrollbar-width:none;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;touch-action:pan-x}.people-rail::-webkit-scrollbar{display:none}.person-card{flex:0 0 72px;min-width:0;scroll-snap-align:start}.person-photo{display:grid;place-items:center;width:72px;height:84px;color:rgba(247,241,232,.28);border-radius:14px;background:rgba(255,255,255,.05) center/cover no-repeat}.person-card strong,.person-card span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.person-card strong{margin-top:7px;color:rgba(247,241,232,.84);font-size:9px}.person-card span{margin-top:3px;color:var(--accent);font-size:7px}
.record-grid{display:grid;grid-template-columns:repeat(2,1fr);margin-top:15px}.record-grid>div{padding:0 12px}.record-grid>div:first-child{padding-left:0}.record-grid>div+div{border-left:1px solid rgba(255,255,255,.12)}.record-grid span,.record-grid strong{display:block}.record-grid span{color:rgba(247,241,232,.45);font-size:8px}.record-grid strong{margin-top:6px;color:var(--accent);font:500 18px Georgia,'Songti SC',serif}.record-grid strong small{font-size:8px}.record-grid>div+div strong{color:rgba(247,241,232,.82);font-size:12px}.record-panel blockquote{margin:15px 0 0;padding-top:13px;color:rgba(247,241,232,.62);border-top:1px solid rgba(255,255,255,.08);font:11px/1.65 Georgia,'Songti SC',serif}.detail-end{padding:9px 0 2px;color:rgba(247,241,232,.23);font-size:8px;text-align:center}
.detail-dock{position:absolute;z-index:6;right:0;bottom:22px;left:0;height:60px;pointer-events:none}.detail-dock button{pointer-events:auto}.edit-dock{position:absolute;top:3px;left:-1px;display:grid;place-items:center;width:61px;height:54px;padding:0 5px 0 8px;overflow:hidden;color:var(--accent);border:0;border-radius:0 21px 21px 0;background:#1b1c1f;box-shadow:8px 12px 23px rgba(18,19,22,.28);transition:width .42s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),background .25s}.edit-dock::before{content:'';position:absolute;top:8px;bottom:8px;left:0;width:4px;border-radius:0 6px 6px 0;background:rgba(255,255,255,.72)}.edit-dock:hover{width:66px;background:#292a2e}.edit-dock:active{transform:translateX(-3px) scale(.97)}.watch-island{position:absolute;top:0;right:20px;display:grid;align-items:center;width:116px;height:59px;padding:5px 7px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:23px;background:rgba(23,24,27,.93);box-shadow:0 13px 25px rgba(0,0,0,.25);backdrop-filter:blur(20px);pointer-events:auto}.watch-toggle{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;height:43px;padding:0;color:rgba(255,255,255,.65);border:0;border-radius:17px;background:transparent;font-size:9px;font-weight:750;transition:color .25s,background .3s,box-shadow .3s,transform .2s}.watch-toggle:not(.watched){color:#fff8ee;border:1px solid color-mix(in srgb,var(--accent) 58%,rgba(255,255,255,.22));background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 19%,rgba(255,255,255,.07)),rgba(255,255,255,.045));box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 5px 13px rgba(0,0,0,.2)}.watch-toggle:not(.watched)::before{content:'';width:6px;height:6px;border:2px solid var(--accent);border-radius:50%;box-shadow:0 0 10px color-mix(in srgb,var(--accent) 55%,transparent)}.watch-toggle.watched{color:#1b1c1f;background:#f5f1e9;box-shadow:0 6px 15px rgba(0,0,0,.22)}.watch-toggle:active{transform:scale(.93)}
.record-editor-backdrop{position:absolute;z-index:12;inset:0;display:flex;align-items:end;background:rgba(2,7,7,.48);backdrop-filter:blur(7px)}.record-editor-sheet{width:100%;padding:11px 20px 22px;border:1px solid rgba(255,255,255,.18);border-bottom:0;border-radius:28px 28px 0 0;background:linear-gradient(165deg,rgba(28,36,35,.98),rgba(7,15,14,.99));box-shadow:0 -22px 54px rgba(0,0,0,.42)}.record-editor-handle{width:38px;height:4px;margin:0 auto 16px;border-radius:999px;background:rgba(255,255,255,.2)}.record-editor-sheet header{display:flex;align-items:center;justify-content:space-between}.record-editor-sheet header small{color:var(--accent);font-size:7px;font-weight:800;letter-spacing:.16em}.record-editor-sheet header h2{margin:4px 0 0;font:500 23px Georgia,'Songti SC',serif}.record-editor-sheet header button{display:grid;place-items:center;width:36px;height:36px;padding:0;color:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.045)}.rating-editor{margin-top:21px;padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:19px;background:rgba(255,255,255,.035)}.editor-label{display:flex;align-items:center;justify-content:space-between}.editor-label span,.record-field>span{color:rgba(247,241,232,.55);font-size:9px;font-weight:700}.editor-label strong{color:var(--accent);font:500 20px Georgia,serif}.editor-label strong small{font-size:8px}.rating-stars{position:relative;display:flex;justify-content:space-between;margin-top:12px}.rating-stars>button{display:grid;place-items:center;width:42px;height:42px;padding:0;color:rgba(255,255,255,.17);border:0;background:transparent;transition:color .2s,transform .24s cubic-bezier(.16,1,.3,1)}.rating-stars>button.selected{color:var(--accent)}.rating-stars>button:active{transform:scale(.74) rotate(-8deg)}.star-burst{position:absolute;top:50%;left:50%;width:1px;height:1px;color:var(--accent);pointer-events:none}.star-burst svg{position:absolute;top:-5px;left:-5px;animation:star-particle .72s cubic-bezier(.12,.78,.24,1) both}.star-burst svg:nth-child(1){--x:0px;--y:-64px}.star-burst svg:nth-child(2){--x:34px;--y:-53px}.star-burst svg:nth-child(3){--x:59px;--y:-27px}.star-burst svg:nth-child(4){--x:68px;--y:5px}.star-burst svg:nth-child(5){--x:52px;--y:38px}.star-burst svg:nth-child(6){--x:26px;--y:57px}.star-burst svg:nth-child(7){--x:-8px;--y:64px}.star-burst svg:nth-child(8){--x:-40px;--y:50px}.star-burst svg:nth-child(9){--x:-62px;--y:24px}.star-burst svg:nth-child(10){--x:-68px;--y:-8px}.star-burst svg:nth-child(11){--x:-48px;--y:-42px}.star-burst svg:nth-child(12){--x:-22px;--y:-59px}.record-field{display:grid;gap:8px;margin-top:15px}.record-field input,.record-field textarea{width:100%;box-sizing:border-box;padding:12px 13px;color:#f8f1e8;border:1px solid rgba(255,255,255,.11);border-radius:14px;outline:0;background:rgba(255,255,255,.045);font:10px/1.55 inherit;transition:border-color .2s,background .2s}.record-field input{height:43px;color-scheme:dark}.record-field textarea{resize:none}.record-field input:focus,.record-field textarea:focus{border-color:color-mix(in srgb,var(--accent) 58%,transparent);background:rgba(255,255,255,.065)}.record-save{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:48px;margin-top:18px;color:#171a19;border:0;border-radius:16px;background:var(--accent);font-size:10px;font-weight:850;box-shadow:0 11px 24px color-mix(in srgb,var(--accent) 19%,transparent)}.record-editor-enter-active,.record-editor-leave-active{transition:opacity .28s ease}.record-editor-enter-active .record-editor-sheet{animation:record-sheet-up .48s cubic-bezier(.16,1,.3,1) both}.record-editor-leave-active .record-editor-sheet{animation:record-sheet-down .3s ease-in both}.record-editor-enter-from,.record-editor-leave-to{opacity:0}
@keyframes star-particle{0%{opacity:1;transform:translate(0,0) rotate(0) scale(.45)}68%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(240deg) scale(1)}}@keyframes record-sheet-up{from{transform:translateY(105%)}to{transform:translateY(0)}}@keyframes record-sheet-down{to{transform:translateY(105%)}}@keyframes loading-spin{to{transform:rotate(360deg)}}@keyframes detail-unfold{0%{opacity:.58;clip-path:inset(15% 11% 48% 11% round 24px);transform:translateY(-28px) scale(.95)}48%{opacity:1;clip-path:inset(3% 3% 24% 3% round 15px);transform:translateY(-4px) scale(.992)}100%{opacity:1;clip-path:inset(0 round 0);transform:translateY(0) scale(1)}}
@keyframes backdrop-open{from{background-position:center 30%;transform:scale(1.13) translateY(-12px);filter:saturate(1.1)}to{background-position:center 20%;transform:scale(calc(1.035 + var(--scroll) * .018)) translateY(calc(var(--scroll) * -5px));filter:saturate(1)}}@keyframes detail-copy-in{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:translateY(0)}}@keyframes detail-list-in{from{opacity:.35;transform:scale(1.018)}to{opacity:1;transform:scale(1)}}@keyframes detail-return-home{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(10% 9% 35% 9% round 24px);transform:translateY(18px) scale(.96)}100%{opacity:0;clip-path:inset(20% 15% 47% 15% round 28px);transform:translateY(42px) scale(.88)}}@keyframes detail-return-list{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(18% 36% 46% 8% round 20px);transform:translate(-26px,24px) scale(.94)}100%{opacity:0;clip-path:inset(38% 74% 50% 6% round 14px);transform:translate(-54px,38px) scale(.82)}}
@media(max-height:760px){.detail-hero-copy{min-height:385px}.record-editor-sheet{padding-bottom:16px}.rating-editor{margin-top:14px}.record-field{margin-top:11px}}@media(prefers-reduced-motion:reduce){.movie-detail,.detail-backdrop,.detail-hero-copy,.detail-load-state svg,.star-burst svg,.record-editor-sheet{animation:none}.detail-backdrop{transition:none}.reveal-section{opacity:1;filter:none;transform:none;transition:none}}
.tmdb-score-card,.trailer-card{border-color:rgba(255,255,255,calc(.14 + var(--scroll) * .08));background:linear-gradient(145deg,rgba(255,255,255,calc(.075 - var(--scroll) * .025)),rgba(7,16,15,calc(.16 + var(--scroll) * .68)));box-shadow:inset 0 1px 0 rgba(255,255,255,calc(.16 + var(--scroll) * .04)),0 10px 24px rgba(0,0,0,calc(.12 + var(--scroll) * .16));backdrop-filter:blur(calc(14px + var(--scroll) * 8px)) saturate(calc(1.18 + var(--scroll) * .12));transition:background .28s ease,border-color .28s ease,box-shadow .28s ease,backdrop-filter .28s ease}.tmdb-score-card{border-color:color-mix(in srgb,var(--accent) calc(32% + var(--scroll) * 12%),rgba(255,255,255,.17));background:linear-gradient(145deg,rgba(255,255,255,calc(.08 - var(--scroll) * .03)),rgba(7,18,18,calc(.2 + var(--scroll) * .66)));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(0,0,0,calc(.14 + var(--scroll) * .16));backdrop-filter:blur(calc(16px + var(--scroll) * 7px)) saturate(calc(1.2 + var(--scroll) * .1))}.quick-facts{color:rgba(247,241,232,calc(.66 + var(--scroll) * .18));border-color:rgba(255,255,255,calc(.1 + var(--scroll) * .1));background:linear-gradient(145deg,rgba(255,255,255,calc(.045 - var(--scroll) * .015)),rgba(7,16,15,calc(.13 + var(--scroll) * .7)));box-shadow:inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(calc(13px + var(--scroll) * 8px)) saturate(1.18);transition:color .28s ease,background .28s ease,border-color .28s ease,backdrop-filter .28s ease}.detail-panel{border-color:rgba(255,255,255,calc(.13 + var(--scroll) * .08));background:linear-gradient(145deg,rgba(255,255,255,calc(.07 - var(--scroll) * .025)),rgba(7,16,15,calc(.14 + var(--scroll) * .72)));box-shadow:inset 0 1px 0 rgba(255,255,255,calc(.12 + var(--scroll) * .04)),0 13px 28px rgba(0,0,0,calc(.1 + var(--scroll) * .2));backdrop-filter:blur(calc(15px + var(--scroll) * 9px)) saturate(calc(1.16 + var(--scroll) * .1));transition:background .3s ease,border-color .3s ease,box-shadow .3s ease,backdrop-filter .3s ease}
.movie-detail{translate:none}.movie-detail.has-swipe-transition{transition:none}.detail-backdrop,.detail-topbar,.detail-scroll{translate:var(--swipe-x) 0;will-change:translate}.movie-detail.has-swipe-transition .detail-topbar,.movie-detail.has-swipe-transition .detail-scroll{transition:translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease}.movie-detail.has-swipe-transition .detail-backdrop{transition:height .3s cubic-bezier(.22,.61,.36,1),transform .26s ease-out,translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease}.movie-detail.is-swipe-dragging .detail-backdrop,.movie-detail.is-swipe-dragging .detail-topbar,.movie-detail.is-swipe-dragging .detail-scroll{transition:none}.movie-detail.is-switching{opacity:1}.movie-detail.is-switching .detail-backdrop,.movie-detail.is-switching .detail-topbar,.movie-detail.is-switching .detail-scroll{opacity:.82}
.detail-title-row{display:flex;align-items:end;justify-content:space-between;gap:12px}.detail-title-row h1{min-width:0;animation:title-rise .7s cubic-bezier(.16,1,.3,1) .09s both}.release-chip{display:flex;align-items:center;flex:0 0 auto;gap:4px;max-width:112px;padding:6px 8px;color:rgba(255,248,239,.82);border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(7,16,15,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(14px);font-size:8px;white-space:nowrap;animation:title-rise .68s cubic-bezier(.16,1,.3,1) .18s both}.detail-original{animation:title-rise .62s cubic-bezier(.16,1,.3,1) .03s both}.detail-meta{animation:title-rise .66s cubic-bezier(.16,1,.3,1) .26s both}
.score-actions .tmdb-score-card,.score-actions .trailer-card{min-width:0;min-height:108px}.score-actions .trailer-card{padding:13px;gap:8px}.score-actions .trailer-card i{flex-basis:38px;width:38px;height:38px}.score-actions .trailer-card:disabled{opacity:.76}.quick-facts span{flex:1 0 auto;justify-content:center}
.people-rail,.stills-rail{-webkit-overflow-scrolling:touch}.people-rail{pointer-events:auto;cursor:grab}.people-rail:active{cursor:grabbing}.stills-panel{padding-right:0}.stills-panel .section-heading{padding-right:18px}.stills-rail{display:flex;gap:10px;overflow-x:auto;margin-top:14px;padding:0 18px 8px 0;scrollbar-width:none;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;touch-action:pan-x;pointer-events:auto}.stills-rail::-webkit-scrollbar{display:none}.stills-rail figure{position:relative;flex:0 0 78%;height:150px;margin:0;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04) center/cover no-repeat;box-shadow:0 10px 24px rgba(0,0,0,.22);scroll-snap-align:start}.stills-rail figure::after{content:'';position:absolute;inset:45% 0 0;background:linear-gradient(transparent,rgba(4,10,10,.58))}.stills-rail figure span{position:absolute;z-index:1;right:10px;bottom:8px;color:rgba(255,255,255,.78);font:8px Georgia,serif;letter-spacing:.12em}
@keyframes title-rise{from{opacity:0;filter:blur(6px);transform:translateY(20px)}to{opacity:1;filter:blur(0);transform:translateY(0)}}
@media(max-width:390px){.detail-title-row{align-items:start;flex-direction:column;gap:9px}.release-chip{order:-1}.score-actions{grid-template-columns:1fr 1fr}.score-actions .trailer-card{gap:6px}.score-actions .trailer-card i{flex-basis:34px;width:34px;height:34px}}
</style>
