<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import type { HttpResponse } from '@capacitor/core'
import { ArrowDownUp, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Database, FileText, FolderTree, GripVertical, HardDrive, House, LayoutPanelTop, MoonStar, Pencil, Play, RefreshCw, Search, SlidersHorizontal, Star, Trash2, Upload, X } from 'lucide-vue-next'
import MovieCarousel from './components/MovieCarousel.vue'
import MovieList from './components/MovieList.vue'
import MovieDetail from './components/MovieDetail.vue'
import NoticeStack from './components/NoticeStack.vue'
import DatePickerDialog from './components/DatePickerDialog.vue'
import CategorySettings from './components/CategorySettings.vue'
import DetailLayoutSettings from './components/DetailLayoutSettings.vue'
import DatabaseSettings from './components/DatabaseSettings.vue'
import RotatingText from './components/RotatingText.vue'
import { getLocalValue, setLocalValue } from './services/localDatabase'
import cinematicAnimeCollage from './assets/cinematic-anime-collage.png'
import cinelogMark from './assets/branding/cinelog-mark.png'
import pixelPlus from './assets/pixel-plus.webp'
import pixelHome from './assets/pixel-home.webp'
import pixelMovieList from './assets/pixel-movie-list.webp'
import pixelCards from './assets/pixel-cards.webp'
import pixelRows from './assets/pixel-rows.webp'
import type { Movie } from './types'

const currentPage = ref('home')
const isNativeApp = Capacitor.isNativePlatform()
const STARTUP_ANIMATION_ENABLED_KEY = 'cinelog-startup-animation-enabled'
const MOTION_INTENSITY_KEY = 'cinelog-motion-intensity'
const THEME_MODE_KEY = 'cinelog-theme-mode'
const HOME_VIEW_MODE_KEY = 'cinelog-home-view-mode'
const MOVIE_RECORDS_STORAGE_KEY = 'movie-records'
const NOTICE_DURATION = 1700
const RECORD_NOTICE_DURATION = 2000
const LEGACY_SAMPLE_POSTERS = new Set(['pop', 'demon', 'crayon', 'coco'])
type ThemeMode = 'system' | 'light' | 'dark'
type MotionIntensity = 'high' | 'medium' | 'low'
const storedThemeMode = localStorage.getItem(THEME_MODE_KEY)
const storedMotionIntensity = localStorage.getItem(MOTION_INTENSITY_KEY)
const themeMode = ref<ThemeMode>(storedThemeMode === 'light' || storedThemeMode === 'dark' ? storedThemeMode : 'system')
const motionIntensity = ref<MotionIntensity>(
  storedMotionIntensity === 'high' || storedMotionIntensity === 'medium' || storedMotionIntensity === 'low'
    ? storedMotionIntensity
    : 'high',
)
const systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(systemThemeQuery.matches)
const resolvedTheme = computed(() => themeMode.value === 'system' ? (systemDark.value ? 'dark' : 'light') : themeMode.value)
const themeModeLabel = computed(() => ({ system: '跟随系统', light: '浅色', dark: '深色' })[themeMode.value])
const themeSwitching = ref(false)
const startupAnimationEnabled = ref(localStorage.getItem(STARTUP_ANIMATION_ENABLED_KEY) !== 'false')
const showStartupAnimation = ref(startupAnimationEnabled.value)
const viewModeSwitching = ref(false)
const statusSwitching = ref(false)
let startupAnimationTimer
let viewModeSwitchTimer
let statusSwitchTimer
const buttonFeedbackAnimations = new WeakMap<HTMLButtonElement, Animation>()

function completeStartupAnimation() {
  if (!showStartupAnimation.value) return
  window.clearTimeout(startupAnimationTimer)
  showStartupAnimation.value = false
}

function scheduleStartupAnimation() {
  window.clearTimeout(startupAnimationTimer)
  if (!showStartupAnimation.value) return
  const introDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 3600
  startupAnimationTimer = window.setTimeout(completeStartupAnimation, introDuration)
}

function previewStartupAnimation() {
  showStartupAnimation.value = false
  nextTick(() => {
    showStartupAnimation.value = true
    scheduleStartupAnimation()
  })
}

let themeSwitchTimer
function cycleThemeMode() {
  if (themeSwitching.value) return
  const modes: ThemeMode[] = ['system', 'light', 'dark']
  const nextMode = modes[(modes.indexOf(themeMode.value) + 1) % modes.length]
  themeSwitching.value = true
  document.documentElement.classList.add('theme-transitioning')
  window.setTimeout(() => {
    themeMode.value = nextMode
  }, 90)
  window.clearTimeout(themeSwitchTimer)
  themeSwitchTimer = window.setTimeout(() => {
    themeSwitching.value = false
    document.documentElement.classList.remove('theme-transitioning')
  }, 620)
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemDark.value = event.matches
}

scheduleStartupAnimation()

const movieRecords = ref([])
const movieRecordsReady = ref(false)
let persistMovieRecordsTimer

function isLegacySampleRecord(movie) {
  return Number.isInteger(movie?.id)
    && movie.id >= 1
    && movie.id <= 4
    && LEGACY_SAMPLE_POSTERS.has(movie.poster)
}

async function hydrateMovieRecords() {
  try {
    let saved = await getLocalValue(MOVIE_RECORDS_STORAGE_KEY)

    // Migrate records created by the earlier browser-storage implementation.
    if (!Array.isArray(saved)) {
      const legacy = JSON.parse(localStorage.getItem('movie-records-v1'))
      if (Array.isArray(legacy)) saved = legacy
    }

    if (Array.isArray(saved)) {
      const records = saved.filter((movie) => !isLegacySampleRecord(movie))
      movieRecords.value = records
      if (records.length !== saved.length) {
        await setLocalValue(MOVIE_RECORDS_STORAGE_KEY, records)
        localStorage.removeItem('movie-records-v1')
      }
    }
  } catch (error) {
    console.error('读取本地电影数据库失败：', error)
  } finally {
    movieRecordsReady.value = true
    syncMovieCategoriesFromRecords(movieRecords.value)
  }
}

hydrateMovieRecords()
const activeTab = ref('home')
const addOpen = ref(false)
const username = ref(localStorage.getItem('movie-username') || '通通')
const activeWatchStat = ref('watched')
const storedHomeViewMode = localStorage.getItem(HOME_VIEW_MODE_KEY)
const viewMode = ref<'cards' | 'list'>(storedHomeViewMode === 'list' ? 'list' : 'cards')
const homeSwapTransition = ref('card-swap')
const savedStatPeriod = localStorage.getItem('movie-stat-period')
const statPeriod = ref(['year', 'month', 'day'].includes(savedStatPeriod || '') ? savedStatPeriod : 'year')
const savedHomeDisplayLimit = Number(localStorage.getItem('movie-home-limit'))
const homeDisplayLimit = ref(Number.isFinite(savedHomeDisplayLimit) && savedHomeDisplayLimit > 0 ? Math.min(99, Math.round(savedHomeDisplayLimit)) : 10)
const homeCustomLimitOpen = ref(false)
const homeCustomLimitInput = ref(String(homeDisplayLimit.value))
const selectedYear = ref('2026')
const selectedMovie = ref(null)
const detailOrigin = ref('home')
const detailEntry = ref('home')
const transitionDirection = ref('forward')
const libraryQuery = ref('')
const libraryYear = ref('all')
const libraryGenre = ref('all')
const categoryOpen = ref(false)
const markingWatched = ref([])
const armedWatched = ref(null)
const posterFlight = ref(null)
const phoneShell = ref(null)
const movieDetail = ref(null)
const yearMenuOpen = ref(false)
const settingsSection = ref('hub')
const settingsDirection = ref('forward')
const avatarUrl = ref(localStorage.getItem('movie-avatar-url') || '')
const profileBackgroundColor = ref(localStorage.getItem('movie-profile-background') || '#ffffff')
const avatarRingColor = ref(localStorage.getItem('movie-avatar-ring') || '#cba777')
const activeProfileColor = ref(null)
const pendingProfileColor = ref('#ffffff')
const profileColorPresets = ['#ffffff', '#e9f1ff', '#eee5f7', '#dff2e7', '#1d1e21', '#6b3fd4', '#b56576', '#2d6b50']
const tmdbToken = ref(localStorage.getItem('movie-tmdb-token') || '')
const tmdbApiBase = ref(localStorage.getItem('movie-tmdb-api-base') || 'https://api.themoviedb.org/3')
const tmdbImageBase = ref(localStorage.getItem('movie-tmdb-image-base') || 'https://image.tmdb.org/t/p')
type TmdbNetworkMode = 'hosts' | 'custom'
const savedTmdbNetworkMode = localStorage.getItem('movie-tmdb-network-mode')
const tmdbNetworkMode = ref<TmdbNetworkMode>(savedTmdbNetworkMode === 'custom' ? 'custom' : 'hosts')
if (tmdbNetworkMode.value === 'hosts') {
  tmdbApiBase.value = 'https://api.themoviedb.org/3'
  tmdbImageBase.value = 'https://image.tmdb.org/t/p'
}
const tmdbEndpointRefreshState = ref('idle')
const tmdbTestState = ref('idle')
const tmdbTestMessage = ref('')
const expandedLibraryId = ref(null)
const recordExpanded = ref(false)
const recordMode = ref<'search' | 'import'>('search')
const importFileInput = ref<HTMLInputElement | null>(null)
const importDraftWatched = ref([])
const importDraftUnwatched = ref([])
const importCardsReversed = ref(false)
const tmdbQuery = ref('')
const tmdbResults = ref([])
const tmdbSearchState = ref('idle')
const tmdbSearchMessage = ref('')
const tmdbSearchLastQuery = ref('')
const tmdbPage = ref(0)
const tmdbTotalPages = ref(0)
const tmdbTotalResults = ref(0)
const tmdbLoadingMore = ref(false)
const tmdbVisibleCount = ref(10)
const tmdbLoadArmed = ref(false)
const tmdbRefreshing = ref(false)
const tmdbRefreshPull = ref(0)
const tmdbPullStart = ref(null)
const selectedTmdbResult = ref(null)
const addMediaType = ref('电影')
const addMediaMenuOpen = ref(false)
const addWatched = ref(false)
const addWatchedDate = ref(new Date().toISOString().slice(0, 10))
const addDatePickerOpen = ref(false)
const addRating = ref(0)
const addReview = ref('')
const overviewExpanded = ref(false)
type NoticeItem = { id: number; title: string; message?: string; tone?: string; type?: string }
const recordNotices = ref<NoticeItem[]>([])
const libraryNotices = ref<NoticeItem[]>([])
const homeNotices = ref<NoticeItem[]>([])
const settingsNotices = ref<NoticeItem[]>([])
let noticeSequence = 0

function dismissNotice(queue: NoticeItem[], id: number) {
  const index = queue.findIndex((notice) => notice.id === id)
  if (index >= 0) queue.splice(index, 1)
}

function pushNotice(queue: Ref<NoticeItem[]>, notice: Omit<NoticeItem, 'id'>, duration: number) {
  const item = { ...notice, id: ++noticeSequence }
  const limit = motionIntensity.value === 'high' ? 5 : 3
  queue.value = [item, ...queue.value].slice(0, limit)
  window.setTimeout(() => dismissNotice(queue.value, item.id), duration)
  return item.id
}
const recordClosing = ref(false)
const libraryWatchFilter = ref('all')
const librarySortBy = ref(localStorage.getItem('movie-library-sort') || 'release')
const libraryUnwatchedFirst = ref(true)
const libraryDateBasis = ref(localStorage.getItem('movie-library-date-basis') || 'record')
const libraryMediaType = ref('电影')
const libraryTagLimit = ref(Number(localStorage.getItem('movie-library-tag-limit')) || 5)
const libraryControlsSide = ref(localStorage.getItem('movie-library-controls-side') === 'right' ? 'right' : 'left')
const libraryDateExpanded = ref(false)
const libraryDateFilterActive = ref(false)
const libraryMediaMenuOpen = ref(false)
const librarySearchOpen = ref(false)
const initialLibraryDate = new Date()
const libraryYearValue = ref(Number(localStorage.getItem('movie-library-year')) || initialLibraryDate.getFullYear())
const libraryMonthValue = ref(Number(localStorage.getItem('movie-library-month')) || initialLibraryDate.getMonth() + 1)
const selectedLibraryDay = ref(Number(localStorage.getItem('movie-library-day')) || initialLibraryDate.getDate())
const avatarUploadMessage = ref('')
const librarySearchInput = ref(null)
const libraryTagDragId = ref('')
const libraryTagSuppressClick = ref(false)
let libraryTagHoldTimer
let pendingLibraryTagHold
let edgeBackGesture = null
let nativeBackListener = null

const EDGE_BACK_MAX_DURATION = 700

function mobileEdgeWidth(rect) {
  return Math.max(22, Math.min(32, rect.width * .07))
}

function edgeBackPointerDown(event) {
  if (event.pointerType === 'mouse' || event.button != null && event.button !== 0) return
  const rect = phoneShell.value?.getBoundingClientRect()
  if (!rect || rect.width > 520) return

  const edgeWidth = mobileEdgeWidth(rect)
  const distanceFromLeft = event.clientX - rect.left
  const distanceFromRight = rect.right - event.clientX
  const side = distanceFromLeft <= edgeWidth ? 'left' : distanceFromRight <= edgeWidth ? 'right' : null
  if (!side) return

  edgeBackGesture = {
    pointerId: event.pointerId,
    side,
    startX: event.clientX,
    startY: event.clientY,
    startedAt: performance.now(),
    horizontal: false,
  }
}

function edgeBackPointerMove(event) {
  if (!edgeBackGesture || edgeBackGesture.pointerId !== event.pointerId) return
  const deltaX = event.clientX - edgeBackGesture.startX
  const deltaY = event.clientY - edgeBackGesture.startY
  const inwardDistance = edgeBackGesture.side === 'left' ? deltaX : -deltaX

  if (!edgeBackGesture.horizontal && Math.hypot(deltaX, deltaY) > 9) {
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2 || inwardDistance <= 0) {
      edgeBackGesture = null
      return
    }
    edgeBackGesture.horizontal = true
  }

  if (edgeBackGesture.horizontal) {
    event.preventDefault()
    event.stopPropagation()
  }
}

function edgeBackPointerUp(event) {
  if (!edgeBackGesture || edgeBackGesture.pointerId !== event.pointerId) return
  const gesture = edgeBackGesture
  edgeBackGesture = null
  const deltaX = event.clientX - gesture.startX
  const deltaY = event.clientY - gesture.startY
  const inwardDistance = gesture.side === 'left' ? deltaX : -deltaX
  const elapsed = performance.now() - gesture.startedAt

  if (gesture.horizontal && inwardDistance >= 64 && Math.abs(deltaY) <= 48 && elapsed <= EDGE_BACK_MAX_DURATION) {
    event.preventDefault()
    event.stopPropagation()
    navigateBackOneLevel()
  }
}

function cancelEdgeBackGesture(event) {
  if (!edgeBackGesture || edgeBackGesture.pointerId !== event.pointerId) return
  edgeBackGesture = null
}

const defaultDetailLayout = [
  { id: 'tagline', label: '影片金句', description: '影片标语与氛围文案', tone: 'violet' },
  { id: 'score', label: 'TMDB 评分', description: '外部评分与评分人数', tone: 'gold' },
  { id: 'trailer', label: '预告片', description: '官方预告片快捷入口', tone: 'coral' },
  { id: 'facts', label: '基础资料', description: '上映日期、片长和分级', tone: 'blue' },
  { id: 'synopsis', label: '剧情简介', description: '影片故事与内容概览', tone: 'green' },
  { id: 'people', label: '主要演职员', description: '导演与主要演员阵容', tone: 'purple' },
  { id: 'record', label: '我的记录', description: '个人评分、日期和短评', tone: 'rose' },
  { id: 'info', label: '影片资料', description: '语言、国家、状态与关键词', tone: 'blue' },
  { id: 'production', label: '幕后制作', description: '主创人员与制作公司', tone: 'coral' },
  { id: 'releases', label: '地区上映', description: '不同地区的上映时间与分级', tone: 'green' },
  { id: 'videos', label: '影片视频', description: 'TMDB 返回的网络视频链接', tone: 'gold' },
  { id: 'posters', label: '海报画廊', description: '多语言电影海报横滑画廊', tone: 'violet' },
  { id: 'collection', label: '系列电影', description: '所属电影系列与关联作品', tone: 'purple' },
  { id: 'stills', label: '电影剧照', description: '电影场景剧照横滑画廊', tone: 'rose' },
]

