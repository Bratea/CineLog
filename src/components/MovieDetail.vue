<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import NoticeStack from './NoticeStack.vue'
import ImageViewer from './ImageViewer.vue'
import DatePickerDialog from './DatePickerDialog.vue'
import PersonDetailModal from './PersonDetailModal.vue'

const props = defineProps({
  movie: { type: Object, required: true },
  entryMode: { type: String, default: 'home' },
  motionIntensity: { type: String, default: 'high' },
  imageBase: { type: String, default: 'https://image.tmdb.org/t/p' },
  previewMode: { type: Boolean, default: false },
  layoutOrder: { type: Array, default: () => ['tagline', 'score', 'trailer', 'facts', 'synopsis', 'people', 'record', 'info', 'production', 'releases', 'videos', 'posters', 'collection', 'stills'] },
})
const emit = defineEmits(['back', 'navigate', 'update-watched', 'update-record', 'request-person', 'preview-movie', 'request-save'])
const allowPageSwipe = computed(() => !props.previewMode && !Capacitor.isNativePlatform())

const liked = ref(false)
const overviewExpanded = ref(false)
const filmInfoExpanded = ref(false)
const releasesExpanded = ref(false)
const productionExpanded = ref(false)
const videosExpanded = ref(false)
const swipeStart = ref(null)
const swipeAxis = ref(null)
const isSwipeDragging = ref(false)
const swipeTransition = ref(true)
const isSwitching = ref(false)
const switchDirection = ref(0)
const isReturning = ref(false)
const editOpen = ref(false)
const draftRating = ref(0)
const draftDate = ref('')
const draftReview = ref('')
const draftRewatchTag = ref('')
const recordDatePickerOpen = ref(false)
const ratingBurst = ref(false)
const ratingBurstKey = ref(0)
const detailScroll = ref(null)
const detailRoot = ref(null)
const viewerImage = ref(null)
type DetailNotice = { id: number; title: string; message?: string; tone?: string }
const detailNotices = ref<DetailNotice[]>([])
const selectedPerson = ref(null)

let switchTimer
let backTimer
let burstTimer
let revealObserver
let detailNoticeSequence = 0
const detailNoticeTimers = new Map<number, number>()
let scrollFrame = 0
let swipeFrame = 0
let pendingScrollProgress = 0
let pendingSwipeOffset = 0
let suppressClickUntil = 0

const imageUrl = (path, size = 'original') => {
  if (!path) return ''
  return path.startsWith('http') ? path : `${props.imageBase.replace(/\/$/, '')}/${size}${path}`
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
const heroPosterUrl = computed(() => imageUrl(props.movie.posterUrl || props.movie.poster_path, 'w500'))
const visibleReleases = computed(() => releasesExpanded.value ? (props.movie.releases || []) : (props.movie.releases || []).slice(0, 2))
const visibleCrew = computed(() => productionExpanded.value ? (props.movie.crew || []) : (props.movie.crew || []).slice(0, 2))
const visibleCompanies = computed(() => productionExpanded.value ? (props.movie.productionCompanies || []) : (props.movie.productionCompanies || []).slice(0, 2))
const visibleVideos = computed(() => videosExpanded.value ? (props.movie.videos || []) : (props.movie.videos || []).slice(0, 2))
const canExpandProduction = computed(() => (props.movie.crew?.length || 0) > 2 || (props.movie.productionCompanies?.length || 0) > 2)
const visibleKeywords = computed(() => filmInfoExpanded.value ? (props.movie.keywords || []) : (props.movie.keywords || []).slice(0, 4))
const canExpandFilmInfo = computed(() => Boolean(
  props.movie.filmInfo?.languages?.length
  || props.movie.filmInfo?.status
  || (props.movie.keywords?.length || 0) > 4,
))
const releaseTypeLabel = (type) => ({ 1: '首映', 2: '院线（有限）', 3: '院线上映', 4: '数字发行', 5: '实体发行', 6: '电视播出' })[type] || '上映'
const moduleOrder = (id) => {
  const index = props.layoutOrder.indexOf(id)
  return index < 0 ? 50 : index + 1
}
const isModuleVisible = (id) => props.layoutOrder.includes(id)

function setScrollProgress(value, immediate = false) {
  pendingScrollProgress = value
  const write = () => {
    scrollFrame = 0
    detailRoot.value?.style.setProperty('--scroll', String(pendingScrollProgress))
  }
  if (immediate) {
    window.cancelAnimationFrame(scrollFrame)
    write()
  } else if (!scrollFrame) scrollFrame = window.requestAnimationFrame(write)
}

function setSwipeOffset(value, immediate = false) {
  pendingSwipeOffset = value
  const write = () => {
    swipeFrame = 0
    detailRoot.value?.style.setProperty('--swipe-x', `${pendingSwipeOffset}px`)
  }
  if (immediate) {
    window.cancelAnimationFrame(swipeFrame)
    write()
  } else if (!swipeFrame) swipeFrame = window.requestAnimationFrame(write)
}

function handleScroll(event) {
  const rawProgress = Math.min(1, event.currentTarget.scrollTop / 360)
  setScrollProgress(rawProgress * rawProgress * (3 - 2 * rawProgress))
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
  }, { root, threshold: 0.04, rootMargin: '0px 0px 14% 0px' })
  const rootRect = root.getBoundingClientRect()
  targets.forEach((section) => {
    const rect = section.getBoundingClientRect()
    if (rect.top < rootRect.bottom + 72 && rect.bottom > rootRect.top - 24) section.classList.add('is-visible')
    else revealObserver.observe(section)
  })
}

function setWatched(value) {
  emit('update-watched', value)
}

function dismissDetailNotice(id: number) {
  const index = detailNotices.value.findIndex((notice) => notice.id === id)
  if (index >= 0) detailNotices.value.splice(index, 1)
  const timer = detailNoticeTimers.get(id)
  if (timer) window.clearTimeout(timer)
  detailNoticeTimers.delete(id)
}

function clearDetailNotices() {
  detailNoticeTimers.forEach((timer) => window.clearTimeout(timer))
  detailNoticeTimers.clear()
  detailNotices.value = []
}

function pushDetailNotice(notice: Omit<DetailNotice, 'id'>, duration = 1800) {
  const item = { ...notice, id: ++detailNoticeSequence }
  const limit = props.motionIntensity === 'high' ? 5 : 3
  detailNotices.value = [item, ...detailNotices.value].slice(0, limit)
  const timer = window.setTimeout(() => dismissDetailNotice(item.id), duration)
  detailNoticeTimers.set(item.id, timer)
}

function toggleWatched() {
  const watched = !props.movie.watched
  setWatched(watched)
  pushDetailNotice({
    title: watched ? '已设为已观看' : '已设为未观看',
    message: `《${props.movie.title}》的观看状态已更新`,
    tone: 'success',
  }, 1800)
}

function toggleLiked() {
  liked.value = !liked.value
  props.movie.favourite = liked.value
  pushDetailNotice({ title: liked.value ? '已加入我的喜欢' : '已取消喜欢', message: `《${props.movie.title}》已更新`, tone: 'success' }, 1700)
}

function openImage(src, title, fit = 'contain', images = [], initialIndex = 0) {
  if (!src) return
  clearDetailNotices()
  viewerImage.value = { src, title, alt: title, fit, images, initialIndex }
}

const posterViewerPaths = computed(() => {
  const hero = props.movie.posterUrl || props.movie.poster_path
  const supplied = (props.movie.posters || []).map((poster) => typeof poster === 'string' ? poster : poster?.file_path).filter(Boolean)
  return [...new Set([hero, ...supplied].filter(Boolean))]
})
const posterViewerImages = computed(() => posterViewerPaths.value.map((path, index) => ({ src: imageUrl(path), title: `${props.movie.title} · 海报 ${String(index + 1).padStart(2, '0')}`, alt: `${props.movie.title}海报${index + 1}`, fit: 'contain' })))
const stillViewerImages = computed(() => movieStills.value.map((still, index) => ({ src: imageUrl(still), title: `${props.movie.title} · 剧照 ${String(index + 1).padStart(2, '0')}`, alt: `${props.movie.title}剧照${index + 1}`, fit: 'contain' })))
const posterViewerIndex = (path) => Math.max(0, posterViewerPaths.value.indexOf(path))

function openRecordEditor() {
  draftRating.value = personalScore.value || 0
  draftDate.value = props.movie.watchedDate || ''
  draftReview.value = props.movie.feeling || ''
  draftRewatchTag.value = props.movie.rewatchTag || ''
  recordDatePickerOpen.value = false
  editOpen.value = true
}

function openPerson(person) {
  selectedPerson.value = person
  emit('request-person', person)
}

function previewMovie(movie) {
  selectedPerson.value = null
  emit('preview-movie', movie)
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
    rewatchTag: draftRewatchTag.value,
  })
  editOpen.value = false
}

function openTrailer() {
  if (trailerUrl.value) window.open(trailerUrl.value, '_blank', 'noopener,noreferrer')
}