function loadDetailLayout() {
  const fallback = {
    visible: defaultDetailLayout.map((item) => ({ ...item })),
    hidden: [],
  }
  try {
    const saved = JSON.parse(localStorage.getItem('movie-detail-layout'))
    const validIds = new Set(defaultDetailLayout.map((item) => item.id))
    const readIds = (value) => [...new Set((Array.isArray(value) ? value : []).map((item) => typeof item === 'string' ? item : item?.id).filter((id) => validIds.has(id)))]
    const visibleIds = readIds(Array.isArray(saved) ? saved : saved?.visible)
    const hiddenIds = readIds(Array.isArray(saved) ? [] : saved?.hidden).filter((id) => !visibleIds.includes(id))
    if (!visibleIds.length && !hiddenIds.length) return fallback
    const missingIds = defaultDetailLayout.map((item) => item.id).filter((id) => !visibleIds.includes(id) && !hiddenIds.includes(id))
    const toModules = (ids) => ids.map((id) => ({ ...defaultDetailLayout.find((item) => item.id === id) }))
    return { visible: toModules([...visibleIds, ...missingIds]), hidden: toModules(hiddenIds) }
  } catch {
    return fallback
  }
}

const initialDetailLayout = loadDetailLayout()
const detailLayout = ref(initialDetailLayout.visible)
const hiddenDetailLayout = ref(initialDetailLayout.hidden)

const movieTestGenres = ['剧情', '喜剧', '动作', '爱情', '悬疑', '科幻']
const tmdbMovieGenreLabels = {
  12: '冒险',
  14: '奇幻',
  16: '动画',
  18: '剧情',
  27: '恐怖',
  28: '动作',
  35: '喜剧',
  36: '历史',
  37: '西部',
  53: '惊悚',
  80: '犯罪',
  99: '纪录片',
  878: '科幻',
  9648: '悬疑',
  10402: '音乐',
  10749: '爱情',
  10751: '家庭',
  10752: '战争',
}

function makeMovieTestGenres() {
  return movieTestGenres.map((label, index) => ({ id: `movie-test-${index}`, label, source: 'default' }))
}

const defaultCategorySettings = [
  { id: 'movie', label: '电影', children: makeMovieTestGenres() },
  { id: 'tv', label: '电视剧', children: ['剧情', '喜剧', '爱情', '悬疑', '科幻', '动作'].map((label) => ({ id: `tv-${label}`, label, source: 'default' })) },
  { id: 'anime', label: '动漫', children: ['热血', '奇幻', '冒险', '治愈', '喜剧', '科幻'].map((label) => ({ id: `anime-${label}`, label, source: 'default' })) },
  { id: 'novel', label: '小说', children: ['科幻', '悬疑', '奇幻', '言情', '历史', '文学'].map((label) => ({ id: `novel-${label}`, label, source: 'default' })) },
]

function loadCategorySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('movie-category-settings'))
    if (!Array.isArray(saved) || !saved.length) return defaultCategorySettings
    return saved.map((category) => category.id === 'movie' && !category.children?.length
      ? { ...category, children: makeMovieTestGenres() }
      : category)
  } catch {
    return defaultCategorySettings
  }
}

const categorySettings = ref(loadCategorySettings())

function movieGenreLabels(records = movieRecords.value) {
  const labels = new Set()
  records.forEach((movie) => {
    movie.genres?.forEach((genre) => {
      const label = typeof genre === 'string' ? genre : genre?.name
      if (label?.trim()) labels.add(label.trim())
    })
    movie.genreIds?.forEach((id) => {
      const label = tmdbMovieGenreLabels[id]
      if (label) labels.add(label)
    })
  })
  return [...labels]
}

function syncMovieCategoriesFromRecords(records = movieRecords.value) {
  const labels = movieGenreLabels(records)
  if (!labels.length) return
  const movieCategory = categorySettings.value.find((category) => category.id === 'movie')
  if (!movieCategory) return
  const onlyTestData = !movieCategory.children.length || movieCategory.children.every((child) => child.id.startsWith('movie-test-'))
  if (!onlyTestData) return
  categorySettings.value = categorySettings.value.map((category) => category.id === 'movie'
    ? {
        ...category,
        children: labels.map((label, index) => ({ id: `movie-data-${index}-${label}`, label, source: 'data' })),
      }
    : category)
}

let watchConfirmTimer
let settingsAutoInputTimer

const watchedCount = computed(() => movieRecords.value.filter((movie) => movie.watched).length)
const favouriteCount = computed(() => movieRecords.value.filter((movie) => movie.favourite).length)
const displayedTmdbResults = computed(() => tmdbResults.value.slice(0, tmdbVisibleCount.value))
const addWatchedDateLabel = computed(() => addWatchedDate.value ? addWatchedDate.value.replaceAll('-', ' / ') : '选择日期')
const avatarUrlInput = computed({
  get: () => avatarUrl.value.startsWith('data:') ? '' : avatarUrl.value,
  set: (value) => { avatarUrl.value = value },
})
const profileTextColor = computed(() => {
  const hex = profileBackgroundColor.value.replace('#', '')
  const value = Number.parseInt(hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex, 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  return red * .299 + green * .587 + blue * .114 < 150 ? '#ffffff' : '#202126'
})
const unwatchedCount = computed(() => movieRecords.value.length - watchedCount.value)

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function watchedDateKey(movie) {
  const watchedDate = String(movie?.watchedDate || '')
  if (/^\d{4}-\d{2}-\d{2}$/.test(watchedDate)) return watchedDate

  // Older records did not always store watchedDate. Their record date is the
  // only user-related date we can safely migrate from; never use release date.
  const recordDate = String(movie?.recordDate || '')
  return /^\d{4}-\d{2}-\d{2}$/.test(recordDate) ? recordDate : ''
}

function watchedDateMatchesPeriod(movie) {
  const dateKey = watchedDateKey(movie)
  if (!dateKey) return false
  if (statPeriod.value === 'year') return dateKey.slice(0, 4) === selectedYear.value

  const today = new Date()
  if (statPeriod.value === 'month') return dateKey.slice(0, 7) === localDateKey(today).slice(0, 7)
  return dateKey === localDateKey(today)
}

const watchedYears = computed(() => [...new Set(movieRecords.value
  .filter((movie) => movie.watched)
  .map((movie) => watchedDateKey(movie).slice(0, 4))
  .filter(Boolean))].sort().reverse())
const filteredMovies = computed(() => movieRecords.value.filter((movie) => {
  if (activeWatchStat.value === 'unwatched') return !movie.watched
  if (!movie.watched) return false
  return watchedDateMatchesPeriod(movie)
}))
const periodLabel = computed(() => ({ year: `${selectedYear.value} 年`, month: '本月', week: '本周', day: '今天' })[statPeriod.value])
const watchedSubtitle = computed(() => `按${({ year: '年', month: '月', day: '日' })[statPeriod.value]}整理 · 共 ${filteredMovies.value.length} 部`)
const displayedMovies = computed(() => filteredMovies.value.slice(0, homeDisplayLimit.value))
const surfaceTransitionName = computed(() => transitionDirection.value === 'forward' ? 'surface-forward' : 'surface-back')
const surfaceTransitionDuration = computed(() => ({ high: 720, medium: 480, low: 260 })[motionIntensity.value])
const settingsTransitionName = computed(() => settingsDirection.value === 'forward' ? 'settings-forward' : 'settings-back')
const surfacePage = computed(() => {
  if (currentPage.value === 'detail') return detailOrigin.value
  // Keep the home surface mounted behind settings. Rebuilding it while the
  // settings shell exits can leave Android WebView showing a transparent frame.
  if (currentPage.value === 'settings') return 'home'
  return currentPage.value
})
const libraryYears = computed(() => [...new Set(movieRecords.value.map((movie) => movie.year))].sort().reverse())
const libraryYearOptions = computed(() => {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: 5 }, (_, index) => currentYear - 2 + index)
})
const libraryMediaTypes = computed(() => categorySettings.value.map((category) => category.label))
const libraryGenres = computed(() => categorySettings.value.find((category) => category.label === libraryMediaType.value)?.children?.map((child) => child.label) || [])
const visibleLibraryGenres = computed(() => ['all', ...libraryGenres.value].slice(0, Math.max(1, libraryTagLimit.value)))
const libraryDateItems = computed(() => Array.from({ length: 31 }, (_, index) => ({ day: index + 1 })))
const activeCategoryLabel = computed(() => {
  if (libraryGenre.value !== 'all') return libraryGenre.value
  if (libraryYear.value !== 'all') return `${libraryYear.value} 年`
  return '全部电影'
})
const libraryStatusTitle = computed(() => ({ all: '全部', watched: '已观看', unwatched: '未观看', favourite: '收藏' })[libraryWatchFilter.value])
const libraryStatusFrames = computed(() => [libraryStatusTitle.value])
const libraryMediaFrames = computed(() => [libraryMediaType.value])
const libraryWatchStates = computed(() => [
  { value: 'all', label: '全部', count: movieRecords.value.length },
  { value: 'watched', label: '已看', count: watchedCount.value },
  { value: 'unwatched', label: '未看', count: unwatchedCount.value },
])
const activeLibraryWatchState = computed(() => libraryWatchStates.value.find((state) => state.value === libraryWatchFilter.value) || libraryWatchStates.value[0])
const selectedLibraryDate = computed(() => statPeriod.value === 'year' ? String(libraryYearValue.value) : statPeriod.value === 'month' ? `${libraryYearValue.value}-${String(libraryMonthValue.value).padStart(2, '0')}` : `${libraryYearValue.value}-${String(libraryMonthValue.value).padStart(2, '0')}-${String(selectedLibraryDay.value).padStart(2, '0')}`)
const libraryMovies = computed(() => {
  const keyword = libraryQuery.value.trim().toLocaleLowerCase('zh-CN')
  const filtered = movieRecords.value.filter((movie) => {
    const matchesQuery = !keyword || `${movie.title} ${movie.originalTitle} ${movie.meta}`.toLocaleLowerCase('zh-CN').includes(keyword)
    const matchesYear = libraryYear.value === 'all' || movie.year === libraryYear.value
    const matchesGenre = libraryGenre.value === 'all' || movie.meta.split('·').map((genre) => genre.trim()).includes(libraryGenre.value)
    const matchesWatch = libraryWatchFilter.value === 'all' || (libraryWatchFilter.value === 'watched' ? movie.watched : libraryWatchFilter.value === 'unwatched' ? !movie.watched : movie.favourite)
    const matchesMedia = libraryMediaType.value === '电影' || (['动画', '动漫'].includes(libraryMediaType.value) && movie.meta.includes('动画')) || movie.meta.includes(libraryMediaType.value)
    const movieDate = libraryDateBasis.value === 'release' ? (movie.releaseDate || movie.release_date) : (movie.recordDate || movie.watchedDate)
    const matchesDate = !libraryDateFilterActive.value || String(movieDate || '').startsWith(selectedLibraryDate.value)
    return matchesQuery && matchesYear && matchesGenre && matchesWatch && matchesMedia && matchesDate
  })
  return filtered.sort((a, b) => {
    if (libraryWatchFilter.value === 'all' && libraryUnwatchedFirst.value && a.watched !== b.watched) return Number(a.watched) - Number(b.watched)
    if (librarySortBy.value === 'name') return a.title.localeCompare(b.title, 'zh-CN')
    if (librarySortBy.value === 'rating') return (b.rating ?? -1) - (a.rating ?? -1)
    if (librarySortBy.value === 'personal') return (b.personalRating ?? -1) - (a.personalRating ?? -1)
    return String(b.releaseDate || b.release_date || b.year || '').localeCompare(String(a.releaseDate || a.release_date || a.year || '')) || b.id - a.id
  })
})

watch(username, (value) => localStorage.setItem('movie-username', value || '用户'))
watch(statPeriod, (value) => localStorage.setItem('movie-stat-period', value))
watch(homeDisplayLimit, (value) => localStorage.setItem('movie-home-limit', String(value)))
watch(viewMode, (value) => localStorage.setItem(HOME_VIEW_MODE_KEY, value))
watch(avatarUrl, (value) => localStorage.setItem('movie-avatar-url', value.trim()))
watch(profileBackgroundColor, (value) => localStorage.setItem('movie-profile-background', value))
watch(avatarRingColor, (value) => localStorage.setItem('movie-avatar-ring', value))
watch(tmdbToken, (value) => localStorage.setItem('movie-tmdb-token', value.trim()))
watch(tmdbApiBase, (value) => {
  localStorage.setItem('movie-tmdb-api-base', value.trim())
  if (tmdbNetworkMode.value === 'custom') localStorage.setItem('movie-tmdb-custom-api-base', value.trim())
})
watch(tmdbImageBase, (value) => {
  localStorage.setItem('movie-tmdb-image-base', value.trim())
  if (tmdbNetworkMode.value === 'custom') localStorage.setItem('movie-tmdb-custom-image-base', value.trim())
})
watch(tmdbNetworkMode, (value) => localStorage.setItem('movie-tmdb-network-mode', value))
watch(libraryTagLimit, (value) => localStorage.setItem('movie-library-tag-limit', String(value)))
watch(libraryControlsSide, (value) => localStorage.setItem('movie-library-controls-side', value))
watch(librarySortBy, (value) => localStorage.setItem('movie-library-sort', value))
watch(libraryUnwatchedFirst, (value) => localStorage.setItem('movie-library-unwatched-first', String(value)))
watch(libraryDateBasis, (value) => localStorage.setItem('movie-library-date-basis', value))
watch(libraryYearValue, (value) => localStorage.setItem('movie-library-year', String(value)))
watch(libraryMonthValue, (value) => localStorage.setItem('movie-library-month', String(value)))
watch(selectedLibraryDay, (value) => localStorage.setItem('movie-library-day', String(value)))
watch(startupAnimationEnabled, (value) => {
  localStorage.setItem(STARTUP_ANIMATION_ENABLED_KEY, String(value))
})
watch(motionIntensity, (value) => localStorage.setItem(MOTION_INTENSITY_KEY, value))
watch(themeMode, (value) => localStorage.setItem(THEME_MODE_KEY, value))
watch(resolvedTheme, (value) => {
  document.documentElement.dataset.theme = value
  document.documentElement.style.colorScheme = value
}, { immediate: true })
systemThemeQuery.addEventListener('change', handleSystemThemeChange)
watch(movieRecords, (value) => {
  if (!movieRecordsReady.value) return
  syncMovieCategoriesFromRecords(value)
  window.clearTimeout(persistMovieRecordsTimer)
  persistMovieRecordsTimer = window.setTimeout(() => {
    const snapshot = JSON.parse(JSON.stringify(movieRecords.value))
    setLocalValue(MOVIE_RECORDS_STORAGE_KEY, snapshot).catch((error) => {
      console.error('电影记录保存到本地数据库失败：', error)
    })
  }, 260)
}, { deep: true })
watch(watchedYears, (years) => {
  if (years.length && !years.includes(selectedYear.value)) selectedYear.value = years[0]
}, { immediate: true })
watch(categorySettings, (value) => localStorage.setItem('movie-category-settings', JSON.stringify(value)), { deep: true })
watch([detailLayout, hiddenDetailLayout], ([visible, hidden]) => localStorage.setItem('movie-detail-layout', JSON.stringify({
  visible: visible.map((item) => item.id),
  hidden: hidden.map((item) => item.id),
})), { deep: true })
watch(libraryMediaTypes, (types) => {
  if (!types.includes(libraryMediaType.value)) libraryMediaType.value = types[0] || '电影'
})
watch(libraryMediaType, () => {
  libraryGenre.value = 'all'
})

function setWatchStat(value) {
  if (activeWatchStat.value === value || statusSwitching.value) return
  statusSwitching.value = true
  homeSwapTransition.value = 'card-swap'
  activeWatchStat.value = value
  const switchDuration = ({ high: 560, medium: 380, low: 180 })[motionIntensity.value]
  window.clearTimeout(statusSwitchTimer)
  statusSwitchTimer = window.setTimeout(() => {
    statusSwitching.value = false
  }, switchDuration)
}

function toggleViewMode() {
  if (viewModeSwitching.value) return
  viewModeSwitching.value = true
  homeSwapTransition.value = 'drop-swap'
  viewMode.value = viewMode.value === 'cards' ? 'list' : 'cards'
  const switchDuration = ({ high: 620, medium: 400, low: 190 })[motionIntensity.value]
  window.clearTimeout(viewModeSwitchTimer)
  viewModeSwitchTimer = window.setTimeout(() => {
    viewModeSwitching.value = false
    homeSwapTransition.value = 'card-swap'
  }, switchDuration)
}

function openHomeCustomLimit() {
  homeCustomLimitInput.value = String(homeDisplayLimit.value)
  homeCustomLimitOpen.value = true
}

function cancelHomeCustomLimit() {
  homeCustomLimitInput.value = String(homeDisplayLimit.value)
  homeCustomLimitOpen.value = false
}

function saveHomeCustomLimit() {
  const value = Math.min(99, Math.max(1, Math.round(Number(homeCustomLimitInput.value) || homeDisplayLimit.value)))
  homeDisplayLimit.value = value
  homeCustomLimitInput.value = String(value)
  homeCustomLimitOpen.value = false
}

function selectLibraryQuickGenre(genre) {
  if (!libraryTagSuppressClick.value) libraryGenre.value = genre
}

function startLibraryTagHold(event, genre) {
  if (event.button != null && event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  window.clearTimeout(libraryTagHoldTimer)
  pendingLibraryTagHold = { x: event.clientX, y: event.clientY, pointerType: event.pointerType, element }
  element.setPointerCapture?.(event.pointerId)
  libraryTagHoldTimer = window.setTimeout(() => {
    if (!pendingLibraryTagHold) return
    libraryTagDragId.value = genre
    libraryTagSuppressClick.value = true
    navigator.vibrate?.(18)
  }, event.pointerType === 'touch' ? 300 : 350)
}

function cancelLibraryTagHold(event) {
  if (!libraryTagDragId.value && pendingLibraryTagHold) {
    const tolerance = pendingLibraryTagHold.pointerType === 'touch' ? 18 : 8
    if (Math.hypot(event.clientX - pendingLibraryTagHold.x, event.clientY - pendingLibraryTagHold.y) <= tolerance) return
    window.clearTimeout(libraryTagHoldTimer)
    pendingLibraryTagHold = null
  }
}

function moveLibraryTagHold(event) {
  const draggedGenre = libraryTagDragId.value
  if (!draggedGenre) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-library-tag]') as HTMLElement | null
  const targetGenre = target?.dataset.libraryTag
  if (!targetGenre || targetGenre === draggedGenre) return
  const categories = categorySettings.value.map((category) => ({
    ...category,
    children: category.children.map((child) => ({ ...child })),
  }))
  const category = categories.find((item) => item.label === libraryMediaType.value)
  const from = category?.children.findIndex((child) => child.label === draggedGenre) ?? -1
  const to = category?.children.findIndex((child) => child.label === targetGenre) ?? -1
  if (from < 0 || to < 0) return
  const [moved] = category.children.splice(from, 1)
  category.children.splice(to, 0, moved)
  categorySettings.value = categories
}

function endLibraryTagHold() {
  window.clearTimeout(libraryTagHoldTimer)
  pendingLibraryTagHold = null
  libraryTagDragId.value = ''
  window.setTimeout(() => { libraryTagSuppressClick.value = false }, 80)
}

function resetDetailLayout() {
  detailLayout.value = defaultDetailLayout.map((item) => ({ ...item }))
  hiddenDetailLayout.value = []
}

onBeforeUnmount(() => {
  window.clearTimeout(libraryTagHoldTimer)
  window.clearTimeout(startupAnimationTimer)
  window.clearTimeout(themeSwitchTimer)
  window.clearTimeout(viewModeSwitchTimer)
  window.clearTimeout(statusSwitchTimer)
  window.clearTimeout(settingsAutoInputTimer)
  document.documentElement.classList.remove('theme-transitioning')
  systemThemeQuery.removeEventListener('change', handleSystemThemeChange)
  nativeBackListener?.remove()
})

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return
  nativeBackListener = await CapacitorApp.addListener('backButton', () => {
    if (!navigateBackOneLevel()) CapacitorApp.exitApp()
  })
})

function markWatched(payload) {
  const id = typeof payload === 'object' ? payload.id : payload
  const movie = movieRecords.value.find((item) => item.id === id)
  if (movie) {
    movie.watched = true
    if (!movie.watchedDate) movie.watchedDate = localDateKey()
  }
  if (typeof payload === 'object' && payload.source === 'carousel-swipe') {
    pushNotice(homeNotices, { title: '已完成观看', message: `《${payload.title || movie?.title || '这部电影'}》已移入已观看`, tone: 'success' }, NOTICE_DURATION)
  }
}

function showHomeWatchNotice(movie) {
  pushNotice(homeNotices, { title: '再点一次确认', message: `将《${movie.title}》设为已观看`, tone: 'warning' }, NOTICE_DURATION)
}

function openDetail(movie) {
  selectedMovie.value = movie
  detailOrigin.value = currentPage.value
  detailEntry.value = 'home'
  currentPage.value = 'detail'
  ensureTmdbDetails(movie)
}

function cycleLibraryWatchFilter() {
  const index = libraryWatchStates.value.findIndex((state) => state.value === libraryWatchFilter.value)
  libraryWatchFilter.value = libraryWatchStates.value[(index + 1) % libraryWatchStates.value.length].value
}

function resetLibraryDate() {
  const today = new Date()
  libraryYearValue.value = today.getFullYear()
  libraryMonthValue.value = today.getMonth() + 1
  selectedLibraryDay.value = today.getDate()
  libraryDateFilterActive.value = false
  libraryDateExpanded.value = false
  expandedLibraryId.value = null
}