function openExternal(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

function detailPointerDown(event) {
  if (!allowPageSwipe.value) return
  if (isSwitching.value || isReturning.value || event.target.closest('input, textarea, select, .detail-topbar, .detail-dock, .people-rail, .stills-rail, .poster-rail, .company-rail, .collection-parts')) return
  swipeStart.value = { x: event.clientX, y: event.clientY }
  swipeAxis.value = null
  swipeTransition.value = false
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function detailPointerMove(event) {
  if (!allowPageSwipe.value) return
  if (!swipeStart.value) return
  const deltaX = event.clientX - swipeStart.value.x
  const deltaY = event.clientY - swipeStart.value.y
  if (!swipeAxis.value && Math.hypot(deltaX, deltaY) > 8) {
    swipeAxis.value = Math.abs(deltaX) > Math.abs(deltaY) * 1.12 ? 'horizontal' : 'vertical'
    isSwipeDragging.value = swipeAxis.value === 'horizontal'
  }
  if (swipeAxis.value === 'horizontal') {
    event.preventDefault()
    setSwipeOffset(Math.max(-150, Math.min(150, deltaX * .82)))
  }
}

function detailPointerUp(event) {
  if (!allowPageSwipe.value) return
  if (!swipeStart.value) return
  const deltaX = event.clientX - swipeStart.value.x
  if (swipeAxis.value === 'horizontal') suppressClickUntil = Date.now() + 420
  if (swipeAxis.value === 'horizontal' && Math.abs(deltaX) > 46) switchMovie(deltaX < 0 ? 1 : -1)
  else {
    swipeTransition.value = true
    setSwipeOffset(0)
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
  setSwipeOffset(0)
}

function switchMovie(direction) {
  if (props.previewMode || isSwitching.value) return
  switchDirection.value = direction
  isSwitching.value = true
  swipeTransition.value = true
  const distance = props.motionIntensity === 'high' ? 460 : props.motionIntensity === 'medium' ? 330 : 190
  const duration = props.motionIntensity === 'high' ? 270 : props.motionIntensity === 'medium' ? 220 : 140
  setSwipeOffset(direction > 0 ? -distance : distance)
  switchTimer = window.setTimeout(() => emit('navigate', direction), duration)
}

function requestBack() {
  if (isReturning.value) return
  isReturning.value = true
  const duration = props.motionIntensity === 'high' ? 520 : props.motionIntensity === 'medium' ? 360 : 190
  backTimer = window.setTimeout(() => emit('back'), duration)
}

function suppressSwipeClick(event) {
  if (Date.now() >= suppressClickUntil) return
  event.preventDefault()
  event.stopPropagation()
}

function handleBackNavigation() {
  cancelDetailSwipe()
  if (recordDatePickerOpen.value) {
    recordDatePickerOpen.value = false
    return
  }
  if (viewerImage.value) {
    viewerImage.value = null
    return
  }
  if (selectedPerson.value) {
    selectedPerson.value = null
    return
  }
  if (editOpen.value) {
    editOpen.value = false
    return
  }
  requestBack()
}

defineExpose({ handleBackNavigation })

watch(() => props.movie.id, async () => {
  window.clearTimeout(switchTimer)
  overviewExpanded.value = false
  filmInfoExpanded.value = false
  releasesExpanded.value = false
  productionExpanded.value = false
  videosExpanded.value = false
  viewerImage.value = null
  selectedPerson.value = null
  recordDatePickerOpen.value = false
  clearDetailNotices()
  editOpen.value = false
  isReturning.value = false
  liked.value = Boolean(props.movie.favourite)
  setScrollProgress(0, true)
  swipeTransition.value = false
  const entryDistance = props.motionIntensity === 'high' ? 96 : props.motionIntensity === 'medium' ? 56 : 20
  setSwipeOffset(switchDirection.value > 0 ? entryDistance : -entryDistance, true)
  await nextTick()
  observeRevealSections({ reset: true })
  window.requestAnimationFrame(() => {
    swipeTransition.value = true
    setSwipeOffset(0)
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
  clearDetailNotices()
  window.cancelAnimationFrame(scrollFrame)
  window.cancelAnimationFrame(swipeFrame)
  revealObserver?.disconnect()
})
</script>

<template>
  <article
    ref="detailRoot"
    class="movie-detail"
    :class="[`movie-detail--${movie.poster}`, `entry-${entryMode}`, `motion-${motionIntensity}`, { 'is-preview': previewMode, 'is-swipe-dragging': isSwipeDragging, 'has-swipe-transition': swipeTransition, 'is-switching': isSwitching, 'is-returning': isReturning }]"
    @pointerdown.stop="detailPointerDown"
    @pointermove.stop="detailPointerMove"
    @pointerup.stop="detailPointerUp"
    @pointercancel.stop="cancelDetailSwipe"
    @click.capture="suppressSwipeClick"
  >
    <div class="detail-backdrop" :style="posterStyle"></div>
    <header class="detail-topbar">
      <button aria-label="返回" @click="requestBack"><ArrowLeft :size="21" /></button>
      <div v-if="!previewMode" class="detail-fixed-title"><strong>{{ movie.title }}</strong><small v-if="allowPageSwipe">网页端可左右滑动切换</small></div>
      <button v-if="!previewMode" :class="{ active: liked }" aria-label="收藏" @click="toggleLiked"><Heart :size="20" :fill="liked ? 'currentColor' : 'none'" /></button>
    </header>
    <NoticeStack :notices="detailNotices" placement="detail" :motion="motionIntensity" :duration="1800" closable @dismiss="dismissDetailNotice" />

    <div ref="detailScroll" class="detail-scroll" @scroll.passive="handleScroll">
      <section :key="`hero-${movie.id}`" class="detail-hero-copy">
        <button v-if="heroPosterUrl" class="detail-cover-card" :aria-label="`放大查看${movie.title}电影封面`" @click="openImage(imageUrl(movie.posterUrl || movie.poster_path), `${movie.title}电影封面`, 'contain', posterViewerImages, posterViewerIndex(movie.posterUrl || movie.poster_path))">
          <img :src="heroPosterUrl" :alt="`${movie.title}电影封面`" />
        </button>
        <p class="detail-original">{{ movie.originalTitle }}</p>
        <div class="detail-title-row">
          <h1>{{ movie.title }}</h1>
          <span class="release-chip"><CalendarDays :size="11" />{{ releaseLabel }}</span>
        </div>
        <div class="detail-meta">
          <span>{{ movie.year }}</span><i></i>
          <span>{{ genres.slice(0, 3).join('、') || '类型待补充' }}</span><i></i>
          <span>{{ previewMode ? '未保存' : movie.watched ? '已观看' : '未观看' }}</span>
        </div>
      </section>

      <div :key="`content-${movie.id}`" class="detail-content">
        <p v-if="movie.tagline && isModuleVisible('tagline')" class="detail-tagline detail-module" :style="{ order: moduleOrder('tagline') }">“{{ movie.tagline }}”</p>

        <div v-if="movie.detailState === 'loading'" class="detail-load-state">
          <LoaderCircle :size="15" /><span>正在补全 TMDB 影片资料…</span>
        </div>
        <div v-else-if="movie.detailState === 'error'" class="detail-load-state is-error">
          <span>{{ movie.detailError }}</span>
        </div>

        <section v-if="isModuleVisible('score') || isModuleVisible('trailer')" class="score-actions detail-module reveal-section" :class="{ 'is-single': !isModuleVisible('score') || !isModuleVisible('trailer') }" :style="{ order: Math.min(moduleOrder('score'), moduleOrder('trailer')) }" aria-label="评分与预告片">
          <div v-if="isModuleVisible('score')" class="tmdb-score-card">
            <span>TMDB 评分</span>
            <div><strong>{{ tmdbScore ?? '—' }}</strong><small>/10</small></div>
            <p><Star :size="13" fill="currentColor" />{{ voteLabel }}</p>
          </div>
          <button v-if="isModuleVisible('trailer')" class="trailer-card" :disabled="!trailerUrl" @click="openTrailer">
            <i><Play :size="17" fill="currentColor" /></i>
            <span><strong>{{ trailerUrl ? '预告片' : '预告片链接' }}</strong><small>{{ trailerUrl ? '播放网络视频' : '暂未提供 URL' }}</small></span>
          </button>
        </section>

        <section v-if="isModuleVisible('facts')" class="quick-facts detail-module reveal-section" :style="{ order: moduleOrder('facts') }" aria-label="影片基础资料">
          <span><Clock3 :size="14" />{{ runtimeLabel }}</span>
          <span><Tag :size="14" />{{ movie.certification || genres[0] || '分级待定' }}</span>
        </section>

        <section v-if="isModuleVisible('synopsis')" class="detail-panel synopsis-panel detail-module reveal-section" :style="{ order: moduleOrder('synopsis') }">
          <h2>剧情简介</h2>
          <p :class="{ expanded: overviewExpanded }">{{ movie.overview || '暂无剧情简介。TMDB 详情加载完成后会在这里展示影片介绍。' }}</p>
          <button v-if="canExpandOverview" class="text-action" @click="overviewExpanded = !overviewExpanded">
            {{ overviewExpanded ? '收起' : '展开' }}<ChevronDown :size="14" :class="{ rotated: overviewExpanded }" />
          </button>
        </section>

        <section v-if="people.length && isModuleVisible('people')" class="detail-panel people-panel detail-module reveal-section" :style="{ order: moduleOrder('people') }">
          <div class="section-heading"><h2>主要演职员</h2><small>导演与主演</small></div>
          <div class="people-rail">
            <article v-for="person in people" :key="`${person.id}-${person.role}`" class="person-card">
              <button v-if="person.profile_path" class="person-photo" :style="{ backgroundImage: `url(${imageUrl(person.profile_path, 'w185')})` }" :aria-label="`查看${person.name}演员资料`" @click="openPerson(person)"></button>
              <button v-else class="person-photo" :aria-label="`查看${person.name}演员资料`" @click="openPerson(person)"><UserRound :size="20" /></button>
              <strong>{{ person.name }}</strong>
              <span>{{ person.role }}</span>
            </article>
          </div>
        </section>

        <section v-if="!previewMode && isModuleVisible('record')" class="detail-panel record-panel detail-module reveal-section" :style="{ order: moduleOrder('record') }">
          <div class="section-heading"><h2>我的记录</h2><small>{{ movie.watched ? '观影已完成' : '待看清单' }}</small></div>
          <div class="record-grid">
            <div><span>我的评分</span><strong>{{ personalScore ?? '—' }}<small v-if="personalScore">/10</small></strong></div>
            <div><span>观看日期</span><strong>{{ movie.watchedDate || (movie.watched ? movie.year : '尚未观看') }}</strong></div>
          </div>
          <blockquote>“{{ movie.feeling || (movie.watched ? '还没有写下短评。' : '加入待看清单，留给下一次观影。') }}”</blockquote>
        </section>

        <section v-if="isModuleVisible('info') && (movie.filmInfo || movie.keywords?.length)" class="detail-panel extra-panel detail-module reveal-section" :style="{ order: moduleOrder('info') }">
          <div class="section-heading"><h2>影片资料</h2><small>TMDB FILE</small></div>
          <div class="film-info-grid">
            <div><span>原始语言</span><strong>{{ movie.filmInfo?.originalLanguage?.toUpperCase() || '—' }}</strong></div>
            <div><span>制作国家</span><strong>{{ movie.filmInfo?.countries?.join('、') || '—' }}</strong></div>
            <div v-if="filmInfoExpanded"><span>语言</span><strong>{{ movie.filmInfo?.languages?.join('、') || '—' }}</strong></div>
            <div v-if="filmInfoExpanded"><span>发行状态</span><strong>{{ movie.filmInfo?.status || '—' }}</strong></div>
          </div>
          <div v-if="visibleKeywords.length" class="keyword-cloud"><button v-for="keyword in visibleKeywords" :key="keyword"># {{ keyword }}</button></div>
          <button v-if="canExpandFilmInfo" class="text-action panel-expand" @click="filmInfoExpanded = !filmInfoExpanded">
            {{ filmInfoExpanded ? '收起资料' : '展开资料' }}<ChevronDown :size="14" :class="{ rotated: filmInfoExpanded }" />
          </button>
        </section>

        <section v-if="isModuleVisible('production') && (movie.crew?.length || movie.productionCompanies?.length)" class="detail-panel production-panel detail-module reveal-section" :style="{ order: moduleOrder('production') }">
          <div class="section-heading"><h2>幕后制作</h2><small>CREW</small></div>
          <div v-if="visibleCrew.length" class="crew-list">
            <button v-for="person in visibleCrew" :key="`${person.id}-${person.role}`" @click="openPerson(person)"><span>{{ person.role }}</span><strong>{{ person.name }}</strong></button>
          </div>
          <div v-if="visibleCompanies.length" class="company-rail">
            <article v-for="company in visibleCompanies" :key="company.id"><img v-if="company.logo_path" :src="imageUrl(company.logo_path, 'w185')" :alt="company.name" /><div v-else>{{ company.name.slice(0, 1) }}</div><strong>{{ company.name }}</strong><span>{{ company.country }}</span></article>
          </div>
          <button v-if="canExpandProduction" class="text-action panel-expand" @click="productionExpanded = !productionExpanded">
            {{ productionExpanded ? '收起幕后制作' : '展开全部幕后制作' }}<ChevronDown :size="14" :class="{ rotated: productionExpanded }" />
          </button>
        </section>

        <section v-if="isModuleVisible('releases') && movie.releases?.length" class="detail-panel releases-panel detail-module reveal-section" :style="{ order: moduleOrder('releases') }">
          <div class="section-heading"><h2>地区上映</h2><small>{{ movie.releases.length }} 个地区</small></div>
          <div class="release-list"><article v-for="release in visibleReleases" :key="`${release.country}-${release.date}`"><strong>{{ release.country }}</strong><div><span>{{ release.date || '日期待定' }}</span><small>{{ releaseTypeLabel(release.type) }}<template v-if="release.certification"> · {{ release.certification }}</template></small></div></article></div>
          <button v-if="movie.releases.length > 2" class="text-action panel-expand" @click="releasesExpanded = !releasesExpanded">
            {{ releasesExpanded ? '收起地区' : `展开其余 ${movie.releases.length - 2} 个地区` }}<ChevronDown :size="14" :class="{ rotated: releasesExpanded }" />
          </button>
        </section>

        <section v-if="isModuleVisible('videos') && movie.videos?.length" class="detail-panel videos-panel detail-module reveal-section" :style="{ order: moduleOrder('videos') }">
          <div class="section-heading"><h2>影片视频</h2><small>链接播放</small></div>
          <div class="video-list"><button v-for="video in visibleVideos" :key="video.id" @click="openExternal(video.url)"><i><Play :size="15" fill="currentColor" /></i><span><strong>{{ video.name }}</strong><small>{{ video.type }}<template v-if="video.official"> · 官方</template></small></span></button></div>
          <button v-if="movie.videos.length > 2" class="text-action panel-expand" @click="videosExpanded = !videosExpanded">
            {{ videosExpanded ? '收起影片视频' : `展开其余 ${movie.videos.length - 2} 个视频` }}<ChevronDown :size="14" :class="{ rotated: videosExpanded }" />
          </button>
        </section>

        <section v-if="isModuleVisible('posters') && movie.posters?.length" class="detail-panel posters-panel detail-module reveal-section" :style="{ order: moduleOrder('posters') }">
          <div class="section-heading"><h2>海报画廊</h2><small>点击放大</small></div>
          <div class="poster-rail"><button v-for="(poster, index) in movie.posters" :key="poster.file_path" :aria-label="`放大查看第 ${Number(index) + 1} 张电影海报`" @click="openImage(imageUrl(poster.file_path), `${movie.title} · 海报 ${String(Number(index) + 1).padStart(2, '0')}`, 'contain', posterViewerImages, posterViewerIndex(poster.file_path))"><img :src="imageUrl(poster.file_path, 'w342')" :alt="`${movie.title}海报${Number(index) + 1}`" /><span>{{ poster.language?.toUpperCase() || 'ART' }}</span></button></div>
        </section>

        <section v-if="isModuleVisible('collection') && movie.collection?.parts?.length" class="detail-panel collection-panel detail-module reveal-section" :style="{ order: moduleOrder('collection') }">
          <div class="collection-heading" :style="movie.collection.backdrop_path ? { backgroundImage: `url(${imageUrl(movie.collection.backdrop_path, 'w780')})` } : {}"><div><small>COLLECTION</small><h2>{{ movie.collection.name }}</h2></div></div>
          <p v-if="movie.collection.overview">{{ movie.collection.overview }}</p>
          <div class="collection-parts"><button v-for="part in movie.collection.parts" :key="part.id" type="button" :aria-label="`预览${part.title}`" @click="previewMovie(part)"><img v-if="part.poster_path" :src="imageUrl(part.poster_path, 'w185')" :alt="part.title" /><div v-else></div><strong>{{ part.title }}</strong><span>{{ part.year }}</span></button></div>
        </section>

        <section v-if="isModuleVisible('stills') && movieStills.length" class="detail-panel stills-panel detail-module reveal-section" :style="{ order: moduleOrder('stills') }">
          <div class="section-heading"><h2>电影剧照</h2><small>左右滑动 · 点击放大</small></div>
          <div class="stills-rail" aria-label="电影剧照画廊">
            <button v-for="(still, index) in movieStills" :key="still" :aria-label="`放大查看第 ${index + 1} 张电影剧照`" @click="openImage(imageUrl(still), `${movie.title} · 剧照 ${String(index + 1).padStart(2, '0')}`, 'contain', stillViewerImages, index)">
              <img :src="imageUrl(still, 'w780')" :alt="`${movie.title}剧照${index + 1}`" />
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
            </button>
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

          <div class="record-meta-fields">
            <div class="record-field record-date-field">
              <span>观看日期</span>
              <button type="button" @click="recordDatePickerOpen = true"><CalendarDays :size="14" /><strong>{{ draftDate || '选择日期' }}</strong></button>
            </div>
            <div class="record-field record-tag-field">
              <span>标签</span>
              <div role="group" aria-label="重看标签"><button v-for="tag in ['二刷','三刷']" :key="tag" type="button" :class="{ selected: draftRewatchTag === tag }" @click="draftRewatchTag = draftRewatchTag === tag ? '' : tag">{{ tag }}</button></div>
            </div>
          </div>
          <label class="record-field record-review-field">
            <span>个人评论</span>
            <textarea v-model="draftReview" rows="4" placeholder="写下这次观影留下的感受……"></textarea>
          </label>
          <button class="record-save" @click="saveRecord"><Check :size="16" />保存记录</button>
        </section>
      </div>
    </Transition>
    <DatePickerDialog v-model="draftDate" v-model:open="recordDatePickerOpen" title="选择观看日期" />

    <footer class="detail-dock">
      <button v-if="!previewMode" class="detail-neighbour detail-neighbour--previous" aria-label="上一部" @click="switchMovie(-1)"><ChevronLeft :size="15" /><span>上一个</span></button>
      <button v-if="!previewMode" class="edit-dock" aria-label="编辑我的记录" @click="openRecordEditor"><Pencil :size="24" /></button>
      <button v-if="!previewMode" class="detail-neighbour detail-neighbour--next" aria-label="下一部" @click="switchMovie(1)"><span>下一个</span><ChevronRight :size="15" /></button>
      <div class="watch-island">
        <button class="watch-toggle" :class="{ watched: movie.watched && !previewMode, preview: previewMode }" :aria-label="previewMode ? '当前未保存，点击添加' : `当前${movie.watched ? '已观看' : '未观看'}，点击切换`" @click="previewMode ? emit('request-save') : toggleWatched()">
          <Check v-if="movie.watched && !previewMode" :size="13" /><span>{{ previewMode ? '未保存' : movie.watched ? '已观看' : '未观看' }}</span>
        </button>
      </div>
    </footer>
    <ImageViewer v-if="viewerImage" v-bind="viewerImage" @close="viewerImage = null" />
    <PersonDetailModal v-if="selectedPerson" :person="selectedPerson" :image-src="imageUrl(selectedPerson.profile_path, 'w500')" @close="selectedPerson = null" @preview="previewMovie" />
  </article>
</template>

<style scoped lang="scss">
.movie-detail { --accent:#f2b85b; --screen:#07100f; --scroll:0; --backdrop-clip:46%; --swipe-x:0px; position:absolute; z-index:12; inset:0; overflow:hidden; color:#f7f1e8; background:var(--screen); touch-action:pan-y; translate:var(--swipe-x) 0; transform-origin:50% 72%; will-change:translate,transform; }
.movie-detail.has-swipe-transition { transition:translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease; }
.movie-detail.motion-high { animation:detail-gravity-home .58s cubic-bezier(.16,1,.3,1) both; }
.movie-detail.motion-high.entry-list { transform-origin:14% 72%; animation-name:detail-gravity-list; }
.movie-detail.motion-high.entry-library { transform-origin:100% 50%; animation:detail-library-cover-high .58s cubic-bezier(.16,1,.3,1) both; }
.movie-detail.motion-medium { animation:detail-side-in .46s cubic-bezier(.16,1,.3,1) both; }
.movie-detail.motion-medium.entry-list { animation-name:detail-side-in-list; }
.movie-detail.motion-medium.entry-library { animation:detail-library-cover-medium .44s cubic-bezier(.2,.8,.2,1) both; }
.movie-detail.motion-low { animation:detail-low-in .22s ease-out both; }
.movie-detail.motion-low.entry-library { animation:detail-library-cover-low .22s ease-out both; }
.movie-detail.is-swipe-dragging { transition:none; }.movie-detail.is-switching{opacity:.92}.movie-detail.is-returning{pointer-events:none}
.movie-detail.motion-high.is-returning{animation:detail-gravity-return-home .52s cubic-bezier(.55,.04,.82,.32) both!important}.movie-detail.motion-high.entry-list.is-returning{animation-name:detail-gravity-return-list!important}
.movie-detail.motion-high.entry-library.is-returning{animation:detail-library-return-high .46s cubic-bezier(.55,.04,.82,.32) both!important}
.movie-detail.motion-medium.is-returning{animation:detail-side-return .36s ease-in both!important}.movie-detail.motion-medium.entry-list.is-returning{animation-name:detail-side-return-list!important}
.movie-detail.motion-medium.entry-library.is-returning{animation:detail-library-return-medium .34s ease-in both!important}
.movie-detail.motion-low.is-returning{animation:detail-low-return .19s ease-in both!important}
.movie-detail.motion-low.entry-library.is-returning{animation:detail-library-return-low .18s ease-in both!important}
.movie-detail.motion-high .detail-topbar{animation:detail-topbar-high-in .64s cubic-bezier(.16,1,.3,1) .12s both}
.movie-detail.motion-high .detail-dock{animation:detail-dock-high-in .68s cubic-bezier(.16,1,.3,1) .22s both}
.movie-detail.motion-medium .detail-backdrop{animation:backdrop-medium-open .44s cubic-bezier(.16,1,.3,1) both}
.movie-detail.motion-medium .detail-hero-copy{animation:detail-copy-medium-in .4s cubic-bezier(.16,1,.3,1) .04s both}
.movie-detail.motion-medium .detail-cover-card{animation:title-rise-medium .36s cubic-bezier(.16,1,.3,1) .03s both}
.movie-detail.motion-medium :is(.detail-original,.detail-hero-copy h1){animation:title-rise-medium .34s cubic-bezier(.16,1,.3,1) .07s both}
.movie-detail.motion-medium .release-chip{animation:title-rise-medium .34s cubic-bezier(.16,1,.3,1) .11s both}
.movie-detail.motion-medium .detail-meta{animation:title-rise-medium .34s cubic-bezier(.16,1,.3,1) .15s both}
.movie-detail.motion-medium .detail-topbar{animation:detail-topbar-medium-in .38s cubic-bezier(.16,1,.3,1) .03s both}
.movie-detail.motion-medium .detail-dock{animation:detail-dock-medium-in .4s cubic-bezier(.16,1,.3,1) .1s both}
.movie-detail.motion-medium .reveal-section{filter:none;transform:translateY(20px) scale(.99);transition:opacity .36s ease var(--reveal-delay),transform .48s cubic-bezier(.16,1,.3,1) var(--reveal-delay)}
.movie-detail.motion-medium .reveal-section.is-visible{transform:none}
.movie-detail.motion-low :is(.detail-backdrop,.detail-hero-copy,.detail-cover-card,.detail-hero-copy h1,.release-chip,.detail-original,.detail-meta,.detail-topbar,.detail-dock,.still-main){animation:none}
.movie-detail.motion-low .reveal-section{opacity:1;filter:none;transform:none;transition:none}
.movie-detail.motion-low .detail-backdrop{transition:transform .16s ease-out}
.movie-detail--pop{--accent:#efaa74}.movie-detail--crayon{--accent:#ffd06c}.movie-detail--coco{--accent:#df9e72}
.detail-backdrop{position:absolute;inset:0 auto auto 0;width:100%;height:100%;clip-path:inset(0 0 var(--backdrop-clip) 0);contain:paint;background-size:cover;background-position:center 20%;opacity:1;transform:scale(calc(1.035 + var(--scroll) * .018)) translateY(calc(var(--scroll) * -5px));transform-origin:50% 0;transition:transform .2s ease-out;will-change:clip-path,transform;animation:backdrop-open .72s cubic-bezier(.18,.88,.2,1) both}.detail-backdrop::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 0 40%,rgba(7,16,15,.2) 61%,rgba(7,16,15,.84) 84%,var(--screen) 100%)}
.detail-topbar{position:absolute;z-index:5;top:24px;right:18px;left:18px;display:flex;align-items:center;justify-content:space-between}.detail-topbar button{display:grid;place-items:center;width:42px;height:42px;padding:0;color:#fff7ef;border:1px solid rgba(255,255,255,.35);border-radius:50%;background:rgba(12,18,18,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 20px rgba(0,0,0,.18);backdrop-filter:blur(18px) saturate(1.35)}.detail-topbar button.active{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 55%,transparent)}
.detail-swipe-hint{padding:6px 10px;color:rgba(255,247,239,.58);border:1px solid rgba(255,255,255,.13);border-radius:999px;background:rgba(13,16,18,.18);backdrop-filter:blur(14px);font-size:8px;font-weight:700;letter-spacing:.03em;pointer-events:none}
.detail-scroll{position:absolute;inset:0;padding:0 18px 112px;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}.detail-scroll::-webkit-scrollbar{display:none}.detail-hero-copy{display:flex;min-height:520px;flex-direction:column;justify-content:end;padding:100px 3px 28px;animation:detail-copy-in .72s cubic-bezier(.16,1,.3,1) .2s both}.detail-cover-card{width:106px;aspect-ratio:2/3;margin:0 0 14px;overflow:hidden;border:1px solid rgba(255,255,255,.3);border-radius:17px;background:rgba(4,10,10,.38);box-shadow:0 15px 34px rgba(0,0,0,.34),inset 0 1px rgba(255,255,255,.15);animation:title-rise .62s cubic-bezier(.16,1,.3,1) .04s both}.detail-cover-card img{display:block;width:100%;height:100%;object-fit:contain}.detail-original{margin:0 0 7px;color:rgba(255,247,239,.68);font:11px Georgia,serif;letter-spacing:.04em}.detail-hero-copy h1{max-width:350px;margin:0;font:500 29px/1.18 Georgia,'Songti SC',serif;letter-spacing:-.045em;text-shadow:0 3px 18px rgba(0,0,0,.42)}.detail-meta{display:flex;align-items:center;gap:9px;margin-top:15px;color:rgba(255,247,239,.68);font-size:9px}.detail-meta i{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.45)}
.detail-content{display:grid;gap:18px;padding-bottom:28px}.detail-tagline{margin:0 4px 2px;color:var(--accent);font:13px/1.6 Georgia,'Songti SC',serif}.detail-load-state{display:flex;align-items:center;gap:7px;padding:10px 12px;color:rgba(247,241,232,.66);border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);font-size:9px}.detail-load-state svg{color:var(--accent);animation:loading-spin .9s linear infinite}.detail-load-state.is-error{color:#e7a69a;border-color:rgba(231,166,154,.16)}.reveal-section{--reveal-delay:0ms;opacity:0;filter:blur(7px);transform:translateY(42px) scale(.975);transition:opacity .64s ease var(--reveal-delay),filter .62s ease var(--reveal-delay),transform .82s cubic-bezier(.16,1,.3,1) var(--reveal-delay);will-change:opacity,filter,transform}.reveal-section.is-visible{opacity:1;filter:blur(0);transform:translateY(0) scale(1)}.score-actions{--reveal-delay:20ms}.quick-facts{--reveal-delay:55ms}.synopsis-panel{--reveal-delay:90ms}.people-panel{--reveal-delay:105ms}.record-panel{--reveal-delay:120ms}
.score-actions{display:grid;grid-template-columns:1.15fr .85fr;gap:10px}.tmdb-score-card,.trailer-card{min-height:108px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:19px;background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.02));box-shadow:inset 0 1px 0 rgba(255,255,255,.12)}.tmdb-score-card{position:relative;overflow:hidden;border-color:color-mix(in srgb,var(--accent) 35%,rgba(255,255,255,.17));background:linear-gradient(145deg,rgba(10,21,21,.9),rgba(13,24,24,.68));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(0,0,0,.2);backdrop-filter:blur(18px) saturate(1.2)}.tmdb-score-card::before{content:'';position:absolute;top:0;right:14px;left:14px;height:2px;border-radius:0 0 8px 8px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.7}.tmdb-score-card>span{color:rgba(255,248,239,.78);font-size:9px;font-weight:750;letter-spacing:.02em}.tmdb-score-card>div{display:flex;align-items:baseline;margin-top:5px}.tmdb-score-card strong{color:var(--accent);font:500 31px Georgia,serif;text-shadow:0 2px 14px color-mix(in srgb,var(--accent) 28%,transparent)}.tmdb-score-card small{margin-left:3px;color:rgba(255,248,239,.62);font-size:9px}.tmdb-score-card p{display:flex;align-items:center;gap:5px;margin:7px 0 0;color:rgba(255,248,239,.7);font-size:8px}.tmdb-score-card p svg{color:var(--accent)}.trailer-card{display:flex;align-items:center;gap:10px;color:#f8f0e6;text-align:left}.trailer-card:disabled{color:rgba(247,241,232,.48)}.trailer-card i{display:grid;place-items:center;flex:0 0 40px;width:40px;height:40px;color:var(--accent);border:1px solid var(--accent);border-radius:50%}.trailer-card span,.trailer-card strong,.trailer-card small{display:block}.trailer-card strong{font-size:11px}.trailer-card small{margin-top:5px;color:rgba(247,241,232,.58);font-size:8px;line-height:1.35}
.quick-facts{display:flex;align-items:center;gap:0;overflow-x:auto;padding:12px 5px;color:rgba(247,241,232,.59);border:1px solid rgba(255,255,255,.085);border-radius:16px;background:rgba(255,255,255,.025);scrollbar-width:none}.quick-facts span{display:flex;align-items:center;flex:0 0 auto;gap:5px;padding:0 11px;font-size:8px;white-space:nowrap}.quick-facts span+span{border-left:1px solid rgba(255,255,255,.1)}.quick-facts svg{color:rgba(247,241,232,.72)}
.detail-panel{position:relative;overflow:hidden;padding:18px;border:1px solid rgba(255,255,255,.11);border-radius:21px;background:linear-gradient(145deg,rgba(255,255,255,.052),rgba(255,255,255,.018));box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 13px 28px rgba(0,0,0,.12);backdrop-filter:blur(15px) saturate(1.15)}.detail-panel h2{margin:0;color:#fbf3e9;font:500 17px Georgia,'Songti SC',serif}.section-heading{display:flex;align-items:center;justify-content:space-between}.section-heading small{color:rgba(247,241,232,.32);font-size:8px}.synopsis-panel p{display:-webkit-box;overflow:hidden;margin:13px 0 0;color:rgba(247,241,232,.65);font-size:10px;line-height:1.85;-webkit-box-orient:vertical;-webkit-line-clamp:4}.synopsis-panel p.expanded{display:block}.text-action{display:flex;align-items:center;gap:2px;margin:10px 0 0 auto;padding:0;color:var(--accent);border:0;background:transparent;font-size:9px;font-weight:750}.text-action svg{transition:transform .25s}.text-action svg.rotated{transform:rotate(180deg)}
.people-panel{padding-right:0}.people-panel .section-heading{padding-right:18px}.people-rail{display:flex;gap:9px;overflow-x:auto;margin-top:13px;padding:0 18px 8px 0;scrollbar-width:none;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;touch-action:pan-x}.people-rail::-webkit-scrollbar{display:none}.person-card{flex:0 0 72px;min-width:0;scroll-snap-align:start}.person-photo{display:grid;place-items:center;width:72px;height:84px;color:rgba(247,241,232,.28);border-radius:14px;background:rgba(255,255,255,.05) center/cover no-repeat}.person-card strong,.person-card span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.person-card strong{margin-top:7px;color:rgba(247,241,232,.84);font-size:9px}.person-card span{margin-top:3px;color:var(--accent);font-size:7px}
.record-grid{display:grid;grid-template-columns:repeat(2,1fr);margin-top:15px}.record-grid>div{padding:0 12px}.record-grid>div:first-child{padding-left:0}.record-grid>div+div{border-left:1px solid rgba(255,255,255,.12)}.record-grid span,.record-grid strong{display:block}.record-grid span{color:rgba(247,241,232,.45);font-size:8px}.record-grid strong{margin-top:6px;color:var(--accent);font:500 18px Georgia,'Songti SC',serif}.record-grid strong small{font-size:8px}.record-grid>div+div strong{color:rgba(247,241,232,.82);font-size:12px}.record-panel blockquote{margin:15px 0 0;padding-top:13px;color:rgba(247,241,232,.62);border-top:1px solid rgba(255,255,255,.08);font:11px/1.65 Georgia,'Songti SC',serif}.detail-end{padding:9px 0 2px;color:rgba(247,241,232,.23);font-size:8px;text-align:center}
.detail-dock{position:absolute;z-index:6;right:0;bottom:22px;left:0;height:60px;pointer-events:none}.detail-dock button{pointer-events:auto}.edit-dock{position:absolute;top:3px;left:-1px;display:grid;place-items:center;width:61px;height:54px;padding:0 5px 0 8px;overflow:hidden;color:var(--accent);border:0;border-radius:0 21px 21px 0;background:#1b1c1f;box-shadow:8px 12px 23px rgba(18,19,22,.28);transition:width .42s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),background .25s}.edit-dock::before{content:'';position:absolute;top:8px;bottom:8px;left:0;width:4px;border-radius:0 6px 6px 0;background:rgba(255,255,255,.72)}.edit-dock:hover{width:66px;background:#292a2e}.edit-dock:active{transform:translateX(-3px) scale(.97)}.watch-island{position:absolute;top:0;right:20px;display:grid;align-items:center;width:116px;height:59px;padding:5px 7px;box-sizing:border-box;border:1px solid rgba(255,255,255,.12);border-radius:23px;background:rgba(23,24,27,.93);box-shadow:0 13px 25px rgba(0,0,0,.25);backdrop-filter:blur(20px);pointer-events:auto}.watch-toggle{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;height:43px;padding:0;color:rgba(255,255,255,.65);border:0;border-radius:17px;background:transparent;font-size:9px;font-weight:750;transition:color .25s,background .3s,box-shadow .3s,transform .2s}.watch-toggle:not(.watched){color:#fff8ee;border:1px solid color-mix(in srgb,var(--accent) 58%,rgba(255,255,255,.22));background:linear-gradient(145deg,color-mix(in srgb,var(--accent) 19%,rgba(255,255,255,.07)),rgba(255,255,255,.045));box-shadow:inset 0 1px 0 rgba(255,255,255,.15),0 5px 13px rgba(0,0,0,.2)}.watch-toggle:not(.watched)::before{content:'';width:6px;height:6px;border:2px solid var(--accent);border-radius:50%;box-shadow:0 0 10px color-mix(in srgb,var(--accent) 55%,transparent)}.watch-toggle.watched{color:#1b1c1f;background:#f5f1e9;box-shadow:0 6px 15px rgba(0,0,0,.22)}.watch-toggle:active{transform:scale(.93)}
.record-editor-backdrop{position:absolute;z-index:12;inset:0;display:flex;align-items:end;background:rgba(2,7,7,.48);backdrop-filter:blur(7px)}.record-editor-sheet{width:100%;padding:11px 20px 22px;border:1px solid rgba(255,255,255,.18);border-bottom:0;border-radius:28px 28px 0 0;background:linear-gradient(165deg,rgba(28,36,35,.98),rgba(7,15,14,.99));box-shadow:0 -22px 54px rgba(0,0,0,.42)}.record-editor-handle{width:38px;height:4px;margin:0 auto 16px;border-radius:999px;background:rgba(255,255,255,.2)}.record-editor-sheet header{display:flex;align-items:center;justify-content:space-between}.record-editor-sheet header small{color:var(--accent);font-size:7px;font-weight:800;letter-spacing:.16em}.record-editor-sheet header h2{margin:4px 0 0;font:500 23px Georgia,'Songti SC',serif}.record-editor-sheet header button{display:grid;place-items:center;width:36px;height:36px;padding:0;color:rgba(255,255,255,.68);border:1px solid rgba(255,255,255,.12);border-radius:50%;background:rgba(255,255,255,.045)}.rating-editor{margin-top:21px;padding:16px;border:1px solid rgba(255,255,255,.1);border-radius:19px;background:rgba(255,255,255,.035)}.editor-label{display:flex;align-items:center;justify-content:space-between}.editor-label span,.record-field>span{color:rgba(247,241,232,.55);font-size:9px;font-weight:700}.editor-label strong{color:var(--accent);font:500 20px Georgia,serif}.editor-label strong small{font-size:8px}.rating-stars{position:relative;display:flex;justify-content:space-between;margin-top:12px}.rating-stars>button{display:grid;place-items:center;width:42px;height:42px;padding:0;color:rgba(255,255,255,.17);border:0;background:transparent;transition:color .2s,transform .24s cubic-bezier(.16,1,.3,1)}.rating-stars>button.selected{color:var(--accent)}.rating-stars>button:active{transform:scale(.74) rotate(-8deg)}.star-burst{position:absolute;top:50%;left:50%;width:1px;height:1px;color:var(--accent);pointer-events:none}.star-burst svg{position:absolute;top:-5px;left:-5px;animation:star-particle .72s cubic-bezier(.12,.78,.24,1) both}.star-burst svg:nth-child(1){--x:0px;--y:-64px}.star-burst svg:nth-child(2){--x:34px;--y:-53px}.star-burst svg:nth-child(3){--x:59px;--y:-27px}.star-burst svg:nth-child(4){--x:68px;--y:5px}.star-burst svg:nth-child(5){--x:52px;--y:38px}.star-burst svg:nth-child(6){--x:26px;--y:57px}.star-burst svg:nth-child(7){--x:-8px;--y:64px}.star-burst svg:nth-child(8){--x:-40px;--y:50px}.star-burst svg:nth-child(9){--x:-62px;--y:24px}.star-burst svg:nth-child(10){--x:-68px;--y:-8px}.star-burst svg:nth-child(11){--x:-48px;--y:-42px}.star-burst svg:nth-child(12){--x:-22px;--y:-59px}.record-field{display:grid;gap:8px;margin-top:15px}.record-field input,.record-field textarea{width:100%;box-sizing:border-box;padding:12px 13px;color:#f8f1e8;border:1px solid rgba(255,255,255,.11);border-radius:14px;outline:0;background:rgba(255,255,255,.045);font:10px/1.55 inherit;transition:border-color .2s,background .2s}.record-field input{height:43px;color-scheme:dark}.record-field textarea{resize:none}.record-field input:focus,.record-field textarea:focus{border-color:color-mix(in srgb,var(--accent) 58%,transparent);background:rgba(255,255,255,.065)}.record-save{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;height:48px;margin-top:18px;color:#171a19;border:0;border-radius:16px;background:var(--accent);font-size:10px;font-weight:850;box-shadow:0 11px 24px color-mix(in srgb,var(--accent) 19%,transparent)}.record-editor-enter-active,.record-editor-leave-active{transition:opacity .28s ease}.record-editor-enter-active .record-editor-sheet{animation:record-sheet-up .48s cubic-bezier(.16,1,.3,1) both}.record-editor-leave-active .record-editor-sheet{animation:record-sheet-down .3s ease-in both}.record-editor-enter-from,.record-editor-leave-to{opacity:0}
.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet>*{animation:record-editor-piece-high .5s cubic-bezier(.16,1,.3,1) both}.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet>*:nth-child(2){animation-delay:50ms}.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet>*:nth-child(3){animation-delay:90ms}.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet>*:nth-child(n+4){animation-delay:125ms}.movie-detail.motion-medium .record-editor-enter-active,.movie-detail.motion-medium .record-editor-leave-active{transition-duration:.22s}.movie-detail.motion-medium .record-editor-enter-active .record-editor-sheet{animation:record-sheet-medium-up .36s cubic-bezier(.16,1,.3,1) both}.movie-detail.motion-medium .record-editor-leave-active .record-editor-sheet{animation:record-sheet-medium-down .22s ease-in both}.movie-detail.motion-low .record-editor-backdrop{backdrop-filter:blur(1px)}.movie-detail.motion-low .record-editor-enter-active,.movie-detail.motion-low .record-editor-leave-active{transition-duration:.14s}.movie-detail.motion-low .record-editor-enter-active .record-editor-sheet{animation:record-sheet-low-up .17s ease-out both}.movie-detail.motion-low .record-editor-leave-active .record-editor-sheet{animation:record-sheet-low-down .14s ease-in both}.movie-detail.motion-medium .star-burst svg{animation-duration:.48s}.movie-detail.motion-low .star-burst{display:none}
@keyframes star-particle{0%{opacity:1;transform:translate(0,0) rotate(0) scale(.45)}68%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y)) rotate(240deg) scale(1)}}@keyframes record-sheet-up{from{transform:translateY(105%)}to{transform:translateY(0)}}@keyframes record-sheet-down{to{transform:translateY(105%)}}@keyframes loading-spin{to{transform:rotate(360deg)}}@keyframes detail-unfold{0%{opacity:.58;clip-path:inset(15% 11% 48% 11% round 24px);transform:translateY(-28px) scale(.95)}48%{opacity:1;clip-path:inset(3% 3% 24% 3% round 15px);transform:translateY(-4px) scale(.992)}100%{opacity:1;clip-path:inset(0 round 0);transform:translateY(0) scale(1)}}
@keyframes detail-gravity-home{0%{opacity:.28;clip-path:inset(8% 4% 10% 4% round 28px);transform:translate3d(72px,18px,0) rotate(4.2deg) scale(.972)}58%{opacity:1;clip-path:inset(0 round 8px);transform:translate3d(-7px,-2px,0) rotate(-.65deg) scale(1.003)}82%{transform:translate3d(2px,0,0) rotate(.18deg)}100%{opacity:1;clip-path:inset(0 round 0);transform:none}}
@keyframes detail-gravity-list{0%{opacity:.25;clip-path:inset(10% 5% 12% 5% round 26px);transform:translate3d(-68px,22px,0) rotate(-4.5deg) scale(.968)}58%{opacity:1;clip-path:inset(0 round 8px);transform:translate3d(7px,-2px,0) rotate(.7deg) scale(1.003)}82%{transform:translate3d(-2px,0,0) rotate(-.18deg)}100%{opacity:1;clip-path:inset(0 round 0);transform:none}}
@keyframes detail-gravity-return-home{0%{opacity:1;transform:none}100%{opacity:0;clip-path:inset(9% 5% 12% 5% round 28px);transform:translate3d(70px,24px,0) rotate(4deg) scale(.97)}}
@keyframes detail-gravity-return-list{0%{opacity:1;transform:none}100%{opacity:0;clip-path:inset(11% 6% 15% 6% round 26px);transform:translate3d(-66px,25px,0) rotate(-4.2deg) scale(.965)}}
@keyframes detail-side-in{from{opacity:.3;transform:translateX(52px)}to{opacity:1;transform:none}}
@keyframes detail-side-in-list{from{opacity:.3;transform:translateX(-52px)}to{opacity:1;transform:none}}
@keyframes detail-side-return{to{opacity:0;transform:translateX(46px)}}
@keyframes detail-side-return-list{to{opacity:0;transform:translateX(-46px)}}
@keyframes detail-low-in{from{opacity:.62;transform:translateX(13px)}to{opacity:1;transform:none}}
@keyframes detail-low-return{to{opacity:0;transform:translateX(9px)}}
@keyframes detail-library-cover-high{0%{opacity:.72;transform:translate3d(100%,0,0) rotate(1deg)}62%{opacity:1;transform:translate3d(-2.5%,0,0) rotate(-.12deg)}100%{opacity:1;transform:none}}
@keyframes detail-library-cover-medium{from{opacity:.82;transform:translate3d(72%,0,0) rotate(.45deg)}to{opacity:1;transform:none}}
@keyframes detail-library-cover-low{from{opacity:.72;transform:translate3d(18px,0,0)}to{opacity:1;transform:none}}
@keyframes detail-library-return-high{from{opacity:1;transform:none}to{opacity:.25;transform:translate3d(100%,0,0) rotate(1deg)}}
@keyframes detail-library-return-medium{to{opacity:.2;transform:translate3d(70%,0,0)}}
@keyframes detail-library-return-low{to{opacity:0;transform:translate3d(14px,0,0)}}
@keyframes detail-topbar-high-in{from{opacity:0;transform:translateY(-18px) rotate(-1.2deg)}70%{opacity:1;transform:translateY(2px) rotate(.2deg)}to{opacity:1;transform:none}}
@keyframes detail-dock-high-in{from{opacity:0;transform:translateY(25px) scale(.94)}70%{opacity:1;transform:translateY(-2px) scale(1.015)}to{opacity:1;transform:none}}
@keyframes detail-topbar-medium-in{from{opacity:0;transform:translateY(-9px)}to{opacity:1;transform:none}}
@keyframes detail-dock-medium-in{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
@keyframes backdrop-medium-open{from{opacity:.72;background-position:center 25%;transform:scale(1.075) translateY(-6px)}to{opacity:1;background-position:center 20%;transform:scale(calc(1.035 + var(--scroll) * .018)) translateY(calc(var(--scroll) * -5px))}}
@keyframes detail-copy-medium-in{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:none}}
@keyframes title-rise-medium{from{opacity:0;transform:translateY(10px) scale(.99)}to{opacity:1;transform:none}}
@keyframes record-editor-piece-high{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
@keyframes record-sheet-medium-up{from{opacity:.55;transform:translateY(54px) scale(.985)}to{opacity:1;transform:none}}
@keyframes record-sheet-medium-down{to{opacity:0;transform:translateY(42px)}}
@keyframes record-sheet-low-up{from{opacity:.7;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes record-sheet-low-down{to{opacity:0;transform:translateY(8px)}}
@keyframes backdrop-open{from{background-position:center 30%;transform:scale(1.13) translateY(-12px);filter:saturate(1.1)}to{background-position:center 20%;transform:scale(calc(1.035 + var(--scroll) * .018)) translateY(calc(var(--scroll) * -5px));filter:saturate(1)}}@keyframes detail-copy-in{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:translateY(0)}}@keyframes detail-list-in{from{opacity:.35;transform:scale(1.018)}to{opacity:1;transform:scale(1)}}@keyframes detail-return-home{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(10% 9% 35% 9% round 24px);transform:translateY(18px) scale(.96)}100%{opacity:0;clip-path:inset(20% 15% 47% 15% round 28px);transform:translateY(42px) scale(.88)}}@keyframes detail-return-list{0%{opacity:1;clip-path:inset(0 round 0);transform:scale(1)}58%{opacity:1;clip-path:inset(18% 36% 46% 8% round 20px);transform:translate(-26px,24px) scale(.94)}100%{opacity:0;clip-path:inset(38% 74% 50% 6% round 14px);transform:translate(-54px,38px) scale(.82)}}
@media(max-height:760px){.detail-hero-copy{min-height:455px}.detail-cover-card{width:88px}.record-editor-sheet{padding-bottom:16px}.rating-editor{margin-top:14px}.record-field{margin-top:11px}}@media(prefers-reduced-motion:reduce){.movie-detail,.detail-backdrop,.detail-hero-copy,.detail-cover-card,.still-main,.detail-load-state svg,.star-burst svg,.record-editor-sheet{animation:none}.detail-backdrop{transition:none}.reveal-section{opacity:1;filter:none;transform:none;transition:none}}
.tmdb-score-card,.trailer-card{border-color:rgba(255,255,255,calc(.14 + var(--scroll) * .08));background:linear-gradient(145deg,rgba(255,255,255,calc(.075 - var(--scroll) * .025)),rgba(7,16,15,calc(.16 + var(--scroll) * .68)));box-shadow:inset 0 1px 0 rgba(255,255,255,calc(.16 + var(--scroll) * .04)),0 10px 24px rgba(0,0,0,calc(.12 + var(--scroll) * .16));backdrop-filter:blur(calc(14px + var(--scroll) * 8px)) saturate(calc(1.18 + var(--scroll) * .12));transition:background .28s ease,border-color .28s ease,box-shadow .28s ease,backdrop-filter .28s ease}.tmdb-score-card{border-color:color-mix(in srgb,var(--accent) calc(32% + var(--scroll) * 12%),rgba(255,255,255,.17));background:linear-gradient(145deg,rgba(255,255,255,calc(.08 - var(--scroll) * .03)),rgba(7,18,18,calc(.2 + var(--scroll) * .66)));box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 10px 24px rgba(0,0,0,calc(.14 + var(--scroll) * .16));backdrop-filter:blur(calc(16px + var(--scroll) * 7px)) saturate(calc(1.2 + var(--scroll) * .1))}.quick-facts{color:rgba(247,241,232,calc(.66 + var(--scroll) * .18));border-color:rgba(255,255,255,calc(.1 + var(--scroll) * .1));background:linear-gradient(145deg,rgba(255,255,255,calc(.045 - var(--scroll) * .015)),rgba(7,16,15,calc(.13 + var(--scroll) * .7)));box-shadow:inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(calc(13px + var(--scroll) * 8px)) saturate(1.18);transition:color .28s ease,background .28s ease,border-color .28s ease,backdrop-filter .28s ease}.detail-panel{border-color:rgba(255,255,255,calc(.13 + var(--scroll) * .08));background:linear-gradient(145deg,rgba(255,255,255,calc(.07 - var(--scroll) * .025)),rgba(7,16,15,calc(.14 + var(--scroll) * .72)));box-shadow:inset 0 1px 0 rgba(255,255,255,calc(.12 + var(--scroll) * .04)),0 13px 28px rgba(0,0,0,calc(.1 + var(--scroll) * .2));backdrop-filter:blur(calc(15px + var(--scroll) * 9px)) saturate(calc(1.16 + var(--scroll) * .1));transition:background .3s ease,border-color .3s ease,box-shadow .3s ease,backdrop-filter .3s ease}
.movie-detail{translate:none}.movie-detail.has-swipe-transition{transition:none}.detail-backdrop,.detail-topbar,.detail-scroll{translate:var(--swipe-x) 0;will-change:translate}.movie-detail.has-swipe-transition .detail-topbar,.movie-detail.has-swipe-transition .detail-scroll{transition:translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease}.movie-detail.has-swipe-transition .detail-backdrop{transition:transform .26s ease-out,translate .36s cubic-bezier(.18,.86,.2,1),opacity .24s ease}.movie-detail.is-swipe-dragging .detail-backdrop,.movie-detail.is-swipe-dragging .detail-topbar,.movie-detail.is-swipe-dragging .detail-scroll{transition:none}.movie-detail.is-switching{opacity:1}.movie-detail.is-switching .detail-backdrop,.movie-detail.is-switching .detail-topbar,.movie-detail.is-switching .detail-scroll{opacity:.82}
.movie-detail.motion-medium.has-swipe-transition :is(.detail-topbar,.detail-scroll){transition:translate .27s cubic-bezier(.2,.8,.2,1),opacity .18s ease}.movie-detail.motion-medium.has-swipe-transition .detail-backdrop{transition:transform .22s ease-out,translate .27s cubic-bezier(.2,.8,.2,1),opacity .18s ease}.movie-detail.motion-low.has-swipe-transition :is(.detail-topbar,.detail-scroll){transition:translate .16s ease-out,opacity .12s ease}.movie-detail.motion-low.has-swipe-transition .detail-backdrop{transition:transform .16s ease-out,translate .16s ease-out,opacity .12s ease}.movie-detail.motion-high.is-switching :is(.detail-backdrop,.detail-topbar,.detail-scroll){opacity:.78}.movie-detail.motion-medium.is-switching :is(.detail-backdrop,.detail-topbar,.detail-scroll){opacity:.86}.movie-detail.motion-low.is-switching :is(.detail-backdrop,.detail-topbar,.detail-scroll){opacity:.94}
.detail-title-row{display:flex;align-items:end;justify-content:space-between;gap:12px}.detail-title-row h1{min-width:0;animation:title-rise .7s cubic-bezier(.16,1,.3,1) .09s both}.release-chip{display:flex;align-items:center;flex:0 0 auto;gap:4px;max-width:112px;padding:6px 8px;color:rgba(255,248,239,.82);border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(7,16,15,.3);box-shadow:inset 0 1px 0 rgba(255,255,255,.12);backdrop-filter:blur(14px);font-size:8px;white-space:nowrap;animation:title-rise .68s cubic-bezier(.16,1,.3,1) .18s both}.detail-original{animation:title-rise .62s cubic-bezier(.16,1,.3,1) .03s both}.detail-meta{animation:title-rise .66s cubic-bezier(.16,1,.3,1) .26s both}
.score-actions .tmdb-score-card,.score-actions .trailer-card{min-width:0;min-height:108px}.score-actions .trailer-card{padding:13px;gap:8px}.score-actions .trailer-card i{flex-basis:38px;width:38px;height:38px}.score-actions .trailer-card:disabled{opacity:.76}.quick-facts span{flex:1 0 auto;justify-content:center}
.people-rail{-webkit-overflow-scrolling:touch;pointer-events:auto;cursor:grab}.people-rail:active{cursor:grabbing}.stills-rail{display:flex;gap:10px;overflow-x:auto;margin-top:14px;padding-bottom:5px;scrollbar-width:none;scroll-snap-type:x mandatory;overscroll-behavior-inline:contain;touch-action:pan-x;-webkit-overflow-scrolling:touch}.stills-rail::-webkit-scrollbar{display:none}.stills-rail button{position:relative;flex:0 0 78%;height:150px;padding:0;overflow:hidden;cursor:zoom-in;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04);box-shadow:0 10px 24px rgba(0,0,0,.22);scroll-snap-align:start}.stills-rail img{display:block;width:100%;height:100%;object-fit:cover}.stills-rail button::after{content:'';position:absolute;inset:45% 0 0;background:linear-gradient(transparent,rgba(4,10,10,.58))}.stills-rail span{position:absolute;z-index:1;right:10px;bottom:8px;color:rgba(255,255,255,.78);font:8px Georgia,serif;letter-spacing:.12em}
.movie-detail.motion-medium .still-main{animation-duration:.25s}.movie-detail.motion-low .still-main{animation:none}.movie-detail.motion-high :is(.detail-topbar button,.watch-toggle,.edit-dock):active{transform:scale(.9) rotate(-2deg)}.movie-detail.motion-medium :is(.detail-topbar button,.watch-toggle,.edit-dock):active{transform:scale(.95)}.movie-detail.motion-low :is(.detail-topbar button,.watch-toggle,.edit-dock):active{transform:scale(.985)}
.detail-cover-card{padding:0;cursor:zoom-in}.person-card button.person-photo{padding:0;cursor:zoom-in;border:0;transition:transform .22s ease,filter .22s ease}.person-card button.person-photo:hover{filter:brightness(1.08);transform:translateY(-2px)}.still-stage .still-main{position:relative;height:150px;margin:0;padding:0;overflow:hidden;cursor:zoom-in;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.04) center/cover no-repeat;box-shadow:0 10px 24px rgba(0,0,0,.22)}
.extra-panel,.production-panel,.releases-panel,.videos-panel,.posters-panel,.collection-panel{--reveal-delay:135ms}.film-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;margin-top:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);border-radius:15px;background:rgba(255,255,255,.08)}.film-info-grid>div{min-width:0;padding:12px;background:rgba(7,16,15,.78)}.film-info-grid span,.film-info-grid strong{display:block}.film-info-grid span{color:rgba(255,255,255,.38);font-size:7px}.film-info-grid strong{overflow:hidden;margin-top:6px;color:rgba(255,255,255,.8);font-size:9px;text-overflow:ellipsis;white-space:nowrap}.keyword-cloud{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}.keyword-cloud button{padding:6px 8px;color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);border-radius:999px;background:color-mix(in srgb,var(--accent) 7%,transparent);font-size:7px}.crew-list{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:14px}.crew-list button{min-width:0;padding:10px;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.035)}.crew-list span,.crew-list strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.crew-list span{color:var(--accent);font-size:7px}.crew-list strong{margin-top:5px;color:rgba(255,255,255,.8);font-size:9px}.company-rail,.poster-rail,.collection-parts{display:flex;gap:9px;overflow-x:auto;margin-top:14px;padding-bottom:5px;scrollbar-width:none}.company-rail article{flex:0 0 82px;min-width:0}.company-rail img,.company-rail article>div{display:grid;place-items:center;width:82px;height:48px;object-fit:contain;padding:7px;box-sizing:border-box;color:var(--accent);border-radius:11px;background:rgba(255,255,255,.88)}.company-rail strong,.company-rail span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.company-rail strong{margin-top:6px;color:rgba(255,255,255,.78);font-size:7px}.company-rail span{margin-top:2px;color:rgba(255,255,255,.34);font-size:6px}.release-list{display:grid;gap:7px;margin-top:14px}.release-list article{display:flex;align-items:center;gap:10px;padding:9px 10px;border:1px solid rgba(255,255,255,.075);border-radius:13px;background:rgba(255,255,255,.025)}.release-list article>strong{display:grid;place-items:center;width:34px;height:26px;color:var(--accent);border-radius:8px;background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:8px}.release-list article>div{min-width:0}.release-list span,.release-list small{display:block}.release-list span{color:rgba(255,255,255,.78);font-size:9px}.release-list small{margin-top:3px;color:rgba(255,255,255,.38);font-size:7px}.video-list{display:grid;gap:8px;margin-top:14px}.video-list button{display:flex;align-items:center;gap:10px;width:100%;padding:10px;color:#fff;text-align:left;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03)}.video-list i{display:grid;place-items:center;flex:0 0 34px;height:34px;color:var(--accent);border:1px solid var(--accent);border-radius:50%}.video-list span{min-width:0}.video-list strong,.video-list small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.video-list strong{font-size:9px}.video-list small{margin-top:4px;color:rgba(255,255,255,.42);font-size:7px}.poster-rail button{position:relative;flex:0 0 92px;padding:0;overflow:hidden;border:0;border-radius:14px;background:rgba(255,255,255,.04)}.poster-rail img{display:block;width:92px;height:138px;object-fit:cover}.poster-rail span{position:absolute;right:6px;bottom:6px;padding:3px 5px;color:#fff;border-radius:999px;background:rgba(3,8,9,.68);font-size:6px}.collection-heading{position:relative;height:116px;margin:-18px -18px 0;padding:18px;box-sizing:border-box;background:rgba(255,255,255,.04) center/cover no-repeat}.collection-heading::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(5,12,12,.86),rgba(5,12,12,.22))}.collection-heading>div{position:relative;z-index:1;max-width:70%}.collection-heading small{color:var(--accent);font-size:7px;font-weight:850;letter-spacing:.14em}.collection-heading h2{margin-top:6px}.collection-panel>p{margin:13px 0 0;color:rgba(255,255,255,.57);font-size:8px;line-height:1.7}.collection-parts article{flex:0 0 72px;min-width:0}.collection-parts img,.collection-parts article>div{display:block;width:72px;height:104px;object-fit:cover;border-radius:11px;background:rgba(255,255,255,.05)}.collection-parts strong,.collection-parts span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.collection-parts strong{margin-top:6px;color:rgba(255,255,255,.78);font-size:7px}.collection-parts span{margin-top:2px;color:var(--accent);font-size:6px}.record-meta-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.record-meta-fields .record-field{min-width:0}.record-date-field>button{display:flex;align-items:center;gap:7px;width:100%;height:43px;padding:0 10px;color:rgba(255,255,255,.66);border:1px solid rgba(255,255,255,.11);border-radius:14px;background:rgba(255,255,255,.045)}.record-date-field strong{overflow:hidden;font-size:8px;text-overflow:ellipsis;white-space:nowrap}.record-tag-field>div{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.record-tag-field button{height:43px;padding:0;color:rgba(255,255,255,.48);border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.04);font-size:8px}.record-tag-field button.selected{color:#171a19;border-color:var(--accent);background:var(--accent)}
.score-actions.is-single{grid-template-columns:1fr}
@keyframes title-rise{from{opacity:0;filter:blur(6px);transform:translateY(20px)}to{opacity:1;filter:blur(0);transform:translateY(0)}}
.panel-expand{margin-top:13px}.company-rail,.poster-rail,.collection-parts{overscroll-behavior-inline:contain;touch-action:pan-x;-webkit-overflow-scrolling:touch}.company-rail::-webkit-scrollbar,.poster-rail::-webkit-scrollbar,.collection-parts::-webkit-scrollbar{display:none}
@media(max-width:390px){.detail-title-row{align-items:start;flex-direction:column;gap:9px}.release-chip{order:-1}.score-actions{grid-template-columns:1fr 1fr}.score-actions .trailer-card{gap:6px}.score-actions .trailer-card i{flex-basis:34px;width:34px;height:34px}}
@media(orientation:landscape) and (max-height:600px){
  .detail-backdrop{width:46%;height:100%;clip-path:none;background-position:center;animation:none}
  .detail-backdrop::after{background:linear-gradient(90deg,transparent 0 42%,rgba(7,16,15,.28) 66%,var(--screen) 100%)}
  .detail-topbar{top:max(14px,env(safe-area-inset-top));right:max(16px,env(safe-area-inset-right));left:max(16px,env(safe-area-inset-left))}
  .detail-topbar button{width:38px;height:38px}
  .detail-scroll{padding:0 max(18px,calc(env(safe-area-inset-right) + 10px)) 76px calc(46% + 18px)}
  .detail-hero-copy{min-height:100svh;padding:56px 0 20px}
  .detail-cover-card{width:70px;margin-bottom:9px;border-radius:12px}
  .detail-original{margin-bottom:4px;font-size:9px}
  .detail-hero-copy h1{font-size:24px}
  .detail-meta{margin-top:9px}
  .detail-content{gap:12px}
  .detail-panel{padding:14px;border-radius:17px}
  .detail-dock{right:max(0px,env(safe-area-inset-right));bottom:max(7px,env(safe-area-inset-bottom));left:max(0px,env(safe-area-inset-left));height:52px}
  .edit-dock{height:48px}
  .watch-island{right:10px;height:50px}
  .watch-toggle{height:38px}
}
/* Mobile motion stabilization */
.movie-detail.motion-high{animation-duration:.58s;backface-visibility:hidden;transform:translateZ(0)}
.detail-backdrop{clip-path:none;transition:transform .1s linear;backface-visibility:hidden;transform:scale(calc(1.045 + var(--scroll) * .065)) translate3d(0,calc(var(--scroll) * -12px),0)}
.detail-backdrop::before{content:'';position:absolute;z-index:1;inset:54% 0 0;background:var(--screen);transform:scaleY(calc(1 - var(--scroll)));transform-origin:50% 100%;will-change:transform;pointer-events:none}
.detail-backdrop::after{z-index:2;opacity:calc(1 - var(--scroll) * .36);will-change:opacity}
.movie-detail.motion-high .reveal-section{opacity:0;filter:none;transform:translate3d(0,24px,0) scale(.988);transition:opacity .46s ease var(--reveal-delay),transform .62s cubic-bezier(.16,1,.3,1) var(--reveal-delay)}
.movie-detail.motion-high .reveal-section.is-visible{opacity:1;transform:translate3d(0,0,0) scale(1)}
.movie-detail button{touch-action:pan-y}.people-rail button,.stills-rail button,.poster-rail button,.company-rail button,.collection-parts button{touch-action:pan-x}
.quick-facts{position:relative;border-color:color-mix(in srgb,var(--accent) 58%,rgba(255,255,255,.2));background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 13%,rgba(255,255,255,.045)),rgba(7,16,15,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent),0 9px 24px color-mix(in srgb,var(--accent) 13%,rgba(0,0,0,.25))}
.quick-facts::before{content:'';position:absolute;top:0;right:18px;left:18px;height:2px;border-radius:0 0 8px 8px;background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.9}
@keyframes detail-gravity-home{0%{opacity:.78;transform:translate3d(34px,10px,0) scale(.986)}62%{opacity:1;transform:translate3d(-4px,-1px,0) scale(1.002)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@keyframes detail-gravity-list{0%{opacity:.78;transform:translate3d(-34px,10px,0) scale(.986)}62%{opacity:1;transform:translate3d(4px,-1px,0) scale(1.002)}100%{opacity:1;transform:translate3d(0,0,0) scale(1)}}
@keyframes backdrop-open{from{transform:scale(1.17) translate3d(0,-16px,0)}to{transform:scale(calc(1.045 + var(--scroll) * .065)) translate3d(0,calc(var(--scroll) * -12px),0)}}
.detail-fixed-title{display:grid;min-width:0;max-width:210px;padding:6px 10px;border:1px solid rgba(255,255,255,.13);border-radius:13px;background:rgba(13,16,18,.32);backdrop-filter:blur(14px);text-align:center}.detail-fixed-title strong{overflow:hidden;color:#fff8ef;font-size:10px;text-overflow:ellipsis;white-space:nowrap}.detail-fixed-title small{margin-top:2px;color:rgba(255,247,239,.5);font-size:6px}.detail-neighbour{position:absolute;display:flex;align-items:center;gap:3px;height:30px;padding:0 9px;color:rgba(255,255,255,.74);border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(23,24,27,.92);font-size:7px;font-weight:800;pointer-events:auto}.detail-neighbour--previous{bottom:64px;left:0;border-radius:0 11px 11px 0}.detail-neighbour--next{right:0;bottom:64px;border-radius:11px 0 0 11px}.detail-neighbour:active{transform:scale(.94)}.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet>*{animation:none}.movie-detail.motion-high .record-editor-enter-active .record-editor-sheet{animation-duration:.38s}.movie-detail.motion-high .record-editor-backdrop{backdrop-filter:blur(4px)}
.movie-detail.is-preview .detail-topbar{justify-content:flex-start}.movie-detail.is-preview .watch-island{width:108px}.movie-detail.is-preview .watch-toggle.preview{color:#171a19;border-color:var(--accent);background:var(--accent);box-shadow:0 8px 22px color-mix(in srgb,var(--accent) 30%,rgba(0,0,0,.28))}.movie-detail.is-preview .watch-toggle.preview::before{border-color:#171a19;box-shadow:none}.collection-parts button{flex:0 0 72px;min-width:0;padding:0;text-align:left;border:0;background:transparent}.collection-parts button>div{display:block;width:72px;height:104px;border-radius:11px;background:rgba(255,255,255,.05)}.collection-parts button:active{transform:scale(.94)}
@keyframes detail-native-high-in{from{opacity:.72;transform:translate3d(18px,8px,0) scale(.992)}to{opacity:1;transform:none}}@keyframes detail-native-high-out{from{opacity:1;transform:none}to{opacity:0;transform:translate3d(0,20px,0) scale(.985)}}
</style>