function syncLibraryDateToRecord(record) {
  const preferredDate = libraryDateBasis.value === 'release'
    ? (record.releaseDate || record.release_date || record.recordDate)
    : (record.recordDate || record.watchedDate)
  const match = String(preferredDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return
  libraryYearValue.value = Number(match[1])
  libraryMonthValue.value = Number(match[2])
  selectedLibraryDay.value = Number(match[3])
}

function prependMovieRecords(records) {
  if (!records.length) return
  movieRecords.value = [...records, ...movieRecords.value]
  syncLibraryDateToRecord(records[0])
  if (records[0].watched) selectedYear.value = watchedDateKey(records[0]).slice(0, 4) || selectedYear.value
}

function openDetailFromPoster(movie: Movie, source: Element | null) {
  const poster = source?.querySelector?.('.library-poster, .movie-list-poster')
  const posterRect = poster?.getBoundingClientRect()
  const phoneRect = phoneShell.value?.getBoundingClientRect()
  detailOrigin.value = currentPage.value
  detailEntry.value = 'list'

  if (!posterRect || !phoneRect) {
    selectedMovie.value = movie
    currentPage.value = 'detail'
    ensureTmdbDetails(movie)
    return
  }

  posterFlight.value = {
    movie,
    left: posterRect.left - phoneRect.left,
    top: posterRect.top - phoneRect.top,
    width: posterRect.width,
    height: posterRect.height,
  }
  window.setTimeout(() => {
    selectedMovie.value = movie
    currentPage.value = 'detail'
    ensureTmdbDetails(movie)
  }, 90)
  window.setTimeout(() => { posterFlight.value = null }, 460)
}

function openLibraryDetail(movie: Movie) {
  posterFlight.value = null
  detailOrigin.value = 'library'
  detailEntry.value = 'library'
  selectedMovie.value = movie
  currentPage.value = 'detail'
  ensureTmdbDetails(movie)
}

function openHomeListDetail(payload) {
  openDetailFromPoster(payload.movie, payload.source)
}

function closeDetail() {
  transitionDirection.value = detailOrigin.value === 'home' ? 'back' : 'forward'
  currentPage.value = detailOrigin.value
  selectedMovie.value = null
}

function navigateBackOneLevel() {
  if (showStartupAnimation.value) {
    completeStartupAnimation()
    return true
  }
  if (addDatePickerOpen.value) {
    addDatePickerOpen.value = false
    return true
  }
  if (selectedTmdbResult.value) {
    selectedTmdbResult.value = null
    return true
  }
  if (addOpen.value) {
    closeRecordSheet()
    return true
  }
  if (categoryOpen.value) {
    categoryOpen.value = false
    return true
  }
  if (currentPage.value === 'detail') {
    movieDetail.value?.handleBackNavigation?.()
    return true
  }
  if (currentPage.value === 'settings') {
    backFromSettings()
    return true
  }
  if (libraryDateExpanded.value || libraryMediaMenuOpen.value) {
    libraryDateExpanded.value = false
    libraryMediaMenuOpen.value = false
    return true
  }
  if (currentPage.value === 'library') {
    showHome()
    return true
  }
  return false
}

function openSettings(section = 'hub') {
  settingsDirection.value = 'forward'
  settingsSection.value = section
  currentPage.value = 'settings'
}

function openSettingsSection(section) {
  settingsDirection.value = 'forward'
  settingsSection.value = section
}

function backFromSettings() {
  if (settingsSection.value !== 'hub') {
    settingsDirection.value = 'back'
    settingsSection.value = 'hub'
    return
  }
  transitionDirection.value = 'back'
  currentPage.value = 'home'
}

function animateButtonFeedback(event: MouseEvent) {
  const target = (event.target as HTMLElement | null)?.closest?.('button') as HTMLButtonElement | null
  if (!target || target.disabled) return
  const intensity: MotionIntensity = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : motionIntensity.value
  const frames = {
    high: [{ scale: '1' }, { scale: '.88', offset: .32 }, { scale: '1.065', offset: .7 }, { scale: '1' }],
    medium: [{ scale: '1' }, { scale: '.94', offset: .4 }, { scale: '1.025', offset: .76 }, { scale: '1' }],
    low: [{ scale: '1' }, { scale: '.975', offset: .5 }, { scale: '1' }],
  }[intensity]
  const duration = ({ high: 460, medium: 320, low: 180 })[intensity]
  buttonFeedbackAnimations.get(target)?.cancel()
  const animation = target.animate(frames, { duration, easing: 'cubic-bezier(.16,1,.3,1)' })
  buttonFeedbackAnimations.set(target, animation)
  animation.finished.catch(() => {}).finally(() => {
    if (buttonFeedbackAnimations.get(target) === animation) buttonFeedbackAnimations.delete(target)
  })
}

function handlePhoneClick(event: MouseEvent) {
  animateButtonFeedback(event)
  animateSettingsChoice(event)
}

function animateSettingsChoice(event: MouseEvent) {
  const target = (event.target as HTMLElement | null)?.closest?.('button') as HTMLButtonElement | null
  if (!target || target.disabled) return
  const group = target.closest(
    '.period-options,.tag-limit-options,.library-side-options,.library-sort-options,.library-priority-options,.category-options,.category-parent-list,.network-options,.motion-intensity-options,.profile-color-palette,.library-chip-scroll,.library-media-menu,.date-option-row>div',
  ) as HTMLElement | null
  if (!group || target.classList.contains('selected')) return
  if (currentPage.value === 'settings' && !['hub', 'profile', 'categories', 'detail-layout'].includes(settingsSection.value)) {
    window.setTimeout(() => showSettingsAutoSaved(), 90)
  }

  const previous = group.querySelector<HTMLElement>('button.selected')
  const activeMotionIntensity: MotionIntensity = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'low' : motionIntensity.value
  if (activeMotionIntensity === 'high' && (isNativeApp || currentPage.value === 'settings')) {
    target.classList.remove('choice-high-tap')
    void target.offsetWidth
    target.classList.add('choice-high-tap')
    window.setTimeout(() => target.classList.remove('choice-high-tap'), 380)
    return
  }
  if (activeMotionIntensity === 'low' || (isNativeApp && activeMotionIntensity === 'medium')) {
    target.classList.remove('choice-low-tap')
    void target.offsetWidth
    target.classList.add('choice-low-tap')
    window.setTimeout(() => target.classList.remove('choice-low-tap'), 180)
    return
  }

  const targetRect = target.getBoundingClientRect()
  const previousRect = previous?.getBoundingClientRect()
  if (activeMotionIntensity === 'high' && previous && previousRect) {
    const isLibraryChipRow = group.classList.contains('library-chip-scroll')
    const flightId = `${Number(group.dataset.choiceFlightId || 0) + 1}`
    group.dataset.choiceFlightId = flightId
    group.querySelector('.choice-flight')?.remove()
    group.querySelectorAll('.choice-flight-peer,.choice-flight-target,.choice-flight-ink').forEach((element) => {
      element.classList.remove('choice-flight-peer', 'choice-flight-target', 'choice-flight-ink')
    })

    const groupRect = group.getBoundingClientRect()
    const flight = document.createElement('i')
    const previousStyle = window.getComputedStyle(previous)
    const left = previousRect.left - groupRect.left + group.scrollLeft
    const top = previousRect.top - groupRect.top + group.scrollTop
    const deltaX = targetRect.left - previousRect.left
    const deltaY = targetRect.top - previousRect.top
    const scaleX = targetRect.width / previousRect.width
    const scaleY = targetRect.height / previousRect.height
    const overshootX = deltaX === 0 ? 0 : Math.sign(deltaX) * Math.min(7, Math.abs(deltaX) * .08)
    const overshootY = deltaY === 0 ? 0 : Math.sign(deltaY) * Math.min(5, Math.abs(deltaY) * .08)

    flight.className = 'choice-flight'
    Object.assign(flight.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${previousRect.width}px`,
      height: `${previousRect.height}px`,
      borderRadius: previousStyle.borderRadius,
      background: previousStyle.background,
      boxShadow: previousStyle.boxShadow,
    })
    const frames = isLibraryChipRow
      ? [
          { transform: 'translate3d(0,0,0) scale(1,1)', filter: 'brightness(1)' },
          { transform: `translate3d(${deltaX}px,${deltaY}px,0) scale(${scaleX},${scaleY})`, filter: 'brightness(1)' },
        ]
      : [
          { transform: 'translate3d(0,0,0) scale(1,1)', filter: 'brightness(1)', offset: 0 },
          { transform: `translate3d(${deltaX * .62}px,${deltaY * .62}px,0) scale(${1 + (scaleX - 1) * .62},${1 + (scaleY - 1) * .62})`, filter: 'brightness(1.035)', offset: .55 },
          { transform: `translate3d(${deltaX + overshootX}px,${deltaY + overshootY}px,0) scale(${scaleX * 1.018},${scaleY * 1.018})`, filter: 'brightness(1.02)', offset: .82 },
          { transform: `translate3d(${deltaX}px,${deltaY}px,0) scale(${scaleX},${scaleY})`, filter: 'brightness(1)', offset: 1 },
        ]

    // The capture handler runs before Vue updates the selected class. Start the
    // flight after that update so the target never flashes black ahead of it.
    queueMicrotask(() => {
      void nextTick(() => {
        if (group.dataset.choiceFlightId !== flightId || !target.isConnected || !previous.isConnected) return
        previous.classList.add('choice-flight-peer')
        target.classList.add('choice-flight-peer', 'choice-flight-target', 'choice-flight-ink')
        group.appendChild(flight)
        const animation = flight.animate(frames, {
          duration: isLibraryChipRow ? 640 : 540,
          easing: 'cubic-bezier(.16,1,.3,1)',
          fill: 'forwards',
        })
        animation.finished.catch(() => {}).finally(() => {
          flight.remove()
          if (group.dataset.choiceFlightId !== flightId) return
          delete group.dataset.choiceFlightId
          previous.classList.remove('choice-flight-peer')
          target.classList.remove('choice-flight-peer', 'choice-flight-target', 'choice-flight-ink')
        })
      })
    })
    return
  }

  const originX = previousRect ? previousRect.left + previousRect.width / 2 - targetRect.left : targetRect.width / 2
  const originY = previousRect ? previousRect.top + previousRect.height / 2 - targetRect.top : targetRect.height / 2

  target.style.setProperty('--choice-origin-x', `${originX}px`)
  target.style.setProperty('--choice-origin-y', `${originY}px`)
  target.classList.remove('choice-infecting')
  previous?.classList.remove('choice-releasing')
  group.classList.remove('choice-group-active')
  void target.offsetWidth
  group.classList.add('choice-group-active')
  target.classList.add('choice-infecting')
  previous?.classList.add('choice-releasing')
  window.setTimeout(() => {
    group.classList.remove('choice-group-active')
    target.classList.remove('choice-infecting')
    previous?.classList.remove('choice-releasing')
  }, 560)
}

function showSettingsAutoSaved(message = '更改已写入当前设备') {
  pushNotice(settingsNotices, { title: '设置已自动保存', message, tone: 'success' }, NOTICE_DURATION)
}

function handleSettingsAutoInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  if (!target?.matches?.('[data-auto-save]')) return
  const label = target.closest('.settings-group')?.querySelector('label')?.textContent?.trim()
  window.clearTimeout(settingsAutoInputTimer)
  settingsAutoInputTimer = window.setTimeout(() => {
    showSettingsAutoSaved(label ? `${label}已自动保存` : '输入内容已自动保存')
  }, 720)
}

function resetDetailLayoutWithNotice() {
  resetDetailLayout()
  showSettingsAutoSaved('详情布局已恢复默认顺序')
}

function chooseYear(year) {
  selectedYear.value = year
  yearMenuOpen.value = false
}

function selectLibraryMediaType(type: string) {
  if (libraryMediaType.value === type) {
    libraryMediaMenuOpen.value = false
    return
  }
  libraryMediaType.value = type
  const closeDelay = ({ high: 300, medium: 220, low: 110 })[motionIntensity.value]
  window.setTimeout(() => {
    libraryMediaMenuOpen.value = false
  }, closeDelay)
}

async function testTmdbConnection() {
  const token = tmdbToken.value.trim()
  const base = tmdbApiBase.value.trim().replace(/\/$/, '')
  const imageBase = tmdbImageBase.value.trim().replace(/\/$/, '')
  if (!token || !base || !imageBase) {
    tmdbTestState.value = 'error'
    tmdbTestMessage.value = '请先填写 API 密钥、API 地址和图片地址。'
    return
  }
  try {
    const apiUrl = new URL(base)
    const imageUrl = new URL(imageBase)
    if (apiUrl.protocol !== 'https:' || imageUrl.protocol !== 'https:') {
      throw new Error('API 与图片地址都必须使用 HTTPS（默认端口就是 443）')
    }
  } catch (error) {
    tmdbTestState.value = 'error'
    tmdbTestMessage.value = error instanceof Error ? error.message : '服务地址格式不正确。'
    return
  }
  tmdbTestState.value = 'testing'
  tmdbTestMessage.value = tmdbNetworkMode.value === 'hosts' ? '正在通过 CheckTMDB hosts 连接…' : '正在连接自定义 TMDB 服务…'
  try {
    const request = tmdbRequest(`${base}/configuration`)
    const response = await executeTmdbRequest(request)
    if (!response.ok) {
      tmdbTestState.value = 'error'
      if (response.status === 401) {
        tmdbTestMessage.value = '已连接到 TMDB，但 API 密钥无效（HTTP 401）。请重新粘贴 v3 API Key 或 v4 Read Access Token；可直接粘贴带 Bearer 前缀的 Token。'
        return
      }
      if (response.status === 403) {
        tmdbTestMessage.value = '已连接到 TMDB，但当前密钥没有访问权限（HTTP 403）。请检查密钥状态与账户权限。'
        return
      }
      throw new Error(`HTTP ${response.status}`)
    }
    tmdbTestState.value = 'success'
    tmdbTestMessage.value = tmdbNetworkMode.value === 'hosts' ? 'CheckTMDB hosts 连接成功。' : '自定义 TMDB 服务连接成功。'
  } catch (error) {
    tmdbTestState.value = 'error'
    const hint = tmdbNetworkMode.value === 'hosts'
      ? '请确认已将 CheckTMDB 最新 hosts 写入系统或路由器，然后重试。'
      : '请检查自定义 API、图片地址和 HTTPS 证书。'
    const reason = error instanceof Error ? error.message : String(error)
    tmdbTestMessage.value = `连接失败（${reason}）。${hint}`
  }
}

function refreshTmdbEndpoints() {
  if (tmdbNetworkMode.value === 'hosts') {
    tmdbApiBase.value = 'https://api.themoviedb.org/3'
    tmdbImageBase.value = 'https://image.tmdb.org/t/p'
  } else {
    tmdbApiBase.value = localStorage.getItem('movie-tmdb-custom-api-base') || ''
    tmdbImageBase.value = localStorage.getItem('movie-tmdb-custom-image-base') || ''
  }
  tmdbTestState.value = 'idle'
  tmdbTestMessage.value = ''
  tmdbEndpointRefreshState.value = 'refreshed'
  window.setTimeout(() => { tmdbEndpointRefreshState.value = 'idle' }, 1400)
}

function switchTmdbNetworkMode(mode: TmdbNetworkMode) {
  if (tmdbNetworkMode.value === mode) return
  if (tmdbNetworkMode.value === 'custom') {
    localStorage.setItem('movie-tmdb-custom-api-base', tmdbApiBase.value.trim())
    localStorage.setItem('movie-tmdb-custom-image-base', tmdbImageBase.value.trim())
  }
  tmdbNetworkMode.value = mode
  refreshTmdbEndpoints()
}

function tmdbRequest(url, params = {}) {
  const credential = tmdbToken.value.trim().replace(/^Bearer\s+/i, '').replace(/^['"]|['"]$/g, '').trim()
  const search = new URLSearchParams(params)
  const headers: Record<string, string> = { accept: 'application/json' }
  if (credential.startsWith('eyJ')) headers.Authorization = `Bearer ${credential}`
  else search.set('api_key', credential)
  const separator = url.includes('?') ? '&' : '?'
  return { url: search.toString() ? `${url}${separator}${search}` : url, options: { headers } }
}

async function executeTmdbRequest(request) {
  if (Capacitor.isNativePlatform()) {
    try {
      const response = await Promise.race<HttpResponse>([
        CapacitorHttp.get({
          url: request.url,
          headers: request.options.headers,
          connectTimeout: 10000,
          readTimeout: 15000,
          responseType: 'json',
        }),
        new Promise<HttpResponse>((_, reject) => window.setTimeout(() => reject(new Error('连接超时')), 18000)),
      ])
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        json: async () => response.data,
      }
    } catch (error) {
      const message = String(error?.message || error || '')
      if (/timeout|timed out/i.test(message)) throw new Error('连接超时')
      if (/unable to resolve host|unknown host|dns/i.test(message)) throw new Error('手机无法解析 TMDB 域名')
      if (/cleartext/i.test(message)) throw new Error('自定义地址必须使用 HTTPS')
      throw new Error(message || '手机网络请求失败')
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    return await fetch(request.url, { ...request.options, signal: controller.signal })
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('连接超时')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function handleAvatarUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarUploadMessage.value = '请选择图片文件。'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      const size = 256
      const side = Math.min(image.width, image.height)
      const offsetX = (image.width - side) / 2
      const offsetY = (image.height - side) / 2
      canvas.width = size
      canvas.height = size
      canvas.getContext('2d').drawImage(image, offsetX, offsetY, side, side, 0, 0, size, size)
      avatarUrl.value = canvas.toDataURL('image/jpeg', .86)
      avatarUploadMessage.value = `${file.name} · 已保存到当前浏览器`
      showSettingsAutoSaved('本地头像已自动保存')
    }
    if (typeof reader.result === 'string') image.src = reader.result
  }
  reader.readAsDataURL(file)
}

function openProfileColorPicker(type) {
  if (activeProfileColor.value === type) {
    activeProfileColor.value = null
    return
  }
  activeProfileColor.value = type
  pendingProfileColor.value = type === 'background' ? profileBackgroundColor.value : avatarRingColor.value
}

function confirmProfileColor() {
  if (activeProfileColor.value === 'background') profileBackgroundColor.value = pendingProfileColor.value
  if (activeProfileColor.value === 'ring') avatarRingColor.value = pendingProfileColor.value
  activeProfileColor.value = null
  showSettingsAutoSaved('个人资料颜色已自动保存')
}

function showHome() {
  if (currentPage.value === 'home') return
  libraryDateExpanded.value = false
  libraryMediaMenuOpen.value = false
  transitionDirection.value = 'back'
  activeTab.value = 'home'
  currentPage.value = 'home'
}

function showLibrary() {
  if (currentPage.value === 'library') return
  transitionDirection.value = 'forward'
  activeTab.value = 'list'
  currentPage.value = 'library'
}

function dismissLibraryPopovers(event) {
  if (libraryDateExpanded.value && !event.target.closest('.date-dock')) libraryDateExpanded.value = false
  if (libraryMediaMenuOpen.value && !event.target.closest('.library-media-switch')) libraryMediaMenuOpen.value = false
}

function libraryPosterStyle(movie) {
  const path = movie.backdropUrl || movie.posterUrl || movie.backdrop_path || movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `${tmdbImageBase.value.trim().replace(/\/$/, '')}/w500${path}`
    return { backgroundImage: `url(${src})` }
  }
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : undefined
}

function movieTone(movie) {
  return ({ pop: '#5c9fb3', demon: '#b66632', crayon: '#d0ae64', coco: '#8e659d' })[movie.poster] || '#7c8796'
}

function markLibraryWatched(movie) {
  if (movie.watched || markingWatched.value.includes(movie.id)) return
  if (armedWatched.value !== movie.id) {
    armedWatched.value = movie.id
    window.clearTimeout(watchConfirmTimer)
    pushNotice(libraryNotices, { title: '再点一次确认', message: `将《${movie.title}》设为已观看`, tone: 'warning' }, NOTICE_DURATION)
    watchConfirmTimer = window.setTimeout(() => {
      armedWatched.value = null
    }, NOTICE_DURATION)
    return
  }
  armedWatched.value = null
  markingWatched.value = [...markingWatched.value, movie.id]
  window.setTimeout(() => {
    movie.watched = true
    if (!movie.watchedDate) movie.watchedDate = localDateKey()
    markingWatched.value = markingWatched.value.filter((id) => id !== movie.id)
  }, 920)
}

function toggleLibraryWatchStatus(movie) {
  movie.watched = !movie.watched
  if (movie.watched && !movie.watchedDate) movie.watchedDate = localDateKey()
  armedWatched.value = null
  pushNotice(libraryNotices, {
    title: movie.watched ? '已设为已观看' : '已设为未观看',
    message: `《${movie.title}》的观看状态已更新`,
    tone: 'success',
  }, NOTICE_DURATION)
}

function toggleLibraryMovie(id) {
  expandedLibraryId.value = expandedLibraryId.value === id ? null : id
}

async function toggleLibrarySearch() {
  librarySearchOpen.value = !librarySearchOpen.value
  if (librarySearchOpen.value) {
    await nextTick()
    librarySearchInput.value?.focus()
  } else {
    libraryQuery.value = ''
  }
}

function closeRecordSheet() {
  if (recordClosing.value) return
  recordClosing.value = true
  window.setTimeout(() => {
    addOpen.value = false
    recordExpanded.value = false
    selectedTmdbResult.value = null
    recordNotices.value = []
    recordMode.value = 'search'
    recordClosing.value = false
  }, recordExpanded.value ? 560 : 320)
}

function openTmdbSettingsFromRecord() {
  closeRecordSheet()
  window.setTimeout(() => openSettings('tmdb'), 570)
}

function startRecord() {
  recordMode.value = 'search'
  recordExpanded.value = true
}

function startImport() {
  recordMode.value = 'import'
  recordExpanded.value = true
}

function normalizeImportTitle(rawTitle: string) {
  return rawTitle
    .replace(/^\s*\[[xX ]\]\s*/, '')
    .replace(/[⭐★☆]+/g, '')
    .replace(/[（(]\s*\d+\s*集(?:剧)?\s*[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasChineseTitle(value: string) {
  return /[\u3400-\u9fff]/u.test(value)
}

function importTitleKey(value: string) {
  return value.toLocaleLowerCase('zh-CN').replace(/[\s·:：!！?？,，.。'"“”‘’《》()（）\-—_]/g, '')
}

function addImportDraft(title: string, watched: boolean) {
  const normalizedTitle = normalizeImportTitle(title)
  if (!hasChineseTitle(normalizedTitle)) return false
  const key = importTitleKey(normalizedTitle)
  const allDrafts = [...importDraftWatched.value, ...importDraftUnwatched.value]
  if (allDrafts.some((item) => importTitleKey(item.title) === key)) return false
  const item = {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: normalizedTitle,
  }
  ;(watched ? importDraftWatched : importDraftUnwatched).value.push(item)
  return true
}

function parseImportText(text: string) {
  let addedCount = 0
  text.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*\[([xX ])\]\s*(.+)$/)
    if (!match) return
    if (addImportDraft(match[2], match[1].toLowerCase() === 'x')) addedCount += 1
  })
  return addedCount
}

function importWatchedValue(value: unknown) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['x', '1', 'true', 'yes', '是', '已观看', '看过', '已看'].includes(normalized)) return true
  if (['0', 'false', 'no', '否', '未观看', '未看', '待看'].includes(normalized)) return false
  return null
}

async function parseImportWorkbook(buffer: ArrayBuffer) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  let addedCount = 0
  workbook.SheetNames.forEach((sheetName) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' }) as unknown[][]
    if (!rows.length) return
    const header = rows[0].map((cell) => String(cell).trim())
    const titleColumn = header.findIndex((cell) => /片名|电影|影片|标题|名称/.test(cell))
    const watchedColumn = header.findIndex((cell) => /观看|状态|是否看过|已看/.test(cell))
    const hasHeader = titleColumn >= 0
    rows.slice(hasHeader ? 1 : 0).forEach((row) => {
      const cells = row.map((cell) => String(cell).trim()).filter(Boolean)
      if (!cells.length) return
      const checklistCell = cells.find((cell) => /^\s*\[[xX ]\]\s*/.test(cell))
      if (checklistCell) {
        const match = checklistCell.match(/^\s*\[([xX ])\]\s*(.+)$/)
        if (match && addImportDraft(match[2], match[1].toLowerCase() === 'x')) addedCount += 1
        return
      }
      const title = titleColumn >= 0
        ? String(row[titleColumn] ?? '')
        : cells.find((cell) => hasChineseTitle(cell) && importWatchedValue(cell) === null && !/^\d{4}$/.test(cell))
      if (!title) return
      const watched = watchedColumn >= 0
        ? importWatchedValue(row[watchedColumn]) ?? false
        : importWatchedValue(sheetName) ?? cells.map(importWatchedValue).find((value) => value !== null) ?? false
      if (addImportDraft(title, watched)) addedCount += 1
    })
  })
  return addedCount
}

async function handleImportFile(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const extension = file.name.split('.').pop()?.toLowerCase()
    const addedCount = extension === 'xlsx' || extension === 'xls' || extension === 'csv'
      ? await parseImportWorkbook(await file.arrayBuffer())
      : parseImportText(await file.text())
    showRecordNotice(
      addedCount ? '文件解析完成' : '没有可导入条目',
      addedCount ? `已生成 ${addedCount} 条中文片名，请先检查分类。` : 'TXT 需使用 [x]/[ ]；Excel 需包含中文片名，可附观看状态列。',
      addedCount ? 'success' : 'warning',
    )
  } catch {
    showRecordNotice('读取失败', '无法读取文件，请检查 TXT、Excel 或 CSV 的内容格式。', 'warning')
  } finally {
    input.value = ''
  }
}

function moveImportDraft(item, fromWatched: boolean) {
  const source = fromWatched ? importDraftWatched : importDraftUnwatched
  const target = fromWatched ? importDraftUnwatched : importDraftWatched
  source.value = source.value.filter((draft) => draft.id !== item.id)
  target.value.push(item)
}

function removeImportDraft(item, watched: boolean) {
  const source = watched ? importDraftWatched : importDraftUnwatched
  source.value = source.value.filter((draft) => draft.id !== item.id)
}

function clearImportDrafts() {
  importDraftWatched.value = []
  importDraftUnwatched.value = []
}

function confirmImportDrafts() {
  const drafts = [
    ...importDraftWatched.value.map((item) => ({ ...item, watched: true })),
    ...importDraftUnwatched.value.map((item) => ({ ...item, watched: false })),
  ]
  if (!drafts.length) return
  const existingTitles = new Set(movieRecords.value.map((movie) => importTitleKey(movie.title || '')))
  const today = new Date().toISOString().slice(0, 10)
  const importable = drafts.filter((item) => !existingTitles.has(importTitleKey(item.title)))
  const records = importable.map((item, index) => ({
    id: `import-${Date.now()}-${index}`,
    title: item.title,
    originalTitle: item.title,
    meta: '中文清单导入 · 电影',
    year: '待定',
    rating: null,
    personalRating: null,
    tmdbRating: null,
    tmdbVoteCount: 0,
    releaseDate: '',
    originalLanguage: 'zh',
    genreIds: [],
    watched: item.watched,
    watchedDate: item.watched ? today : '',
    recordDate: today,
    poster: 'import',
    posterText: item.title,
    poster_path: '',
    backdrop_path: '',
    overview: '通过中文片名清单导入，影片资料可稍后补充。',
    feeling: item.watched ? '已观看，等待补充评价。' : '已加入待看清单。',
  }))
  prependMovieRecords(records)
  clearImportDrafts()
  showRecordNotice(
    records.length ? '导入成功' : '无需重复导入',
    records.length ? `已写入 ${records.length} 部，跳过 ${drafts.length - records.length} 部重复片名。` : '待导入片名均已存在。',
    records.length ? 'success' : 'warning',
  )
}

function tmdbPoster(result) {
  if (!result.poster_path) return ''
  return `${tmdbImageBase.value.trim().replace(/\/$/, '')}/w342${result.poster_path}`
}

async function searchTmdb({ refresh = false } = {}) {
  const query = (refresh ? tmdbSearchLastQuery.value : tmdbQuery.value).trim()
  const token = tmdbToken.value.trim()
  if (!query) return
  if (!token) {
    tmdbSearchState.value = 'error'
    tmdbSearchMessage.value = '请先在 TMDB 设置中填写 API 密钥。'
    return
  }
  tmdbSearchState.value = refresh ? 'success' : 'loading'
  tmdbRefreshing.value = refresh
  tmdbSearchMessage.value = ''
  selectedTmdbResult.value = null
  tmdbSearchLastQuery.value = query
  try {
    const base = tmdbApiBase.value.trim().replace(/\/$/, '')
    const request = tmdbRequest(`${base}/search/movie`, { query, language: 'zh-CN', include_adult: 'false', page: '1' })
    const response = await executeTmdbRequest(request)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    tmdbResults.value = data.results || []
    tmdbVisibleCount.value = 10
    tmdbLoadArmed.value = false
    tmdbPage.value = 1
    tmdbTotalPages.value = Math.min(data.total_pages || 1, 500)
    tmdbTotalResults.value = data.total_results ?? tmdbResults.value.length
    tmdbSearchState.value = 'success'
  } catch (error) {
    tmdbResults.value = []
    tmdbSearchState.value = 'error'
    tmdbSearchMessage.value = `搜索失败（${error.message}），请检查 Token 与网络设置。`
  } finally {
    tmdbRefreshing.value = false
    tmdbRefreshPull.value = 0
  }
}

async function loadMoreTmdb() {
  if (tmdbLoadingMore.value || tmdbSearchState.value !== 'success' || tmdbVisibleCount.value >= tmdbTotalResults.value) return
  tmdbLoadingMore.value = true
  try {
    await new Promise((resolve) => window.setTimeout(resolve, 360))
    if (tmdbVisibleCount.value < tmdbResults.value.length) {
      tmdbVisibleCount.value = Math.min(tmdbVisibleCount.value + 10, tmdbResults.value.length, tmdbTotalResults.value)
      return
    }
    if (tmdbPage.value >= tmdbTotalPages.value) return
    const base = tmdbApiBase.value.trim().replace(/\/$/, '')
    const nextPage = tmdbPage.value + 1
    const request = tmdbRequest(`${base}/search/movie`, { query: tmdbSearchLastQuery.value, language: 'zh-CN', include_adult: 'false', page: String(nextPage) })
    const response = await executeTmdbRequest(request)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const existingIds = new Set(tmdbResults.value.map((item) => item.id))
    tmdbResults.value = [...tmdbResults.value, ...(data.results || []).filter((item) => !existingIds.has(item.id))]
    tmdbPage.value = nextPage
    tmdbVisibleCount.value = Math.min(tmdbVisibleCount.value + 10, tmdbResults.value.length, tmdbTotalResults.value)
  } catch (error) {
    tmdbSearchMessage.value = `加载更多失败（${error.message}），请稍后重试。`
  } finally {
    tmdbLoadingMore.value = false
  }
}

function handleTmdbScroll(event) {
  const target = event.currentTarget
  if (tmdbLoadArmed.value && target.scrollHeight - target.scrollTop - target.clientHeight < 70) {
    tmdbLoadArmed.value = false
    loadMoreTmdb()
  }
}

function armTmdbLoad(event) {
  if (event.deltaY === undefined || event.deltaY > 0) tmdbLoadArmed.value = true
}

function startTmdbPull(event) {
  if (event.currentTarget.scrollTop > 0 || tmdbRefreshing.value) return
  tmdbPullStart.value = event.touches?.[0]?.clientY ?? event.clientY
}

function moveTmdbPull(event) {
  if (event.currentTarget.scrollTop > 0) {
    tmdbLoadArmed.value = true
    return
  }
  if (tmdbPullStart.value === null) return
  const clientY = event.touches?.[0]?.clientY ?? event.clientY
  tmdbRefreshPull.value = Math.min(72, Math.max(0, (clientY - tmdbPullStart.value) * .42))
}

function endTmdbPull() {
  const shouldRefresh = tmdbRefreshPull.value >= 48
  tmdbPullStart.value = null
  if (shouldRefresh) searchTmdb({ refresh: true })
  else tmdbRefreshPull.value = 0
}

function resetTmdbSearch() {
  tmdbQuery.value = ''
  tmdbResults.value = []
  tmdbSearchState.value = 'idle'
  tmdbSearchMessage.value = ''
  tmdbSearchLastQuery.value = ''
  tmdbPage.value = 0
  tmdbTotalPages.value = 0
  tmdbTotalResults.value = 0
  tmdbVisibleCount.value = 10
  tmdbLoadArmed.value = false
  selectedTmdbResult.value = null
}

function showRecordNotice(title, message, type = 'success') {
  pushNotice(recordNotices, { title, message, type }, RECORD_NOTICE_DURATION)
}

function viewTmdbResult(result) {
  if (selectedTmdbResult.value?.id === result.id) {
    selectedTmdbResult.value = null
    return
  }
  selectedTmdbResult.value = result
  addMediaType.value = '电影'
  addMediaMenuOpen.value = false
  addWatched.value = false
  addWatchedDate.value = new Date().toISOString().slice(0, 10)
  addDatePickerOpen.value = false
  addRating.value = 0
  addReview.value = ''
  overviewExpanded.value = false
}

function chooseAddMediaType(type) {
  addMediaType.value = type
  addMediaMenuOpen.value = false
}

function toggleWatchedDatePicker() {
  addDatePickerOpen.value = !addDatePickerOpen.value
  if (addDatePickerOpen.value) addMediaMenuOpen.value = false
}

function handleAddWatchedChange() {
  if (!addWatched.value) addDatePickerOpen.value = false
}

function addTmdbMovie(result) {
  if (movieRecords.value.some((movie) => String(movie.id) === `tmdb-${result.id}`)) {
    showRecordNotice('无需重复添加', '这部影片已经在你的记录中了。', 'warning')
    return
  }
  const movie = {
    id: `tmdb-${result.id}`,
    tmdbId: result.id,
    title: result.title || result.original_title,
    originalTitle: result.original_title || result.title,
    meta: `TMDB · ${addMediaType.value}`,
    year: result.release_date?.slice(0, 4) || '待定',
    rating: addWatched.value && addRating.value ? addRating.value : null,
    personalRating: addWatched.value && addRating.value ? addRating.value : null,
    tmdbRating: result.vote_average ? Number(result.vote_average.toFixed(1)) : null,
    tmdbVoteCount: result.vote_count || 0,
    releaseDate: result.release_date || '',
    originalLanguage: result.original_language || '',
    genreIds: result.genre_ids || [],
    watched: addWatched.value,
    watchedDate: addWatched.value ? addWatchedDate.value : '',
    recordDate: new Date().toISOString().slice(0, 10),
    poster: 'tmdb',
    posterText: result.title || result.original_title,
    poster_path: result.poster_path,
    backdrop_path: result.backdrop_path,
    overview: result.overview || '暂无剧情简介。',
    feeling: addWatched.value ? (addReview.value.trim() || '已观看，暂时没有写下评价。') : '刚刚加入待看清单。',
  }
  prependMovieRecords([movie])
  activeWatchStat.value = addWatched.value ? 'watched' : 'unwatched'
  selectedTmdbResult.value = null
  showRecordNotice('添加成功', `《${result.title || result.original_title}》已加入${addWatched.value ? '已观看' : '未观看'}。`)
}

async function ensureTmdbDetails(movie) {
  const rawId = movie?.tmdbId ?? (String(movie?.id || '').startsWith('tmdb-') ? String(movie.id).slice(5) : null)
  if (!rawId || movie.detailState === 'loading' || (movie.detailState === 'success' && movie.detailVersion >= 2)) return
  if (!tmdbToken.value.trim()) {
    movie.detailState = 'error'
    movie.detailError = '请先在设置中配置 TMDB API 密钥。'
    return
  }

  movie.detailState = 'loading'
  movie.detailError = ''
  try {
    const base = tmdbApiBase.value.trim().replace(/\/$/, '')
    const request = tmdbRequest(`${base}/movie/${rawId}`, {
      language: 'zh-CN',
      append_to_response: 'credits,videos,release_dates,images,keywords',
      include_video_language: 'zh,en,null',
      include_image_language: 'zh,en,null',
    })
    const response = await executeTmdbRequest(request)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const detail = await response.json()
    let collectionDetail = null
    if (detail.belongs_to_collection?.id) {
      const collectionRequest = tmdbRequest(`${base}/collection/${detail.belongs_to_collection.id}`, { language: 'zh-CN' })
      const collectionResponse = await executeTmdbRequest(collectionRequest)
      if (collectionResponse.ok) collectionDetail = await collectionResponse.json()
    }
    const director = detail.credits?.crew?.find((person) => person.job === 'Director')
    const trailer = detail.videos?.results?.find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official)
      || detail.videos?.results?.find((video) => video.site === 'YouTube' && ['Trailer', 'Teaser'].includes(video.type))
    const regionRelease = detail.release_dates?.results?.find((item) => item.iso_3166_1 === 'CN')
      || detail.release_dates?.results?.find((item) => item.iso_3166_1 === 'US')
    const certification = regionRelease?.release_dates?.find((item) => item.certification)?.certification || ''

    Object.assign(movie, {
      tmdbId: detail.id,
      title: detail.title || movie.title,
      originalTitle: detail.original_title || movie.originalTitle,
      overview: detail.overview || movie.overview,
      backdrop_path: detail.backdrop_path || movie.backdrop_path,
      poster_path: detail.poster_path || movie.poster_path,
      releaseDate: detail.release_date || movie.releaseDate,
      year: detail.release_date?.slice(0, 4) || movie.year,
      runtime: detail.runtime || null,
      genres: detail.genres || [],
      tagline: detail.tagline || '',
      tmdbRating: detail.vote_average ? Number(detail.vote_average.toFixed(1)) : movie.tmdbRating,
      tmdbVoteCount: detail.vote_count || movie.tmdbVoteCount || 0,
      popularity: detail.popularity || movie.popularity || 0,
      certification,
      detailVersion: 2,
      filmInfo: {
        countries: (detail.production_countries || []).map((item) => item.name).filter(Boolean),
        languages: (detail.spoken_languages || []).map((item) => item.name || item.english_name).filter(Boolean),
        originalLanguage: detail.original_language || '',
        status: detail.status || '',
      },
      productionCompanies: (detail.production_companies || []).slice(0, 6).map((company) => ({ id: company.id, name: company.name, logo_path: company.logo_path, country: company.origin_country })),
      crew: (detail.credits?.crew || []).filter((person) => ['Director', 'Screenplay', 'Writer', 'Producer', 'Director of Photography', 'Original Music Composer', 'Editor'].includes(person.job)).filter((person, index, list) => list.findIndex((item) => item.id === person.id && item.job === person.job) === index).slice(0, 10).map((person) => ({ id: person.id, name: person.name, role: person.job, profile_path: person.profile_path })),
      keywords: (detail.keywords?.keywords || detail.keywords?.results || []).slice(0, 14).map((keyword) => keyword.name),
      releases: (detail.release_dates?.results || []).filter((region) => region.release_dates?.length).slice(0, 8).map((region) => {
        const release = region.release_dates[0]
        return { country: region.iso_3166_1, date: release.release_date?.slice(0, 10) || '', certification: release.certification || '', type: release.type || 0 }
      }),
      videos: (detail.videos?.results || []).filter((video) => (video.site === 'YouTube' || video.site === 'Vimeo') && video.key).slice(0, 8).map((video) => ({ id: video.id, name: video.name, type: video.type, official: video.official, url: video.site === 'YouTube' ? `https://www.youtube.com/watch?v=${video.key}` : `https://vimeo.com/${video.key}` })),
      posters: (detail.images?.posters || []).slice(0, 10).map((image) => ({ file_path: image.file_path, width: image.width, height: image.height, language: image.iso_639_1 })),
      collection: collectionDetail ? {
        id: collectionDetail.id,
        name: collectionDetail.name,
        overview: collectionDetail.overview,
        poster_path: collectionDetail.poster_path,
        backdrop_path: collectionDetail.backdrop_path,
        parts: (collectionDetail.parts || []).sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || ''))).map((part) => ({ id: part.id, title: part.title, year: part.release_date?.slice(0, 4) || '', poster_path: part.poster_path })),
      } : null,
      director: director ? { id: director.id, name: director.name, role: '导演', profile_path: director.profile_path } : null,
      cast: (detail.credits?.cast || []).slice(0, 8).map((person) => ({
        id: person.id,
        name: person.name,
        role: person.character || '演员',
        profile_path: person.profile_path,
      })),
      trailer: trailer ? { key: trailer.key, name: trailer.name, site: trailer.site } : null,
      stills: (detail.images?.backdrops || []).slice(0, 8).map((image) => ({
        file_path: image.file_path,
        width: image.width,
        height: image.height,
      })),
      detailState: 'success',
    })
    movie.meta = movie.genres.length ? movie.genres.map((genre) => genre.name).join(' · ') : movie.meta
  } catch (error) {
    movie.detailState = 'error'
    movie.detailError = `详细资料加载失败（${error.message}）`
  }
}

function updateWatched(value) {
  if (!selectedMovie.value) return
  selectedMovie.value.watched = value
  if (value && !selectedMovie.value.watchedDate) selectedMovie.value.watchedDate = localDateKey()
}

function updateMovieRecord(record) {
  if (!selectedMovie.value) return
  Object.assign(selectedMovie.value, {
    personalRating: record.rating || null,
    rating: record.rating || null,
    watchedDate: record.date || '',
    feeling: record.review?.trim() || '',
    rewatchTag: record.rewatchTag || '',
  })
}

async function requestPersonDetails(person) {
  if (!person?.id || person.detailState === 'loading' || person.detailState === 'success') return
  person.detailState = 'loading'
  try {
    const base = tmdbApiBase.value.trim().replace(/\/$/, '')
    const request = tmdbRequest(`${base}/person/${person.id}`, { language: 'zh-CN', append_to_response: 'movie_credits' })
    const response = await executeTmdbRequest(request)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const detail = await response.json()
    const imageBase = tmdbImageBase.value.trim().replace(/\/$/, '')
    Object.assign(person, {
      biography: detail.biography || '',
      birthday: detail.birthday || '',
      placeOfBirth: detail.place_of_birth || '',
      knownFor: (detail.movie_credits?.cast || []).filter((work) => work.poster_path).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 8).map((work) => ({ id: work.id, title: work.title, year: work.release_date?.slice(0, 4) || '', poster: `${imageBase}/w185${work.poster_path}` })),
      detailState: 'success',
    })
  } catch (error) {
    person.detailState = 'error'
  }
}

function navigateDetail(direction) {
  const currentIndex = movieRecords.value.findIndex((movie) => movie.id === selectedMovie.value?.id)
  if (currentIndex < 0 || movieRecords.value.length < 2) return
  const nextIndex = (currentIndex + direction + movieRecords.value.length) % movieRecords.value.length
  selectedMovie.value = movieRecords.value[nextIndex]
  ensureTmdbDetails(selectedMovie.value)
}
</script>

<template>
  <main class="app-shell">
    <Transition name="first-launch-dismiss">
      <section
        v-if="showStartupAnimation"
        class="first-launch-intro"
        role="dialog"
        aria-modal="true"
        aria-label="CineLog 启动动画"
      >
        <div class="first-launch-intro__grain" aria-hidden="true"></div>
        <div class="first-launch-intro__beam" aria-hidden="true"></div>
        <div class="first-launch-intro__content">
          <div class="first-launch-intro__mark">
            <span class="first-launch-intro__halo" aria-hidden="true"></span>
            <img :src="cinelogMark" alt="" />
          </div>
          <div class="first-launch-intro__copy">
            <h1>CineLog</h1>
            <p>让每一次观影，都有迹可循</p>
          </div>
          <div class="first-launch-intro__progress" aria-hidden="true"><i></i></div>
        </div>
      </section>
    </Transition>

    <section
      ref="phoneShell"
      class="phone"
      :class="[{ 'phone--detail': currentPage === 'detail' }, `motion-${motionIntensity}`]"
      :aria-label="currentPage === 'home' ? `${username}的观影记录首页` : currentPage === 'library' ? '电影列表页面' : currentPage === 'detail' ? '电影详情页面' : '个人设置页面'"
      @pointerdown.capture="edgeBackPointerDown"
      @pointermove.capture="edgeBackPointerMove"
      @pointerup.capture="edgeBackPointerUp"
      @pointercancel.capture="cancelEdgeBackGesture"
      @click.capture="handlePhoneClick"
    >
      <div class="ambient-orb ambient-orb--one" aria-hidden="true"></div>
      <div class="ambient-orb ambient-orb--two" aria-hidden="true"></div>

      <NoticeStack v-if="addOpen && (currentPage === 'home' || currentPage === 'library')" :notices="recordNotices" placement="record" :motion="motionIntensity" :duration="RECORD_NOTICE_DURATION" closable @dismiss="dismissNotice(recordNotices, $event)" />
      <NoticeStack v-else-if="currentPage === 'home'" :notices="homeNotices" placement="home" :motion="motionIntensity" :duration="NOTICE_DURATION" @dismiss="dismissNotice(homeNotices, $event)" />
      <NoticeStack v-else-if="currentPage === 'library'" :notices="libraryNotices" placement="library" :motion="motionIntensity" :duration="NOTICE_DURATION" @dismiss="dismissNotice(libraryNotices, $event)" />
      <NoticeStack v-else-if="currentPage === 'settings'" :notices="settingsNotices" placement="settings" :motion="motionIntensity" :duration="NOTICE_DURATION" @dismiss="dismissNotice(settingsNotices, $event)" />

      <Transition :name="surfaceTransitionName" :duration="surfaceTransitionDuration">
        <section v-if="surfacePage === 'home'" key="home" class="surface-view home-surface">
        <header class="topbar surface-piece" style="--piece-order: 0">
          <div class="welcome-row">
            <div>
              <h1>{{ username }}的观影记录</h1>
              <p>把看过的故事，留在这里。</p>
            </div>
            <button class="avatar-button" :style="{ '--avatar-ring': avatarRingColor }" aria-label="打开个人设置" @click="openSettings()">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <span v-else>{{ username.slice(0, 1) }}</span>
            </button>
          </div>

          <div class="dashboard-controls">
            <section class="status-switch" :class="[`is-${activeWatchStat}`, { switching: statusSwitching }]" aria-label="观看状态筛选">
              <i class="status-switch__dot" aria-hidden="true"></i>
              <span class="status-switch__thumb" aria-hidden="true"></span>
              <button :class="{ selected: activeWatchStat === 'unwatched' }" @click="setWatchStat('unwatched')">
                <span>未观看</span><strong>{{ unwatchedCount }}</strong>
              </button>
              <button :class="{ selected: activeWatchStat === 'watched' }" @click="setWatchStat('watched')">
                <span>已观看</span><strong>{{ watchedCount }}</strong>
              </button>
            </section>

            <button class="view-mode-button" :class="{ 'is-list': viewMode === 'list', switching: viewModeSwitching }" :disabled="viewModeSwitching" :aria-label="viewMode === 'cards' ? '切换为列表视图' : '切换为卡片视图'" @click="toggleViewMode">
              <Transition name="view-mode-icon" mode="out-in">
                <img :key="viewMode" :src="viewMode === 'cards' ? pixelCards : pixelRows" alt="" />
              </Transition>
            </button>
          </div>
        </header>

        <section class="record-stage" :class="[{ 'list-stage': viewMode === 'list' }, `is-${activeWatchStat}`]" aria-labelledby="recent-heading">
          <div class="stage-heading surface-piece" style="--piece-order: 1">
            <div>
              <h2 id="recent-heading">{{ activeWatchStat === 'watched' ? '已观看' : '未观看' }}</h2>
              <p v-if="activeWatchStat === 'watched'">{{ watchedSubtitle }}</p>
              <p v-else>还有 <strong class="unwatched-number">{{ unwatchedCount }}</strong> 部等待观看</p>
            </div>
            <div v-if="activeWatchStat === 'watched' && statPeriod === 'year'" class="year-picker">
              <button class="year-select" aria-label="选择年份" :aria-expanded="yearMenuOpen" @click="yearMenuOpen = !yearMenuOpen">
                <span>{{ selectedYear }} 年</span><ChevronDown :size="14" />
              </button>
              <Transition name="year-menu">
                <div v-if="yearMenuOpen" class="year-menu" role="listbox" aria-label="年份列表">
                  <button v-for="year in watchedYears" :key="year" :class="{ selected: selectedYear === year }" role="option" :aria-selected="selectedYear === year" @click="chooseYear(year)">
                    <span>{{ year }} 年</span><Check v-if="selectedYear === year" :size="13" />
                  </button>
                </div>
              </Transition>
            </div>
            <span v-else-if="activeWatchStat === 'watched'" class="period-badge">{{ periodLabel }}</span>
          </div>

          <Transition :name="homeSwapTransition" mode="out-in" class="surface-piece" style="--piece-order: 2">
            <MovieCarousel v-if="viewMode === 'cards'" :key="`cards-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="displayedMovies" :database-empty="movieRecordsReady && !movieRecords.length" :active="currentPage === 'home'" :motion-intensity="motionIntensity" :image-base="tmdbImageBase" @mark-watched="markWatched" @open-detail="openDetail" />
            <MovieList v-else :key="`list-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="displayedMovies" :database-empty="movieRecordsReady && !movieRecords.length" :image-base="tmdbImageBase" @open-detail="openHomeListDetail" @watch-warning="showHomeWatchNotice" @mark-watched="markWatched" />
          </Transition>
        </section>
        </section>

        <section v-else-if="surfacePage === 'library'" key="library" class="surface-view library-surface" :class="`tools-${libraryControlsSide}`" aria-label="电影列表页面" @click="dismissLibraryPopovers">
          <header class="library-header surface-piece" style="--piece-order: 0">
            <div>
              <h1>
                <RotatingText
                  :texts="libraryMediaFrames"
                  :auto="false"
                  stagger-from="last"
                  :stagger-duration="0.018"
                  :initial="{ y: '105%', opacity: 0, filter: 'blur(4px)' }"
                  :animate="{ y: 0, opacity: 1, filter: 'blur(0px)' }"
                  :exit="{ y: '-105%', opacity: 0, filter: 'blur(4px)' }"
                  :transition="{ type: 'spring', damping: 28, stiffness: 360 }"
                  split-level-class-name="rotating-title__clip"
                />
                <span class="library-title-separator">·</span>
                <span class="library-title-status">
                  <RotatingText
                    :texts="libraryStatusFrames"
                    :auto="false"
                    stagger-from="last"
                    :stagger-duration="0.018"
                    :initial="{ y: '105%', opacity: 0, filter: 'blur(4px)' }"
                    :animate="{ y: 0, opacity: 1, filter: 'blur(0px)' }"
                    :exit="{ y: '-105%', opacity: 0, filter: 'blur(4px)' }"
                    :transition="{ type: 'spring', damping: 28, stiffness: 360 }"
                    split-level-class-name="rotating-title__clip"
                  />
                </span>
              </h1>
            </div>
            <div class="library-media-switch">
              <button aria-label="切换内容显示" :aria-expanded="libraryMediaMenuOpen" @click="libraryMediaMenuOpen = !libraryMediaMenuOpen"><span>{{ libraryMediaType }}</span><ChevronDown :size="13" /></button>
              <Transition name="media-menu">
                <div v-if="libraryMediaMenuOpen" class="library-media-menu"><button v-for="type in libraryMediaTypes" :key="type" :class="{ selected: libraryMediaType === type }" @click="selectLibraryMediaType(type)">{{ type }}</button></div>
              </Transition>
            </div>
          </header>

          <Transition name="search-reveal">
            <label v-if="librarySearchOpen" class="search-box library-search-reveal surface-piece" style="--piece-order: 1">
              <Search :size="18" stroke-width="2.2" />
              <input ref="librarySearchInput" v-model="libraryQuery" type="text" placeholder="搜索观影记录" aria-label="搜索观影记录" />
              <button v-if="libraryQuery" type="button" class="library-search-clear" aria-label="清空搜索内容" @click.prevent="libraryQuery = ''"><X :size="13" /></button>
              <button type="button" class="library-search-collapse" aria-label="收起搜索" @click.prevent="toggleLibrarySearch">收起</button>
            </label>
          </Transition>

          <div class="library-filter-bar surface-piece" style="--piece-order: 2" role="group" aria-label="片库快捷筛选">
            <div class="library-edge-tools">
              <button class="library-search-chip" :class="{ selected: librarySearchOpen }" aria-label="打开搜索" @click="toggleLibrarySearch"><Search :size="13" /></button>
            </div>
            <div class="library-chip-scroll">
              <button v-for="genre in visibleLibraryGenres" :key="genre" :class="{ selected: libraryGenre === genre }" @click="libraryGenre = genre">{{ genre === 'all' ? '全部类型' : genre }}</button>
            </div>
            <button class="category-chip" aria-label="打开更多分类" @click="categoryOpen = true"><small>更多</small><strong>分类</strong><ChevronRight :size="13" /></button>
          </div>

          <div class="library-timeline surface-piece" :class="{ searching: librarySearchOpen }" style="--piece-order: 3">
            <aside class="date-dock" :class="{ expanded: libraryDateExpanded, active: libraryDateFilterActive, 'year-only': statPeriod === 'year' }" aria-label="日期选择">
              <button class="date-dock__toggle" :aria-expanded="libraryDateExpanded" @click="libraryDateExpanded = !libraryDateExpanded"><small>{{ libraryDateFilterActive ? libraryYearValue : '日期' }}</small><strong>{{ libraryDateFilterActive ? (statPeriod === 'year' ? '全年' : statPeriod === 'month' ? `${libraryMonthValue}月` : `${libraryMonthValue}/${selectedLibraryDay}`) : '全部' }}</strong><ChevronRight :size="13" /></button>
              <div class="date-dock__options">
                <div class="date-option-row"><span>年份</span><div><button v-for="year in libraryYearOptions" :key="year" :class="{ selected: libraryYearValue === year }" @click="libraryYearValue = year; libraryDateFilterActive = true">{{ year }}</button></div></div>
                <div v-if="statPeriod !== 'year'" class="date-option-row"><span>月份</span><div><button v-for="month in 12" :key="month" :class="{ selected: libraryMonthValue === month }" @click="libraryMonthValue = month; libraryDateFilterActive = true">{{ month }}月</button></div></div>
                <div v-if="statPeriod === 'day'" class="date-option-row"><span>日期</span><div><button v-for="date in libraryDateItems" :key="date.day" :class="{ selected: selectedLibraryDay === date.day }" @click="selectedLibraryDay = date.day; libraryDateFilterActive = true; libraryDateExpanded = false">{{ date.day }}</button></div></div>
              </div>
              <button type="button" class="date-dock__reset" aria-label="显示全部日期" @click.stop="resetLibraryDate">全部</button>
            </aside>
            <div class="library-status-stack" role="group" aria-label="观看状态筛选">
              <button class="status-cycle-button" :class="libraryWatchFilter === 'favourite' ? 'is-inactive' : `is-${activeLibraryWatchState.value}`" :aria-label="`当前${activeLibraryWatchState.label}，点击切换观看状态`" @click="cycleLibraryWatchFilter">
                <Transition name="status-cycle" mode="out-in">
                  <span :key="activeLibraryWatchState.value" class="status-cycle-content"><small>{{ activeLibraryWatchState.label }}</small><strong>{{ activeLibraryWatchState.count }}</strong></span>
                </Transition>
                <ChevronDown :size="12" />
              </button>
              <button class="status-cycle-button library-favourite-button" :class="{ selected: libraryWatchFilter === 'favourite' }" aria-label="只看我的喜欢" @click="libraryWatchFilter = libraryWatchFilter === 'favourite' ? 'all' : 'favourite'">
                <span class="status-cycle-content"><small>喜欢</small><strong>{{ favouriteCount }}</strong></span>
                <Star :size="12" :fill="libraryWatchFilter === 'favourite' ? 'currentColor' : 'none'" />
              </button>
            </div>
            <div class="library-list" aria-live="polite">
            <article v-for="(movie, index) in libraryMovies" :key="movie.id" class="library-row" :class="{ expanded: expandedLibraryId === movie.id }" :style="{ '--row-order': index, '--row-tint': movieTone(movie) }">
              <div class="library-row-main" role="button" tabindex="0" :aria-expanded="expandedLibraryId === movie.id" @click="toggleLibraryMovie(movie.id)" @keydown.enter.prevent="toggleLibraryMovie(movie.id)">
                <div class="library-poster" :class="`library-poster--${movie.poster}`" :style="libraryPosterStyle(movie)"><span>{{ movie.posterText }}</span></div>
                <div class="library-copy">
                  <p>{{ movie.meta }} · {{ movie.year }}</p>
                  <h2>{{ movie.title }}</h2>
                  <div class="library-meta"><span class="score" :class="{ muted: movie.rating === null }"><Star :size="12" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '暂无评分' }}</span></div>
                </div>
                <button v-if="movie.watched" class="row-action" :class="{ expanded: expandedLibraryId === movie.id }" :aria-label="expandedLibraryId === movie.id ? `收起${movie.title}` : `展开${movie.title}`" @click.stop="toggleLibraryMovie(movie.id)"><ChevronDown :size="17" /></button>
                <button v-else class="watch-ring" :class="{ armed: armedWatched === movie.id, completing: markingWatched.includes(movie.id) }" :aria-label="armedWatched === movie.id ? `再次确认将${movie.title}标记为已观看` : `将${movie.title}标记为已观看`" @click.stop="markLibraryWatched(movie)">
                  <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-track" cx="18" cy="18" r="14"/><circle class="ring-progress" cx="18" cy="18" r="14"/><path class="ring-check" d="m11.5 18.2 4.2 4.1 8.8-9"/></svg><span v-if="armedWatched === movie.id" class="confirm-dot">!</span>
                </button>
              </div>
              <Transition name="library-expand">
                <div v-if="expandedLibraryId === movie.id" class="library-preview">
                  <div class="library-preview__facts"><span>{{ movie.originalTitle }}</span><span>{{ movie.watched ? '已观看' : '未观看' }}</span></div>
                  <p>{{ movie.overview || movie.feeling || '暂无剧情简介。' }}</p>
                  <div class="library-preview__footer"><button class="library-preview__watch" :class="{ watched: movie.watched }" :aria-label="`将${movie.title}切换为${movie.watched ? '未观看' : '已观看'}`" @click.stop="toggleLibraryWatchStatus(movie)"><span></span>{{ movie.watched ? '已观看' : '未观看' }}</button><button class="library-preview__visit" :aria-label="`访问${movie.title}详情`" @click="openLibraryDetail(movie)">访问 <ArrowUpRight :size="14" /></button></div>
                </div>
              </Transition>
            </article>

            <div v-if="!libraryMovies.length" class="empty-state"><Search :size="24" /><strong>{{ movieRecordsReady && !movieRecords.length ? '片库还是空的' : '没有找到相关电影' }}</strong><span>{{ movieRecordsReady && !movieRecords.length ? '点按下方加号添加第一部电影。' : '试试换一个关键词或筛选条件' }}</span></div>
            </div>
          </div>
        </section>
      </Transition>

      <nav v-if="currentPage === 'home' || currentPage === 'library'" class="bottom-nav" aria-label="主要导航">
        <button class="add-dock" aria-label="添加电影记录" @click="addOpen = true"><img :src="pixelPlus" alt="" /></button>
        <div class="nav-island">
          <button :class="{ selected: activeTab === 'home' }" aria-label="首页" @click="showHome"><img :src="pixelHome" alt="" /></button>
          <button :class="{ selected: activeTab === 'list' }" aria-label="电影列表" @click="showLibrary"><img :src="pixelMovieList" alt="" /></button>
        </div>
      </nav>

      <Transition name="category-modal">
        <div v-if="categoryOpen" class="category-backdrop" @click.self="categoryOpen = false">
          <aside class="category-sheet" aria-label="电影分类面板">
            <div class="sheet-handle"></div>
            <header><div><small>{{ libraryMediaType }}分类</small><h2>选择影片类型</h2></div><button aria-label="关闭分类" @click="categoryOpen = false"><X :size="18" /></button></header>
            <section class="genre-only-section"><h3>常用类型</h3><div class="category-options"><button :class="{ selected: libraryGenre === 'all' }" @click="libraryGenre = 'all'">全部类型</button><button v-for="genre in libraryGenres" :key="genre" :class="{ selected: libraryGenre === genre }" @click="libraryGenre = genre">{{ genre }}</button></div></section>
            <section class="library-sort-section"><h3>排列方式</h3><div class="library-sort-options"><button :class="{ selected: librarySortBy === 'name' }" @click="librarySortBy = 'name'">名字</button><button :class="{ selected: librarySortBy === 'release' }" @click="librarySortBy = 'release'">发布日期</button><button :class="{ selected: librarySortBy === 'rating' }" @click="librarySortBy = 'rating'">评分</button><button :class="{ selected: librarySortBy === 'personal' }" @click="librarySortBy = 'personal'">个人评分</button></div></section>
            <section class="library-date-basis"><h3>日期依据</h3><div class="library-sort-options"><button :class="{ selected: libraryDateBasis === 'record' }" @click="libraryDateBasis = 'record'">记录日期</button><button :class="{ selected: libraryDateBasis === 'release' }" @click="libraryDateBasis = 'release'">发布日期</button></div></section>
            <section class="library-priority-section"><h3>状态优先</h3><div class="library-priority-options"><button class="selected" aria-pressed="true" @click="libraryUnwatchedFirst = true">未观看</button></div></section>
            <button class="category-done" @click="categoryOpen = false">完成</button>
          </aside>
        </div>
      </Transition>

      <div v-if="addOpen && (currentPage === 'home' || currentPage === 'library')" class="sheet-backdrop" :class="{ 'is-recording': recordExpanded, 'is-closing': recordClosing }" @click.self="closeRecordSheet">
        <div class="add-sheet" :class="{ expanded: recordExpanded, closing: recordClosing }" role="dialog" aria-modal="true" aria-label="添加电影记录">
          <div class="sheet-handle"></div>
          <template v-if="!recordExpanded">
            <h2>记录一部电影</h2><p>输入电影名称，从 TMDB 获取封面和影片资料。</p><div class="record-entry-actions"><button @click="startRecord">开始记录</button><button class="record-import-entry" @click="startImport"><Upload :size="15" />导入片单</button></div>
          </template>
          <template v-else-if="recordMode === 'search'">
            <header class="record-header" :class="{ 'has-results': tmdbSearchState === 'success' && tmdbResults.length }"><div><small>{{ tmdbSearchState === 'success' && tmdbResults.length ? `搜索结果 · ${tmdbTotalResults} 部` : '新建记录' }}</small><h2>{{ tmdbSearchState === 'success' && tmdbResults.length ? `“${tmdbSearchLastQuery}”` : '搜索一部电影' }}</h2></div><button aria-label="关闭添加电影" @click="closeRecordSheet"><X :size="19" /></button></header>
            <form class="tmdb-search" :class="{ 'is-complete': tmdbSearchState === 'success' && tmdbResults.length }" @submit.prevent="tmdbSearchState === 'success' && tmdbResults.length ? resetTmdbSearch() : searchTmdb()"><Search :size="18" /><input v-model="tmdbQuery" autofocus type="search" placeholder="输入电影名称，例如：流浪地球" aria-label="TMDB电影名称" /><button type="submit" :disabled="tmdbSearchState === 'loading'">{{ tmdbSearchState === 'loading' ? '搜索中' : tmdbSearchState === 'success' && tmdbResults.length ? '重新搜索' : '搜索' }}</button></form>
            <div v-if="!tmdbToken" class="record-api-note"><Database :size="18" /><div><strong>还没有配置 TMDB API 密钥</strong><span>先完成设置，之后输入名称即可获取电影。</span></div><button @click="openTmdbSettingsFromRecord">去设置</button></div>
            <div v-else-if="tmdbSearchState === 'idle'" class="record-empty"><Search :size="24" /><strong>按名称查找 TMDB</strong><span>搜索结果只用于展示和创建观影记录。</span></div>
            <div v-if="tmdbSearchMessage" class="record-message" :class="`is-${tmdbSearchState}`">{{ tmdbSearchMessage }}</div>
            <div v-if="tmdbSearchState === 'success' && tmdbResults.length" class="tmdb-results-status"><span>已显示 {{ displayedTmdbResults.length }} / {{ tmdbTotalResults }} 部</span><small>每次加载 10 部</small></div>
            <div v-if="tmdbSearchState === 'success' && !tmdbResults.length" class="record-no-results"><Search :size="24" /><strong>没有找到“{{ tmdbSearchLastQuery }}”</strong><span>TMDB 不会自动纠正中文错别字，请检查片名，或尝试原名、英文名。</span></div>
            <div v-if="tmdbResults.length" class="tmdb-results" :style="{ '--refresh-pull': `${tmdbRefreshPull}px` }" @scroll="handleTmdbScroll" @wheel.passive="armTmdbLoad" @touchstart="startTmdbPull" @touchmove="moveTmdbPull" @touchend="endTmdbPull" @touchcancel="endTmdbPull">
              <div class="tmdb-refresh-indicator" :class="{ ready: tmdbRefreshPull >= 48, refreshing: tmdbRefreshing }"><i></i><span>{{ tmdbRefreshing ? '正在刷新…' : tmdbRefreshPull >= 48 ? '松开刷新' : '下拉刷新' }}</span></div>
              <article v-for="(result, index) in displayedTmdbResults" :key="result.id" class="tmdb-result-item" :class="{ 'is-open': selectedTmdbResult?.id === result.id }" :style="{ '--result-delay': `${(index % 10) * 48}ms` }">
                <div class="tmdb-result-summary">
                  <div class="tmdb-result-poster" :style="tmdbPoster(result) ? { backgroundImage: `url(${tmdbPoster(result)})` } : {}"><span v-if="!result.poster_path">暂无封面</span></div>
                  <div class="tmdb-result-copy"><small>{{ result.release_date?.slice(0, 4) || '待定' }} · TMDB {{ result.vote_average?.toFixed(1) || '暂无评分' }}</small><strong>{{ result.title || result.original_title }}</strong><p>{{ result.original_title || '暂无原名' }}</p></div>
                  <button class="tmdb-view-button" :aria-expanded="selectedTmdbResult?.id === result.id" @click="viewTmdbResult(result)">{{ selectedTmdbResult?.id === result.id ? '查看中' : '查看' }}<ChevronDown :size="13" /></button>
                </div>
              </article>
              <button v-if="displayedTmdbResults.length < tmdbTotalResults" class="tmdb-load-more" :disabled="tmdbLoadingMore" @click="loadMoreTmdb"><i></i>{{ tmdbLoadingMore ? '正在加载下一批…' : '加载下一批 10 部' }}</button>
              <div v-else class="tmdb-results-end">已经到底了 · 共 {{ tmdbTotalResults }} 部</div>
            </div>

            <Transition name="tmdb-modal">
              <div v-if="selectedTmdbResult" class="tmdb-detail-backdrop" @click.self="selectedTmdbResult = null">
                <section class="tmdb-detail-modal" role="dialog" aria-modal="true" :aria-label="`${selectedTmdbResult.title || selectedTmdbResult.original_title} 添加详情`">
                  <header class="tmdb-modal-header"><div class="tmdb-result-poster" :style="tmdbPoster(selectedTmdbResult) ? { backgroundImage: `url(${tmdbPoster(selectedTmdbResult)})` } : {}"></div><div><small>{{ selectedTmdbResult.release_date?.slice(0, 4) || '待定' }} · TMDB {{ selectedTmdbResult.vote_average?.toFixed(1) || '暂无评分' }}</small><h3>{{ selectedTmdbResult.title || selectedTmdbResult.original_title }}</h3><p>{{ selectedTmdbResult.original_title || '暂无原名' }}</p></div><button aria-label="收起详情" @click="selectedTmdbResult = null"><X :size="17" /></button></header>
                  <div class="tmdb-modal-scroll">
                    <section class="tmdb-info-card" :class="{ expanded: overviewExpanded }"><div class="tmdb-card-title"><span>影片介绍</span><small>{{ selectedTmdbResult.release_date?.slice(0, 4) || '年份待定' }}</small></div><p>{{ selectedTmdbResult.overview || '暂无剧情简介。' }}</p><button class="tmdb-overview-toggle" :aria-expanded="overviewExpanded" @click="overviewExpanded = !overviewExpanded">{{ overviewExpanded ? '收起' : '展开' }}<ChevronDown :size="12" /></button></section>
                    <section class="tmdb-add-card">
                      <div class="tmdb-card-title"><span>添加设置</span><small>完善你的记录</small></div>
                      <div class="tmdb-field"><span>类型</span><div class="tmdb-media-select"><button type="button" class="tmdb-media-select__trigger" :class="{ open: addMediaMenuOpen }" aria-haspopup="listbox" :aria-expanded="addMediaMenuOpen" @click="addMediaMenuOpen = !addMediaMenuOpen"><span>{{ addMediaType }}</span><ChevronDown :size="14" /></button><Transition name="media-menu"><div v-if="addMediaMenuOpen" class="tmdb-media-select__menu" role="listbox" aria-label="选择内容类型"><button v-for="type in libraryMediaTypes" :key="type" type="button" role="option" :aria-selected="addMediaType === type" :class="{ selected: addMediaType === type }" @click="chooseAddMediaType(type)"><span>{{ type }}</span><Check v-if="addMediaType === type" :size="13" /></button></div></Transition></div></div>
                      <div class="tmdb-watch-row" :class="{ watched: addWatched }"><label class="tmdb-watch-toggle"><span><strong>是否已观看</strong><small>{{ addWatched ? '记录评分与观后感' : '加入待看清单' }}</small></span><input v-model="addWatched" type="checkbox" @change="handleAddWatchedChange" /><i aria-hidden="true"></i></label><Transition name="watch-date"><div v-if="addWatched" class="tmdb-watch-date-wrap"><button type="button" class="tmdb-watch-date" :class="{ open: addDatePickerOpen }" aria-haspopup="dialog" :aria-expanded="addDatePickerOpen" @click="toggleWatchedDatePicker"><span><small>观看日期</small><strong>{{ addWatchedDateLabel }}</strong></span><ChevronDown :size="13" /></button></div></Transition></div>
                      <Transition name="watched-fields"><div v-if="addWatched" class="tmdb-watched-fields"><div class="tmdb-rating"><span>个人评分</span><div><button v-for="score in 5" :key="score" type="button" :class="{ selected: addRating >= score * 2 }" :aria-label="`${score * 2} 分`" @click="addRating = score * 2"><Star :size="18" /></button><strong>{{ addRating || '—' }}<small>/ 10</small></strong></div></div><label class="tmdb-review"><span>个人评价</span><textarea v-model="addReview" rows="3" placeholder="写下看完后的感受……"></textarea></label></div></Transition>
                      <button class="tmdb-confirm-add" @click="addTmdbMovie(selectedTmdbResult)"><Check :size="15" />确认添加</button>
                    </section>
                  </div>
                  <DatePickerDialog v-model="addWatchedDate" v-model:open="addDatePickerOpen" title="选择观看日期" />
                </section>
              </div>
            </Transition>
          </template>
          <template v-else>
            <header class="record-header import-record-header"><div><small>中文片单</small><h2>检查后再导入</h2></div><button aria-label="关闭导入片单" @click="closeRecordSheet"><X :size="19" /></button></header>
            <div class="import-batch-tool"><input ref="importFileInput" class="import-file-input" type="file" accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="handleImportFile" /><button type="button" @click="importFileInput?.click()"><FileText :size="17" /><span><strong>选择 TXT 或 Excel 片单</strong><small>支持 .txt · .xlsx · .xls · .csv</small></span><Upload :size="15" /></button></div>
            <section class="import-review">
              <header><div><strong>待导入列表</strong><small>共 {{ importDraftWatched.length + importDraftUnwatched.length }} 部</small></div><button type="button" :disabled="!importDraftWatched.length && !importDraftUnwatched.length" @click="importCardsReversed = !importCardsReversed"><ArrowDownUp :size="14" />交换上下</button></header>
              <div class="import-card-stack" :class="{ reversed: importCardsReversed }">
                <section class="import-draft-card watched-card">
                  <header><div><span></span><strong>已观看</strong></div><small>{{ importDraftWatched.length }} 部</small></header>
                  <TransitionGroup name="import-row" tag="div" class="import-draft-list">
                    <article v-for="item in importDraftWatched" :key="item.id"><div><Check :size="12" /><strong>{{ item.title }}</strong></div><span><button type="button" aria-label="移动到未观看" @click="moveImportDraft(item, true)"><ArrowDownUp :size="12" /></button><button type="button" aria-label="移除待导入条目" @click="removeImportDraft(item, true)"><Trash2 :size="12" /></button></span></article>
                    <p v-if="!importDraftWatched.length" key="watched-empty">已观看片名会显示在这里</p>
                  </TransitionGroup>
                </section>
                <section class="import-draft-card unwatched-card">
                  <header><div><span></span><strong>未观看</strong></div><small>{{ importDraftUnwatched.length }} 部</small></header>
                  <TransitionGroup name="import-row" tag="div" class="import-draft-list">
                    <article v-for="item in importDraftUnwatched" :key="item.id"><div><span class="pending-dot"></span><strong>{{ item.title }}</strong></div><span><button type="button" aria-label="移动到已观看" @click="moveImportDraft(item, false)"><ArrowDownUp :size="12" /></button><button type="button" aria-label="移除待导入条目" @click="removeImportDraft(item, false)"><Trash2 :size="12" /></button></span></article>
                    <p v-if="!importDraftUnwatched.length" key="unwatched-empty">未观看片名会显示在这里</p>
                  </TransitionGroup>
                </section>
              </div>
            </section>
            <footer class="import-actions"><button type="button" :disabled="!importDraftWatched.length && !importDraftUnwatched.length" @click="clearImportDrafts">清空</button><button type="button" :disabled="!importDraftWatched.length && !importDraftUnwatched.length" @click="confirmImportDrafts"><Check :size="15" />确认导入 {{ importDraftWatched.length + importDraftUnwatched.length || '' }}</button></footer>
          </template>
        </div>
      </div>

      <div v-if="posterFlight" class="poster-flight" :class="`poster-flight--${posterFlight.movie.poster}`" :style="{ '--flight-left': `${posterFlight.left}px`, '--flight-top': `${posterFlight.top}px`, '--flight-width': `${posterFlight.width}px`, '--flight-height': `${posterFlight.height}px`, ...libraryPosterStyle(posterFlight.movie) }" aria-hidden="true"></div>

      <MovieDetail ref="movieDetail" v-if="currentPage === 'detail' && selectedMovie" :movie="selectedMovie" :entry-mode="detailEntry" :motion-intensity="motionIntensity" :image-base="tmdbImageBase" :layout-order="detailLayout.map((item) => item.id)" @back="closeDetail" @navigate="navigateDetail" @update-watched="updateWatched" @update-record="updateMovieRecord" @request-person="requestPersonDetails" />

      <Transition name="settings-shell">
        <section v-if="currentPage === 'settings'" class="personal-settings" @input.capture="handleSettingsAutoInput">
          <Transition :name="settingsTransitionName" mode="out-in">
            <div :key="settingsSection" class="settings-page">
              <header class="settings-header settings-piece" style="--settings-order: 0">
                <button :aria-label="settingsSection === 'hub' ? '返回首页' : '返回设置'" @click="backFromSettings"><ChevronLeft :size="22" /></button>
                <div>
                  <h1>{{ settingsSection === 'hub' ? '设置' : settingsSection === 'profile' ? '个人信息' : settingsSection === 'home' ? '首页编辑' : settingsSection === 'library' ? '列表设置' : settingsSection === 'categories' ? '分类设置' : settingsSection === 'detail-layout' ? '电影详情布局' : settingsSection === 'animation' ? '动画强度设置' : settingsSection === 'database' ? '数据库设置' : 'TMDB 设置' }}</h1>
                  <p>{{ settingsSection === 'hub' ? '把常用设置收进清晰的分类里。' : settingsSection === 'profile' ? '头像和名称会显示在首页。' : settingsSection === 'home' ? '控制首页的统计与展示数量。' : settingsSection === 'library' ? '统一管理标签、排序与工具位置。' : settingsSection === 'categories' ? '管理两层分类、自定义内容与显示顺序。' : settingsSection === 'detail-layout' ? '调整详情模块的优先展示顺序。' : settingsSection === 'animation' ? '统一控制所有页面的动态幅度与启动动画。' : settingsSection === 'database' ? '查看当前设备的本地数据库状态。' : '配置数据接口与国内网络访问。' }}</p>
                </div>
              </header>

              <template v-if="settingsSection === 'hub'">
                <button class="profile-card profile-card--link settings-piece" :style="{ '--settings-order': 1, '--profile-background': profileBackgroundColor, '--profile-ink': profileTextColor, '--avatar-ring': avatarRingColor }" @click="openSettingsSection('profile')">
                  <div class="profile-avatar" :style="{ '--avatar-ring': avatarRingColor }">
                    <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                    <span v-else>{{ username.slice(0, 1) }}</span>
                  </div>
                  <div><strong>{{ username || '未命名用户' }}</strong><span>头像与名称 · {{ watchedCount }} 部已观看</span></div>
                  <ChevronRight :size="19" />
                </button>

                <div class="settings-category settings-piece" style="--settings-order: 2">
                  <button type="button" class="theme-mode-row" :class="{ switching: themeSwitching }" :disabled="themeSwitching" :aria-label="`模式选择，当前${themeModeLabel}，点击切换`" @click="cycleThemeMode">
                    <i class="settings-icon settings-icon--theme"><MoonStar :size="18" /></i>
                    <span><strong>模式选择</strong><small>背景与手机显示模式同步</small></span>
                    <Transition name="theme-label" mode="out-in"><b :key="themeMode">{{ themeModeLabel }}</b></Transition>
                  </button>
                  <button @click="openSettingsSection('home')"><i class="settings-icon settings-icon--home"><House :size="18" /></i><span><strong>首页编辑</strong><small>统计单位、展示数量</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('library')"><i class="settings-icon settings-icon--library"><SlidersHorizontal :size="18" /></i><span><strong>列表设置</strong><small>标签、排序与工具位置</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('categories')"><i class="settings-icon settings-icon--categories"><FolderTree :size="18" /></i><span><strong>分类设置</strong><small>两层分类、自定义与拖动排序</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('detail-layout')"><i class="settings-icon settings-icon--detail"><LayoutPanelTop :size="18" /></i><span><strong>电影详情布局</strong><small>{{ detailLayout.length }} 个显示 · {{ hiddenDetailLayout.length }} 个隐藏</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('animation')"><i class="settings-icon settings-icon--animation"><Play :size="18" /></i><span><strong>动画强度设置</strong><small>当前强度：{{ motionIntensity === 'high' ? '高' : motionIntensity === 'medium' ? '中' : '低' }}</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('database')"><i class="settings-icon settings-icon--database"><HardDrive :size="18" /></i><span><strong>数据库设置</strong><small>本地引擎、连接状态与数据概况</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('tmdb')"><i class="settings-icon settings-icon--tmdb"><Database :size="18" /></i><span><strong>TMDB 设置</strong><small>API、图片与国内网络</small></span><ChevronRight :size="18" /></button>
                </div>
                <p class="settings-footnote settings-piece" style="--settings-order: 3">所有设置只保存在当前浏览器中。</p>
              </template>

              <template v-else-if="settingsSection === 'profile'">
                <div class="profile-editor settings-piece" :style="{ '--settings-order': 1, '--profile-background': profileBackgroundColor, '--profile-ink': profileTextColor, '--avatar-ring': avatarRingColor }">
                  <div class="profile-avatar profile-avatar--large"><img v-if="avatarUrl" :src="avatarUrl" alt="" /><span v-else>{{ username.slice(0, 1) }}</span></div>
                  <div class="profile-preview-copy"><strong>{{ username || '未命名用户' }}</strong><span>个人资料预览</span></div>
                  <div class="profile-color-controls" aria-label="个人资料颜色">
                    <button type="button" :aria-expanded="activeProfileColor === 'background'" aria-label="选择资料卡背景色" @click="openProfileColorPicker('background')"><span>背景</span><i :style="{ background: profileBackgroundColor }"></i></button>
                    <button type="button" :aria-expanded="activeProfileColor === 'ring'" aria-label="选择头像圆圈颜色" @click="openProfileColorPicker('ring')"><span>头像圈</span><i :style="{ background: avatarRingColor }"></i></button>
                  </div>
                </div>
                <Transition name="profile-color-panel">
                  <section v-if="activeProfileColor" class="profile-color-panel settings-piece" style="--settings-order: 1">
                    <header><div><strong>{{ activeProfileColor === 'background' ? '资料卡背景色' : '头像圆圈颜色' }}</strong><span>选择预设色，或使用自定义颜色</span></div><button type="button" aria-label="关闭颜色选择" @click="activeProfileColor = null"><X :size="15" /></button></header>
                    <div class="profile-color-palette">
                      <button v-for="color in profileColorPresets" :key="color" type="button" :class="{ selected: pendingProfileColor === color }" :style="{ '--swatch': color }" :aria-label="`选择颜色 ${color}`" @click="pendingProfileColor = color"><i></i></button>
                    </div>
                    <label class="profile-custom-color"><span>自定义</span><input v-model="pendingProfileColor" type="color" aria-label="自定义资料颜色" /><code>{{ pendingProfileColor.toUpperCase() }}</code></label>
                    <footer><button type="button" @click="activeProfileColor = null">取消</button><button type="button" @click="confirmProfileColor"><Check :size="14" />确认颜色</button></footer>
                  </section>
                </Transition>
                <div class="settings-group settings-piece" style="--settings-order: 2"><label for="username">名称</label><input id="username" v-model.trim="username" data-auto-save maxlength="10" placeholder="输入你的名字" /><small>首页将显示“{{ username || '用户' }}的观影记录”，更改会自动保存。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 3"><label>本地头像</label><label class="avatar-upload"><i><Upload :size="18" /></i><span><strong>选择本地图片</strong><em>支持 JPG、PNG，自动居中裁剪</em></span><b>浏览</b><input type="file" accept="image/*" aria-label="选择本地头像图片" @change="handleAvatarUpload" /></label><small class="avatar-upload-status">{{ avatarUploadMessage || '图片会压缩为 256 × 256，并只保存在当前浏览器。' }}</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 4"><label for="avatar-url">或使用图片地址</label><input id="avatar-url" v-model.trim="avatarUrlInput" data-auto-save inputmode="url" :placeholder="avatarUrl.startsWith('data:') ? '正在使用本地头像，输入网址可替换' : 'https://example.com/avatar.jpg'" /><small>{{ avatarUrl.startsWith('data:') ? '当前使用本地头像，图片数据已隐藏。' : '留空时显示名称首字，更改会自动保存。' }}</small></div>
              </template>

              <template v-else-if="settingsSection === 'home'">
                <div class="settings-group settings-piece" style="--settings-order: 1"><label>默认统计单位</label><div class="period-options" role="group" aria-label="时间单位"><button v-for="option in [{ value: 'year', label: '年' }, { value: 'month', label: '月' }, { value: 'day', label: '日' }]" :key="option.value" :class="{ selected: statPeriod === option.value }" @click="statPeriod = option.value">{{ option.label }}</button></div></div>
                <div class="settings-group settings-piece" style="--settings-order: 2"><label>首页最多展示</label><div class="home-limit-control" :class="{ editing: homeCustomLimitOpen }"><div class="period-options home-limit-options" role="group" aria-label="首页电影展示数量"><button v-for="limit in [5, 10]" :key="limit" :class="{ selected: homeDisplayLimit === limit && !homeCustomLimitOpen }" @click="homeDisplayLimit = limit; homeCustomLimitOpen = false">{{ limit }} 部</button><button v-if="!homeCustomLimitOpen" :class="{ selected: ![5, 10].includes(homeDisplayLimit) }" @click="openHomeCustomLimit">自定义</button></div><Transition name="home-custom-limit"><div v-if="homeCustomLimitOpen" class="home-custom-limit-editor"><label><input v-model="homeCustomLimitInput" type="number" inputmode="numeric" min="1" max="99" aria-label="自定义首页展示数量" /><span>部</span></label><div><button type="button" @click="cancelHomeCustomLimit">取消</button><button type="button" @click="saveHomeCustomLimit"><Check :size="13" />保存</button></div></div></Transition></div><small>卡片和列表共同使用这个展示数量；默认 10 部，也可快速选择 5 部。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 3"><label>默认首页视图</label><div class="period-options home-view-options" role="group" aria-label="默认首页视图"><button :class="{ selected: viewMode === 'cards' }" @click="viewMode = 'cards'"><img :src="pixelCards" alt="" />卡片</button><button :class="{ selected: viewMode === 'list' }" @click="viewMode = 'list'"><img :src="pixelRows" alt="" />列表</button></div><small>选择后立即应用，下次打开 App 也会保持。</small></div>
              </template>

              <template v-else-if="settingsSection === 'library'">
                <div class="settings-group settings-piece" style="--settings-order: 1"><label>快捷标签数量</label><div class="tag-limit-options"><button v-for="limit in [5, 7, 9]" :key="limit" :class="{ selected: libraryTagLimit === limit }" @click="libraryTagLimit = limit"><strong>{{ limit }}</strong><span>个标签</span></button></div><small>片库默认显示 5 个；更多标签可以横向滑动查看。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 2"><label>工具位置</label><div class="library-side-options" role="group" aria-label="列表工具位置"><button :class="{ selected: libraryControlsSide === 'left' }" @click="libraryControlsSide = 'left'"><i></i><span><strong>左侧</strong><small>搜索、分类与侧栏靠左</small></span></button><button :class="{ selected: libraryControlsSide === 'right' }" @click="libraryControlsSide = 'right'"><span><strong>右侧</strong><small>全部工具镜像到右边</small></span><i></i></button></div><small>同一个选项控制上方搜索、更多分类，以及下方日期和状态按钮。</small></div>
                <div class="library-settings-card settings-piece" style="--settings-order: 3">
                  <section><h3>快捷标签</h3><div class="category-options library-reorder-tags" @pointermove="moveLibraryTagHold" @pointerup="endLibraryTagHold" @pointercancel="endLibraryTagHold"><button :class="{ selected: libraryGenre === 'all' }" @click="selectLibraryQuickGenre('all')">全部类型</button><button v-for="genre in libraryGenres" :key="genre" :data-library-tag="genre" :class="{ selected: libraryGenre === genre, dragging: libraryTagDragId === genre }" @click="selectLibraryQuickGenre(genre)" @pointerdown="startLibraryTagHold($event, genre)" @pointermove="cancelLibraryTagHold" @pointerleave="!libraryTagDragId && endLibraryTagHold()"><GripVertical :size="12" />{{ genre }}</button><button class="library-tag-edit" @pointerdown.stop @click="openSettingsSection('categories')"><Pencil :size="12" />编辑</button></div><p class="library-tag-order-hint">长按标签拖动调整顺序，列表页会同步更新。</p></section>
                  <section><h3>排列方式</h3><div class="library-sort-options"><button :class="{ selected: librarySortBy === 'name' }" @click="librarySortBy = 'name'">名字</button><button :class="{ selected: librarySortBy === 'release' }" @click="librarySortBy = 'release'">发布日期</button><button :class="{ selected: librarySortBy === 'rating' }" @click="librarySortBy = 'rating'">评分</button><button :class="{ selected: librarySortBy === 'personal' }" @click="librarySortBy = 'personal'">个人评分</button></div></section>
                  <section><h3>日期依据</h3><div class="library-sort-options"><button :class="{ selected: libraryDateBasis === 'record' }" @click="libraryDateBasis = 'record'">记录日期</button><button :class="{ selected: libraryDateBasis === 'release' }" @click="libraryDateBasis = 'release'">发布日期</button></div></section>
                  <section><h3>状态优先</h3><div class="library-priority-options"><button class="selected" aria-pressed="true" @click="libraryUnwatchedFirst = true">未观看</button></div></section>
                  <small>这些设置与列表页面“更多分类”面板同步，两个入口都会保留。</small>
                </div>
              </template>

              <template v-else-if="settingsSection === 'categories'">
                <CategorySettings v-model:categories="categorySettings" :motion-intensity="motionIntensity" @saved="showSettingsAutoSaved" />
              </template>

              <template v-else-if="settingsSection === 'detail-layout'">
                <DetailLayoutSettings v-model:modules="detailLayout" v-model:hidden-modules="hiddenDetailLayout" :motion-intensity="motionIntensity" @saved="showSettingsAutoSaved" @reset="resetDetailLayoutWithNotice" />
              </template>

              <template v-else-if="settingsSection === 'animation'">
                <section class="motion-intensity-settings settings-piece" style="--settings-order: 1">
                  <header>
                    <div><strong>动画强度</strong><span>首页、列表、详情、设置和添加页面统一生效</span></div>
                    <b>{{ motionIntensity === 'high' ? '高' : motionIntensity === 'medium' ? '中' : '低' }}</b>
                  </header>
                  <div class="motion-intensity-options" role="group" aria-label="动画强度">
                    <button type="button" :class="{ selected: motionIntensity === 'high' }" @click="motionIntensity = 'high'">
                      <i class="motion-demo motion-demo--high"><span></span><span></span><span></span></i>
                      <span><strong>高</strong><small>分层、倾斜与惯性回正</small></span>
                    </button>
                    <button type="button" :class="{ selected: motionIntensity === 'medium' }" @click="motionIntensity = 'medium'">
                      <i class="motion-demo motion-demo--medium"><span></span><span></span><span></span></i>
                      <span><strong>中</strong><small>简洁顺滑的左右切换</small></span>
                    </button>
                    <button type="button" :class="{ selected: motionIntensity === 'low' }" @click="motionIntensity = 'low'">
                      <i class="motion-demo motion-demo--low"><span></span><span></span><span></span></i>
                      <span><strong>低</strong><small>极轻位移与快速淡入</small></span>
                    </button>
                  </div>
                  <p>App 默认使用高强度；设置会立即应用并保存在当前设备。</p>
                </section>

                <section class="startup-animation-settings settings-piece" style="--settings-order: 2">
                  <div class="startup-animation-card">
                    <div class="startup-animation-card__mark"><img :src="cinelogMark" alt="" /></div>
                    <div>
                      <strong>开机动画显示</strong>
                      <span>App 从后台进程被彻底关闭后，再次打开时播放 CineLog 启动动画。</span>
                    </div>
                    <button
                      type="button"
                      class="settings-toggle"
                      :class="{ enabled: startupAnimationEnabled }"
                      :aria-pressed="startupAnimationEnabled"
                      :aria-label="startupAnimationEnabled ? '关闭启动动画' : '开启启动动画'"
                      @click="startupAnimationEnabled = !startupAnimationEnabled; showSettingsAutoSaved('开机动画设置已自动保存')"
                    ><i></i></button>
                  </div>
                  <button type="button" class="startup-animation-preview" @click="previewStartupAnimation"><Play :size="15" />预览启动动画</button>
                  <p>普通返回首页、横竖屏切换和短暂进入后台不会重复播放。</p>
                </section>
              </template>

              <template v-else-if="settingsSection === 'database'">
                <DatabaseSettings />
              </template>

              <template v-else>
                <div class="network-options settings-piece" style="--settings-order: 1" role="group" aria-label="TMDB 网络方式">
                  <button :class="{ selected: tmdbNetworkMode === 'hosts' }" @click="switchTmdbNetworkMode('hosts')"><strong>CheckTMDB hosts</strong><span>国内推荐</span></button>
                  <button :class="{ selected: tmdbNetworkMode === 'custom' }" @click="switchTmdbNetworkMode('custom')"><strong>自定义地址</strong><span>反代或镜像</span></button>
                </div>
                <button class="tmdb-refresh-endpoints settings-piece" :class="{ refreshed: tmdbEndpointRefreshState === 'refreshed' }" style="--settings-order: 2" @click="refreshTmdbEndpoints"><RefreshCw :size="16" /><span><strong>{{ tmdbEndpointRefreshState === 'refreshed' ? '当前地址已刷新' : '刷新当前地址' }}</strong><small>{{ tmdbNetworkMode === 'hosts' ? '重新载入 CheckTMDB hosts 对应的 TMDB 域名' : '重新载入已保存的自定义地址' }}</small></span></button>
                <div class="tmdb-notice settings-piece" style="--settings-order: 3">
                  <Database :size="20" />
                  <div><strong>{{ tmdbNetworkMode === 'hosts' ? '使用 CheckTMDB 整理的 hosts' : '使用你信任的服务地址' }}</strong><p>{{ tmdbNetworkMode === 'hosts' ? 'hosts 会把 TMDB 域名指向可用 IP，应用不再强制官方 DNS。请将下方最新映射写入系统或路由器。' : '支持 HTTPS 反代或镜像，API 与图片地址会分别保存。' }}</p></div>
                </div>
                <div class="tmdb-native-warning settings-piece" style="--settings-order: 3"><strong>{{ tmdbNetworkMode === 'hosts' ? '需在系统或路由器生效' : '自定义地址必须使用 HTTPS' }}</strong><span>{{ tmdbNetworkMode === 'hosts' ? 'Android App 无法自动修改系统 hosts；更新后重启 App 再测试。' : '可填写你之前使用的反代或镜像地址，无需额外写 443 端口。' }}</span></div>
                <div class="settings-group settings-piece" style="--settings-order: 3"><label for="tmdb-token">API 密钥</label><input id="tmdb-token" v-model.trim="tmdbToken" data-auto-save type="password" autocomplete="off" placeholder="输入 TMDB v3 API 密钥" /><small>支持 v3 API 密钥；旧的 Read Access Token 也会自动识别。密钥只保存在当前浏览器。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 4"><label for="tmdb-api">API 地址</label><input id="tmdb-api" v-model.trim="tmdbApiBase" data-auto-save inputmode="url" :readonly="tmdbNetworkMode === 'hosts'" :placeholder="tmdbNetworkMode === 'custom' ? 'https://tmdb.example.com/tmdb-api' : 'https://api.themoviedb.org/3'" /><small>{{ tmdbNetworkMode === 'hosts' ? '域名保持不变，实际 IP 由 CheckTMDB hosts 接管。' : '填写你的 HTTPS API 反代或镜像地址。' }}</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 5"><label for="tmdb-image">图片地址</label><input id="tmdb-image" v-model.trim="tmdbImageBase" data-auto-save inputmode="url" :readonly="tmdbNetworkMode === 'hosts'" :placeholder="tmdbNetworkMode === 'custom' ? 'https://tmdb.example.com/tmdb-image' : 'https://image.tmdb.org/t/p'" /><small>{{ tmdbNetworkMode === 'hosts' ? '海报与剧照同样跟随 CheckTMDB hosts 映射。' : '填写镜像对应的图片根地址。' }}</small></div>
                <div v-if="tmdbNetworkMode === 'hosts'" class="hosts-links settings-piece" style="--settings-order: 6"><a href="https://raw.githubusercontent.com/cnwikee/CheckTMDB/refs/heads/main/Tmdb_host_ipv4" target="_blank" rel="noreferrer">IPv4 hosts <ArrowUpRight :size="13" /></a><a href="https://raw.githubusercontent.com/cnwikee/CheckTMDB/refs/heads/main/Tmdb_host_ipv6" target="_blank" rel="noreferrer">IPv6 hosts <ArrowUpRight :size="13" /></a></div>
                <button class="tmdb-test settings-piece" style="--settings-order: 7" :disabled="tmdbTestState === 'testing'" @click="testTmdbConnection">{{ tmdbTestState === 'testing' ? '正在测试…' : '测试连接' }}</button>
                <p v-if="tmdbTestMessage" class="tmdb-result" :class="`is-${tmdbTestState}`">{{ tmdbTestMessage }}</p>
              </template>
            </div>
          </Transition>
        </section>
      </Transition>
    </section>
  </main>
</template>
