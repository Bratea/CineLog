<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight, Database, ExternalLink, FolderTree, House, Search, SlidersHorizontal, Star, Upload, X } from 'lucide-vue-next'
import MovieCarousel from './components/MovieCarousel.vue'
import MovieList from './components/MovieList.vue'
import MovieDetail from './components/MovieDetail.vue'
import CategorySettings from './components/CategorySettings.vue'
import RotatingText from './components/RotatingText.vue'
import { movies } from './data/movies'
import cinematicAnimeCollage from './assets/cinematic-anime-collage.png'
import pixelPlus from './assets/pixel-plus.webp'
import pixelHome from './assets/pixel-home.webp'
import pixelMovieList from './assets/pixel-movie-list.webp'
import pixelCards from './assets/pixel-cards.webp'
import pixelRows from './assets/pixel-rows.webp'

const currentPage = ref('home')
const movieRecords = ref(movies.map((movie, index) => ({ ...movie, favourite: index === 0 })))
const activeTab = ref('home')
const addOpen = ref(false)
const username = ref(localStorage.getItem('movie-username') || '通通')
const activeWatchStat = ref('watched')
const viewMode = ref('cards')
const statPeriod = ref(localStorage.getItem('movie-stat-period') || 'year')
const homeDisplayLimit = ref(Number(localStorage.getItem('movie-home-limit')) === 10 ? 10 : 5)
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
const surfaceDragStart = ref(null)
const surfaceDragX = ref(0)
const surfaceDragging = ref(false)
const yearMenuOpen = ref(false)
const settingsSection = ref('hub')
const settingsDirection = ref('forward')
const avatarUrl = ref(localStorage.getItem('movie-avatar-url') || '')
const tmdbToken = ref(localStorage.getItem('movie-tmdb-token') || '')
const tmdbApiBase = ref(localStorage.getItem('movie-tmdb-api-base') || 'https://api.themoviedb.org/3')
const tmdbImageBase = ref(localStorage.getItem('movie-tmdb-image-base') || 'https://image.tmdb.org/t/p')
const tmdbNetworkMode = ref(localStorage.getItem('movie-tmdb-network-mode') || 'hosts')
const tmdbTestState = ref('idle')
const tmdbTestMessage = ref('')
const expandedLibraryId = ref(null)
const recordExpanded = ref(false)
const tmdbQuery = ref('')
const tmdbResults = ref([])
const tmdbSearchState = ref('idle')
const tmdbSearchMessage = ref('')
const tmdbSearchLastQuery = ref('')
const tmdbPage = ref(0)
const tmdbTotalPages = ref(0)
const tmdbTotalResults = ref(0)
const tmdbLoadingMore = ref(false)
const tmdbRefreshing = ref(false)
const tmdbRefreshPull = ref(0)
const tmdbPullStart = ref(null)
const selectedTmdbResult = ref(null)
const addMediaType = ref('电影')
const addWatched = ref(false)
const addRating = ref(0)
const addReview = ref('')
const recordClosing = ref(false)
const libraryWatchFilter = ref('all')
const librarySortBy = ref(localStorage.getItem('movie-library-sort') || 'release')
const libraryUnwatchedFirst = ref(localStorage.getItem('movie-library-unwatched-first') !== 'false')
const libraryMediaType = ref('电影')
const libraryTagLimit = ref(Number(localStorage.getItem('movie-library-tag-limit')) || 5)
const libraryDateExpanded = ref(false)
const libraryMediaMenuOpen = ref(false)
const librarySearchOpen = ref(false)
const libraryYearValue = ref(2026)
const libraryMonthValue = ref(7)
const selectedLibraryDay = ref(15)
const avatarUploadMessage = ref('')
const librarySearchInput = ref(null)

const incomingMovieGenres = [...new Set(movies.flatMap((movie) => movie.meta.split('·').map((genre) => genre.trim())))].filter(Boolean)
const defaultCategorySettings = [
  { id: 'movie', label: '电影', children: incomingMovieGenres.map((label) => ({ id: `movie-${label}`, label, source: 'data' })) },
  { id: 'tv', label: '电视剧', children: ['剧情', '喜剧', '爱情', '悬疑', '科幻', '动作'].map((label) => ({ id: `tv-${label}`, label, source: 'default' })) },
  { id: 'anime', label: '动漫', children: ['热血', '奇幻', '冒险', '治愈', '喜剧', '科幻'].map((label) => ({ id: `anime-${label}`, label, source: 'default' })) },
  { id: 'novel', label: '小说', children: ['科幻', '悬疑', '奇幻', '言情', '历史', '文学'].map((label) => ({ id: `novel-${label}`, label, source: 'default' })) },
]

function loadCategorySettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('movie-category-settings'))
    if (!Array.isArray(saved) || !saved.length) return defaultCategorySettings
    const savedMovie = saved.find((category) => category.id === 'movie')
    const savedMovieLabels = new Set(savedMovie?.children?.map((child) => child.label) || [])
    const missingIncoming = incomingMovieGenres.filter((label) => !savedMovieLabels.has(label)).map((label) => ({ id: `movie-${label}`, label, source: 'data' }))
    return saved.map((category) => category.id === 'movie' ? { ...category, children: [...missingIncoming, ...(category.children || [])] } : category)
  } catch {
    return defaultCategorySettings
  }
}

const categorySettings = ref(loadCategorySettings())

let watchConfirmTimer
let surfaceSettleTimer

const watchedCount = computed(() => movieRecords.value.filter((movie) => movie.watched).length)
const unwatchedCount = computed(() => movieRecords.value.length - watchedCount.value)
const watchedYears = computed(() => [...new Set(movieRecords.value.filter((movie) => movie.watched).map((movie) => movie.year))].sort().reverse())
const filteredMovies = computed(() => movieRecords.value.filter((movie) => {
  if (activeWatchStat.value === 'unwatched') return !movie.watched
  if (!movie.watched) return false
  return statPeriod.value !== 'year' || movie.year === selectedYear.value
}))
const periodLabel = computed(() => ({ year: `${selectedYear.value} 年`, month: '本月', week: '本周', day: '今天' })[statPeriod.value])
const watchedSubtitle = computed(() => `按${({ year: '年', month: '月', week: '周', day: '日' })[statPeriod.value]}整理 · 共 ${filteredMovies.value.length} 部`)
const displayedMovies = computed(() => filteredMovies.value.slice(0, homeDisplayLimit.value))
const surfaceTransitionName = computed(() => transitionDirection.value === 'forward' ? 'surface-forward' : 'surface-back')
const settingsTransitionName = computed(() => settingsDirection.value === 'forward' ? 'settings-forward' : 'settings-back')
const surfacePage = computed(() => currentPage.value === 'detail' ? detailOrigin.value : currentPage.value)
const libraryYears = computed(() => [...new Set(movieRecords.value.map((movie) => movie.year))].sort().reverse())
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
const libraryMovies = computed(() => {
  const keyword = libraryQuery.value.trim().toLocaleLowerCase('zh-CN')
  const filtered = movieRecords.value.filter((movie) => {
    const matchesQuery = !keyword || `${movie.title} ${movie.originalTitle} ${movie.meta}`.toLocaleLowerCase('zh-CN').includes(keyword)
    const matchesYear = libraryYear.value === 'all' || movie.year === libraryYear.value
    const matchesGenre = libraryGenre.value === 'all' || movie.meta.split('·').map((genre) => genre.trim()).includes(libraryGenre.value)
    const matchesWatch = libraryWatchFilter.value === 'all' || (libraryWatchFilter.value === 'watched' ? movie.watched : libraryWatchFilter.value === 'unwatched' ? !movie.watched : movie.favourite)
    const matchesMedia = libraryMediaType.value === '电影' || (['动画', '动漫'].includes(libraryMediaType.value) && movie.meta.includes('动画')) || movie.meta.includes(libraryMediaType.value)
    return matchesQuery && matchesYear && matchesGenre && matchesWatch && matchesMedia
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
watch(avatarUrl, (value) => localStorage.setItem('movie-avatar-url', value.trim()))
watch(tmdbToken, (value) => localStorage.setItem('movie-tmdb-token', value.trim()))
watch(tmdbApiBase, (value) => localStorage.setItem('movie-tmdb-api-base', value.trim()))
watch(tmdbImageBase, (value) => localStorage.setItem('movie-tmdb-image-base', value.trim()))
watch(tmdbNetworkMode, (value) => localStorage.setItem('movie-tmdb-network-mode', value))
watch(libraryTagLimit, (value) => localStorage.setItem('movie-library-tag-limit', String(value)))
watch(librarySortBy, (value) => localStorage.setItem('movie-library-sort', value))
watch(libraryUnwatchedFirst, (value) => localStorage.setItem('movie-library-unwatched-first', String(value)))
watch(categorySettings, (value) => localStorage.setItem('movie-category-settings', JSON.stringify(value)), { deep: true })
watch(libraryMediaTypes, (types) => {
  if (!types.includes(libraryMediaType.value)) libraryMediaType.value = types[0] || '电影'
})
watch(libraryMediaType, () => {
  libraryGenre.value = 'all'
  libraryMediaMenuOpen.value = false
})

function setWatchStat(value) {
  activeWatchStat.value = value
}

function toggleViewMode() {
  viewMode.value = viewMode.value === 'cards' ? 'list' : 'cards'
}

function markWatched(id) {
  const movie = movieRecords.value.find((item) => item.id === id)
  if (movie) movie.watched = true
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

function openDetailFromPoster(movie, source) {
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
  }, 190)
  window.setTimeout(() => { posterFlight.value = null }, 720)
}

function openHomeListDetail(payload) {
  openDetailFromPoster(payload.movie, payload.source)
}

function closeDetail() {
  transitionDirection.value = detailOrigin.value === 'home' ? 'back' : 'forward'
  currentPage.value = detailOrigin.value
  selectedMovie.value = null
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

function chooseYear(year) {
  selectedYear.value = year
  yearMenuOpen.value = false
}

async function testTmdbConnection() {
  const token = tmdbToken.value.trim()
  const base = tmdbApiBase.value.trim().replace(/\/$/, '')
  if (!token || !base) {
    tmdbTestState.value = 'error'
    tmdbTestMessage.value = '请先填写 API 密钥和 API 地址。'
    return
  }
  tmdbTestState.value = 'testing'
  tmdbTestMessage.value = '正在连接 TMDB…'
  try {
    const request = tmdbRequest(`${base}/configuration`)
    const response = await fetch(request.url, request.options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    tmdbTestState.value = 'success'
    tmdbTestMessage.value = '连接成功，TMDB 配置可用。'
  } catch (error) {
    tmdbTestState.value = 'error'
    tmdbTestMessage.value = `连接失败（${error.message}），请检查 Token、地址或 hosts。`
  }
}

function tmdbRequest(url, params = {}) {
  const credential = tmdbToken.value.trim()
  const search = new URLSearchParams(params)
  const headers = { accept: 'application/json' }
  if (credential.startsWith('eyJ')) headers.Authorization = `Bearer ${credential}`
  else search.set('api_key', credential)
  const separator = url.includes('?') ? '&' : '?'
  return { url: search.toString() ? `${url}${separator}${search}` : url, options: { headers } }
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
      avatarUploadMessage.value = '头像已保存在当前浏览器。'
    }
    image.src = reader.result
  }
  reader.readAsDataURL(file)
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

function surfacePointerDown(event) {
  if (!['home', 'library'].includes(currentPage.value) || event.target.closest('button, input, label, .deck, .library-row, .movie-list')) return
  surfaceDragStart.value = { x: event.clientX, y: event.clientY }
  surfaceDragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function surfacePointerMove(event) {
  if (!surfaceDragStart.value) return
  const deltaX = event.clientX - surfaceDragStart.value.x
  const deltaY = event.clientY - surfaceDragStart.value.y
  if (Math.abs(deltaX) < 8 || Math.abs(deltaX) < Math.abs(deltaY) * 1.15) return
  const allowed = currentPage.value === 'home' ? Math.min(0, deltaX) : Math.max(0, deltaX)
  surfaceDragX.value = Math.max(-150, Math.min(150, allowed * .82))
}

function surfacePointerUp() {
  if (!surfaceDragStart.value) return
  const shouldMove = Math.abs(surfaceDragX.value) > 58
  const target = currentPage.value === 'home' ? 'library' : 'home'
  surfaceDragStart.value = null
  surfaceDragging.value = false
  if (!shouldMove) {
    surfaceDragX.value = 0
    return
  }
  surfaceDragX.value = target === 'library' ? -176 : 176
  window.clearTimeout(surfaceSettleTimer)
  surfaceSettleTimer = window.setTimeout(() => {
    target === 'library' ? showLibrary() : showHome()
    surfaceDragX.value = 0
  }, 120)
}

function libraryPosterStyle(movie) {
  const path = movie.backdropUrl || movie.posterUrl || movie.backdrop_path || movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
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
    watchConfirmTimer = window.setTimeout(() => { armedWatched.value = null }, 2400)
    return
  }
  armedWatched.value = null
  markingWatched.value = [...markingWatched.value, movie.id]
  window.setTimeout(() => {
    movie.watched = true
    markingWatched.value = markingWatched.value.filter((id) => id !== movie.id)
  }, 920)
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
    recordClosing.value = false
  }, recordExpanded.value ? 560 : 320)
}

function openTmdbSettingsFromRecord() {
  closeRecordSheet()
  window.setTimeout(() => openSettings('tmdb'), 570)
}

function startRecord() {
  recordExpanded.value = true
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
    const response = await fetch(request.url, request.options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    tmdbResults.value = data.results || []
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
  if (tmdbLoadingMore.value || tmdbSearchState.value !== 'success' || tmdbPage.value >= tmdbTotalPages.value) return
  tmdbLoadingMore.value = true
  try {
    const base = tmdbApiBase.value.trim().replace(/\/$/, '')
    const nextPage = tmdbPage.value + 1
    const request = tmdbRequest(`${base}/search/movie`, { query: tmdbSearchLastQuery.value, language: 'zh-CN', include_adult: 'false', page: String(nextPage) })
    const response = await fetch(request.url, request.options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const existingIds = new Set(tmdbResults.value.map((item) => item.id))
    tmdbResults.value = [...tmdbResults.value, ...(data.results || []).filter((item) => !existingIds.has(item.id))]
    tmdbPage.value = nextPage
  } catch (error) {
    tmdbSearchMessage.value = `加载更多失败（${error.message}），请稍后重试。`
  } finally {
    tmdbLoadingMore.value = false
  }
}

function handleTmdbScroll(event) {
  const target = event.currentTarget
  if (target.scrollHeight - target.scrollTop - target.clientHeight < 90) loadMoreTmdb()
}

function startTmdbPull(event) {
  if (event.currentTarget.scrollTop > 0 || tmdbRefreshing.value) return
  tmdbPullStart.value = event.touches?.[0]?.clientY ?? event.clientY
}

function moveTmdbPull(event) {
  if (tmdbPullStart.value === null || event.currentTarget.scrollTop > 0) return
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
  selectedTmdbResult.value = null
}

function viewTmdbResult(result) {
  if (selectedTmdbResult.value?.id === result.id) {
    selectedTmdbResult.value = null
    return
  }
  selectedTmdbResult.value = result
  addMediaType.value = '电影'
  addWatched.value = false
  addRating.value = 0
  addReview.value = ''
}

function addTmdbMovie(result) {
  if (movieRecords.value.some((movie) => String(movie.id) === `tmdb-${result.id}`)) {
    tmdbSearchMessage.value = '这部电影已经在记录中了。'
    return
  }
  movieRecords.value.unshift({
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
    watchedDate: addWatched.value ? new Date().toISOString().slice(0, 10) : '',
    poster: 'tmdb',
    posterText: result.title || result.original_title,
    poster_path: result.poster_path,
    backdrop_path: result.backdrop_path,
    overview: result.overview || '暂无剧情简介。',
    feeling: addWatched.value ? (addReview.value.trim() || '已观看，暂时没有写下评价。') : '刚刚加入待看清单。',
  })
  activeWatchStat.value = addWatched.value ? 'watched' : 'unwatched'
  tmdbSearchMessage.value = `已将《${result.title || result.original_title}》加入${addWatched.value ? '已观看' : '未观看'}。`
  selectedTmdbResult.value = null
}

async function ensureTmdbDetails(movie) {
  const rawId = movie?.tmdbId ?? (String(movie?.id || '').startsWith('tmdb-') ? String(movie.id).slice(5) : null)
  if (!rawId || movie.detailState === 'loading' || movie.detailState === 'success') return
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
      append_to_response: 'credits,videos,release_dates',
      include_video_language: 'zh,en,null',
    })
    const response = await fetch(request.url, request.options)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const detail = await response.json()
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
      certification,
      director: director ? { id: director.id, name: director.name, role: '导演', profile_path: director.profile_path } : null,
      cast: (detail.credits?.cast || []).slice(0, 8).map((person) => ({
        id: person.id,
        name: person.name,
        role: person.character || '演员',
        profile_path: person.profile_path,
      })),
      trailer: trailer ? { key: trailer.key, name: trailer.name, site: trailer.site } : null,
      detailState: 'success',
    })
    movie.meta = movie.genres.length ? movie.genres.map((genre) => genre.name).join(' · ') : movie.meta
  } catch (error) {
    movie.detailState = 'error'
    movie.detailError = `详细资料加载失败（${error.message}）`
  }
}

function updateWatched(value) {
  if (selectedMovie.value) selectedMovie.value.watched = value
}

function updateMovieRecord(record) {
  if (!selectedMovie.value) return
  Object.assign(selectedMovie.value, {
    personalRating: record.rating || null,
    rating: record.rating || null,
    watchedDate: record.date || '',
    feeling: record.review?.trim() || '',
  })
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
    <section ref="phoneShell" class="phone" :class="{ 'phone--detail': currentPage === 'detail' }" :aria-label="currentPage === 'home' ? `${username}的观影记录首页` : currentPage === 'library' ? '电影列表页面' : currentPage === 'detail' ? '电影详情页面' : '个人设置页面'">
      <div class="ambient-orb ambient-orb--one" aria-hidden="true"></div>
      <div class="ambient-orb ambient-orb--two" aria-hidden="true"></div>

      <Transition :name="surfaceTransitionName" :duration="{ enter: 720, leave: 650 }">
        <section v-if="surfacePage === 'home'" key="home" class="surface-view home-surface" :class="{ 'is-surface-dragging': surfaceDragging }" :style="{ '--surface-drag': `${surfaceDragX}px` }" @pointerdown="surfacePointerDown" @pointermove="surfacePointerMove" @pointerup="surfacePointerUp" @pointercancel="surfacePointerUp">
        <header class="topbar surface-piece" style="--piece-order: 0">
          <div class="welcome-row">
            <div>
              <h1>{{ username }}的观影记录</h1>
              <p>把看过的故事，留在这里。</p>
            </div>
            <button class="avatar-button" aria-label="打开个人设置" @click="openSettings()">
              <img v-if="avatarUrl" :src="avatarUrl" alt="" />
              <span v-else>{{ username.slice(0, 1) }}</span>
            </button>
          </div>

          <div class="dashboard-controls">
            <section class="status-switch" :class="`is-${activeWatchStat}`" aria-label="观看状态筛选">
              <i class="status-switch__dot" aria-hidden="true"></i>
              <span class="status-switch__thumb" aria-hidden="true"></span>
              <button :class="{ selected: activeWatchStat === 'unwatched' }" @click="setWatchStat('unwatched')">
                <span>未观看</span><strong>{{ unwatchedCount }}</strong>
              </button>
              <button :class="{ selected: activeWatchStat === 'watched' }" @click="setWatchStat('watched')">
                <span>已观看</span><strong>{{ watchedCount }}</strong>
              </button>
            </section>

            <button class="view-mode-button" :class="{ 'is-list': viewMode === 'list' }" :aria-label="viewMode === 'cards' ? '切换为列表视图' : '切换为卡片视图'" @click="toggleViewMode">
              <img :src="viewMode === 'cards' ? pixelCards : pixelRows" alt="" />
            </button>
          </div>
        </header>

        <section class="record-stage" :class="{ 'list-stage': viewMode === 'list' }" aria-labelledby="recent-heading">
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
            <button v-else-if="activeWatchStat === 'watched'" class="period-badge" @click="openSettings('home')">{{ periodLabel }}</button>
          </div>

          <Transition name="drop-swap" mode="out-in" class="surface-piece" style="--piece-order: 2">
            <MovieCarousel v-if="viewMode === 'cards'" :key="`cards-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="displayedMovies" :active="currentPage === 'home'" @mark-watched="markWatched" @open-detail="openDetail" />
            <MovieList v-else :key="`list-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="displayedMovies" @open-detail="openHomeListDetail" @mark-watched="markWatched" />
          </Transition>
        </section>
        </section>

        <section v-else-if="surfacePage === 'library'" key="library" class="surface-view library-surface" :class="{ 'is-surface-dragging': surfaceDragging }" :style="{ '--surface-drag': `${surfaceDragX}px` }" aria-label="电影列表页面" @click="dismissLibraryPopovers" @pointerdown="surfacePointerDown" @pointermove="surfacePointerMove" @pointerup="surfacePointerUp" @pointercancel="surfacePointerUp">
          <header class="library-header surface-piece" style="--piece-order: 0">
            <div>
              <h1>
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
                <span class="library-title-separator">·</span>
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
              </h1>
            </div>
            <div class="library-media-switch">
              <button aria-label="切换内容显示" :aria-expanded="libraryMediaMenuOpen" @click="libraryMediaMenuOpen = !libraryMediaMenuOpen"><span>{{ libraryMediaType }}</span><ChevronDown :size="13" /></button>
              <div v-if="libraryMediaMenuOpen" class="library-media-menu"><button v-for="type in libraryMediaTypes" :key="type" :class="{ selected: libraryMediaType === type }" @click="libraryMediaType = type; libraryMediaMenuOpen = false">{{ type }}</button></div>
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
            <div class="library-chip-scroll">
              <button class="library-search-chip" :class="{ selected: librarySearchOpen }" aria-label="打开搜索" @click="toggleLibrarySearch"><Search :size="13" /></button>
              <button v-for="genre in visibleLibraryGenres" :key="genre" :class="{ selected: libraryGenre === genre }" @click="libraryGenre = genre">{{ genre === 'all' ? '全部类型' : genre }}</button>
            </div>
            <button class="category-chip" aria-label="打开更多分类" @click="categoryOpen = true"><small>更多</small><strong>分类</strong><ChevronRight :size="13" /></button>
          </div>

          <div class="library-timeline surface-piece" :class="{ searching: librarySearchOpen }" style="--piece-order: 3">
            <aside class="date-dock" :class="{ expanded: libraryDateExpanded }" aria-label="日期选择">
              <button class="date-dock__toggle" :aria-expanded="libraryDateExpanded" @click="libraryDateExpanded = !libraryDateExpanded"><small>{{ libraryYearValue }}</small><strong>{{ libraryMonthValue }}/{{ selectedLibraryDay }}</strong><ChevronRight :size="13" /></button>
              <div class="date-dock__options">
                <div class="date-option-row"><span>年份</span><div><button v-for="year in [2024, 2025, 2026, 2027, 2028]" :key="year" :class="{ selected: libraryYearValue === year }" @click="libraryYearValue = year">{{ year }}</button></div></div>
                <div class="date-option-row"><span>月份</span><div><button v-for="month in 12" :key="month" :class="{ selected: libraryMonthValue === month }" @click="libraryMonthValue = month">{{ month }}月</button></div></div>
                <div class="date-option-row"><span>日期</span><div><button v-for="date in libraryDateItems" :key="date.day" :class="{ selected: selectedLibraryDay === date.day }" @click="selectedLibraryDay = date.day; libraryDateExpanded = false">{{ date.day }}</button></div></div>
              </div>
            </aside>
            <div class="library-status-stack" role="group" aria-label="观看状态筛选">
              <button class="status-cycle-button" :class="`is-${activeLibraryWatchState.value}`" :aria-label="`当前${activeLibraryWatchState.label}，点击切换观看状态`" @click="cycleLibraryWatchFilter">
                <Transition name="status-cycle" mode="out-in">
                  <span :key="activeLibraryWatchState.value" class="status-cycle-content"><small>{{ activeLibraryWatchState.label }}</small><strong>{{ activeLibraryWatchState.count }}</strong></span>
                </Transition>
                <ChevronDown :size="12" />
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
                  <div class="library-preview__footer"><small>{{ movie.feeling || '展开完整详情查看更多记录。' }}</small><button :aria-label="`访问${movie.title}详情`" @click="openDetailFromPoster(movie, $event.currentTarget.closest('.library-row'))">访问 <ArrowUpRight :size="14" /></button></div>
                </div>
              </Transition>
            </article>

            <div v-if="!libraryMovies.length" class="empty-state"><Search :size="24" /><strong>没有找到相关电影</strong><span>试试换一个关键词或筛选条件</span></div>
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

      <div v-if="categoryOpen" class="category-backdrop" @click.self="categoryOpen = false">
        <aside class="category-sheet" aria-label="电影分类面板">
          <div class="sheet-handle"></div>
          <header><div><small>{{ libraryMediaType }}分类</small><h2>选择影片类型</h2></div><button aria-label="关闭分类" @click="categoryOpen = false"><X :size="18" /></button></header>
          <section class="genre-only-section"><h3>常用类型</h3><div class="category-options"><button :class="{ selected: libraryGenre === 'all' }" @click="libraryGenre = 'all'">全部类型</button><button v-for="genre in libraryGenres" :key="genre" :class="{ selected: libraryGenre === genre }" @click="libraryGenre = genre">{{ genre }}</button></div></section>
          <section class="library-sort-section"><h3>排列方式</h3><div class="library-sort-options"><button :class="{ selected: librarySortBy === 'name' }" @click="librarySortBy = 'name'">名字</button><button :class="{ selected: librarySortBy === 'release' }" @click="librarySortBy = 'release'">发布日期</button><button :class="{ selected: librarySortBy === 'rating' }" @click="librarySortBy = 'rating'">评分</button><button :class="{ selected: librarySortBy === 'personal' }" @click="librarySortBy = 'personal'">个人评分</button></div></section>
          <button class="unwatched-priority-button" :class="{ selected: libraryUnwatchedFirst }" @click="libraryUnwatchedFirst = !libraryUnwatchedFirst"><span><strong>未观看优先</strong><small>“全部”列表中优先展示未观看内容</small></span><i><Check :size="13" /></i></button>
          <button class="category-done" @click="categoryOpen = false">完成</button>
        </aside>
      </div>

      <div v-if="addOpen && (currentPage === 'home' || currentPage === 'library')" class="sheet-backdrop" :class="{ 'is-recording': recordExpanded, 'is-closing': recordClosing }" @click.self="closeRecordSheet">
        <div class="add-sheet" :class="{ expanded: recordExpanded, closing: recordClosing }" role="dialog" aria-modal="true" aria-label="添加电影记录">
          <div class="sheet-handle"></div>
          <template v-if="!recordExpanded">
            <h2>记录一部电影</h2><p>输入电影名称，从 TMDB 获取封面和影片资料。</p><button @click="startRecord">开始记录</button>
          </template>
          <template v-else>
            <header class="record-header" :class="{ 'has-results': tmdbSearchState === 'success' && tmdbResults.length }"><div><small>{{ tmdbSearchState === 'success' && tmdbResults.length ? `搜索结果 · ${tmdbTotalResults} 部` : '新建记录' }}</small><h2>{{ tmdbSearchState === 'success' && tmdbResults.length ? `“${tmdbSearchLastQuery}”` : '搜索一部电影' }}</h2></div><button aria-label="关闭添加电影" @click="closeRecordSheet"><X :size="19" /></button></header>
            <form class="tmdb-search" :class="{ 'is-complete': tmdbSearchState === 'success' && tmdbResults.length }" @submit.prevent="tmdbSearchState === 'success' && tmdbResults.length ? resetTmdbSearch() : searchTmdb()"><Search :size="18" /><input v-model="tmdbQuery" autofocus type="search" placeholder="输入电影名称，例如：流浪地球" aria-label="TMDB电影名称" /><button type="submit" :disabled="tmdbSearchState === 'loading'">{{ tmdbSearchState === 'loading' ? '搜索中' : tmdbSearchState === 'success' && tmdbResults.length ? '重新搜索' : '搜索' }}</button></form>
            <div v-if="!tmdbToken" class="record-api-note"><Database :size="18" /><div><strong>还没有配置 TMDB API 密钥</strong><span>先完成设置，之后输入名称即可获取电影。</span></div><button @click="openTmdbSettingsFromRecord">去设置</button></div>
            <div v-else-if="tmdbSearchState === 'idle'" class="record-empty"><Search :size="24" /><strong>按名称查找 TMDB</strong><span>搜索结果只用于展示和创建观影记录。</span></div>
            <div v-if="tmdbSearchMessage" class="record-message" :class="`is-${tmdbSearchState}`">{{ tmdbSearchMessage }}</div>
            <div v-if="tmdbSearchState === 'success' && tmdbResults.length" class="tmdb-results-status"><span>已显示 {{ tmdbResults.length }} / {{ tmdbTotalResults }} 部</span><small>下拉刷新 · 触底加载更多</small></div>
            <div v-if="tmdbSearchState === 'success' && !tmdbResults.length" class="record-no-results"><Search :size="24" /><strong>没有找到“{{ tmdbSearchLastQuery }}”</strong><span>TMDB 不会自动纠正中文错别字，请检查片名，或尝试原名、英文名。</span></div>
            <div v-if="tmdbResults.length" class="tmdb-results" :style="{ '--refresh-pull': `${tmdbRefreshPull}px` }" @scroll="handleTmdbScroll" @touchstart="startTmdbPull" @touchmove="moveTmdbPull" @touchend="endTmdbPull" @touchcancel="endTmdbPull">
              <div class="tmdb-refresh-indicator" :class="{ ready: tmdbRefreshPull >= 48, refreshing: tmdbRefreshing }"><i></i><span>{{ tmdbRefreshing ? '正在刷新…' : tmdbRefreshPull >= 48 ? '松开刷新' : '下拉刷新' }}</span></div>
              <article v-for="result in tmdbResults" :key="result.id" class="tmdb-result-item" :class="{ 'is-open': selectedTmdbResult?.id === result.id }">
                <div class="tmdb-result-summary">
                  <div class="tmdb-result-poster" :style="tmdbPoster(result) ? { backgroundImage: `url(${tmdbPoster(result)})` } : {}"><span v-if="!result.poster_path">暂无封面</span></div>
                  <div class="tmdb-result-copy"><small>{{ result.release_date?.slice(0, 4) || '待定' }} · TMDB {{ result.vote_average?.toFixed(1) || '暂无评分' }}</small><strong>{{ result.title || result.original_title }}</strong><p>{{ result.original_title || '暂无原名' }}</p></div>
                  <button class="tmdb-view-button" :aria-expanded="selectedTmdbResult?.id === result.id" @click="viewTmdbResult(result)">{{ selectedTmdbResult?.id === result.id ? '查看中' : '查看' }}<ChevronDown :size="13" /></button>
                </div>
              </article>
              <button v-if="tmdbPage < tmdbTotalPages" class="tmdb-load-more" :disabled="tmdbLoadingMore" @click="loadMoreTmdb"><i></i>{{ tmdbLoadingMore ? '正在加载…' : '加载更多' }}</button>
              <div v-else class="tmdb-results-end">已经到底了 · 共 {{ tmdbTotalResults }} 部</div>
            </div>

            <Transition name="tmdb-modal">
              <div v-if="selectedTmdbResult" class="tmdb-detail-backdrop" @click.self="selectedTmdbResult = null">
                <section class="tmdb-detail-modal" role="dialog" aria-modal="true" :aria-label="`${selectedTmdbResult.title || selectedTmdbResult.original_title} 添加详情`">
                  <header class="tmdb-modal-header"><div class="tmdb-result-poster" :style="tmdbPoster(selectedTmdbResult) ? { backgroundImage: `url(${tmdbPoster(selectedTmdbResult)})` } : {}"></div><div><small>{{ selectedTmdbResult.release_date?.slice(0, 4) || '待定' }} · TMDB {{ selectedTmdbResult.vote_average?.toFixed(1) || '暂无评分' }}</small><h3>{{ selectedTmdbResult.title || selectedTmdbResult.original_title }}</h3><p>{{ selectedTmdbResult.original_title || '暂无原名' }}</p></div><button aria-label="收起详情" @click="selectedTmdbResult = null"><X :size="17" /></button></header>
                  <div class="tmdb-modal-scroll">
                    <section class="tmdb-info-card"><div class="tmdb-card-title"><span>影片介绍</span><small>{{ selectedTmdbResult.release_date?.slice(0, 4) || '年份待定' }}</small></div><p>{{ selectedTmdbResult.overview || '暂无剧情简介。' }}</p></section>
                    <section class="tmdb-add-card">
                      <div class="tmdb-card-title"><span>添加设置</span><small>完善你的记录</small></div>
                      <label class="tmdb-field"><span>类型</span><select v-model="addMediaType"><option v-for="type in libraryMediaTypes" :key="type">{{ type }}</option></select></label>
                      <label class="tmdb-watch-toggle"><span><strong>是否已观看</strong><small>{{ addWatched ? '记录评分与观后感' : '加入待看清单' }}</small></span><input v-model="addWatched" type="checkbox" /><i aria-hidden="true"></i></label>
                      <Transition name="watched-fields"><div v-if="addWatched" class="tmdb-watched-fields"><div class="tmdb-rating"><span>个人评分</span><div><button v-for="score in 5" :key="score" type="button" :class="{ selected: addRating >= score * 2 }" :aria-label="`${score * 2} 分`" @click="addRating = score * 2"><Star :size="18" /></button><strong>{{ addRating || '—' }}<small>/ 10</small></strong></div></div><label class="tmdb-review"><span>个人评价</span><textarea v-model="addReview" rows="3" placeholder="写下看完后的感受……"></textarea></label></div></Transition>
                      <button class="tmdb-confirm-add" @click="addTmdbMovie(selectedTmdbResult)"><Check :size="15" />确认添加</button>
                    </section>
                  </div>
                </section>
              </div>
            </Transition>
          </template>
        </div>
      </div>

      <div v-if="posterFlight" class="poster-flight" :class="`poster-flight--${posterFlight.movie.poster}`" :style="{ '--flight-left': `${posterFlight.left}px`, '--flight-top': `${posterFlight.top}px`, '--flight-width': `${posterFlight.width}px`, '--flight-height': `${posterFlight.height}px`, ...libraryPosterStyle(posterFlight.movie) }" aria-hidden="true"></div>

      <MovieDetail v-if="currentPage === 'detail' && selectedMovie" :movie="selectedMovie" :entry-mode="detailEntry" @back="closeDetail" @navigate="navigateDetail" @update-watched="updateWatched" @update-record="updateMovieRecord" />

      <Transition name="settings-shell">
        <section v-if="currentPage === 'settings'" class="personal-settings">
          <Transition :name="settingsTransitionName" mode="out-in">
            <div :key="settingsSection" class="settings-page">
              <header class="settings-header settings-piece" style="--settings-order: 0">
                <button :aria-label="settingsSection === 'hub' ? '返回首页' : '返回设置'" @click="backFromSettings"><ChevronLeft :size="22" /></button>
                <div>
                  <h1>{{ settingsSection === 'hub' ? '设置' : settingsSection === 'profile' ? '个人信息' : settingsSection === 'home' ? '首页编辑' : settingsSection === 'library' ? '列表设置' : settingsSection === 'categories' ? '分类设置' : 'TMDB 设置' }}</h1>
                  <p>{{ settingsSection === 'hub' ? '把常用设置收进清晰的分类里。' : settingsSection === 'profile' ? '头像和名称会显示在首页。' : settingsSection === 'home' ? '控制首页的统计与展示数量。' : settingsSection === 'library' ? '控制片库快捷标签的显示数量。' : settingsSection === 'categories' ? '管理两层分类、自定义内容与显示顺序。' : '配置数据接口与国内网络访问。' }}</p>
                </div>
              </header>

              <template v-if="settingsSection === 'hub'">
                <button class="profile-card profile-card--link settings-piece" style="--settings-order: 1" @click="openSettingsSection('profile')">
                  <div class="profile-avatar">
                    <img v-if="avatarUrl" :src="avatarUrl" alt="" />
                    <span v-else>{{ username.slice(0, 1) }}</span>
                  </div>
                  <div><strong>{{ username || '未命名用户' }}</strong><span>头像与名称 · {{ watchedCount }} 部已观看</span></div>
                  <ChevronRight :size="19" />
                </button>

                <div class="settings-category settings-piece" style="--settings-order: 2">
                  <button @click="openSettingsSection('home')"><i class="settings-icon settings-icon--home"><House :size="18" /></i><span><strong>首页编辑</strong><small>统计单位、展示数量</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('library')"><i class="settings-icon settings-icon--library"><SlidersHorizontal :size="18" /></i><span><strong>列表设置</strong><small>快捷分类显示数量</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('categories')"><i class="settings-icon settings-icon--categories"><FolderTree :size="18" /></i><span><strong>分类设置</strong><small>两层分类、自定义与拖动排序</small></span><ChevronRight :size="18" /></button>
                  <button @click="openSettingsSection('tmdb')"><i class="settings-icon settings-icon--tmdb"><Database :size="18" /></i><span><strong>TMDB 设置</strong><small>API、图片与国内网络</small></span><ChevronRight :size="18" /></button>
                </div>
                <p class="settings-footnote settings-piece" style="--settings-order: 3">所有设置只保存在当前浏览器中。</p>
              </template>

              <template v-else-if="settingsSection === 'profile'">
                <div class="profile-editor settings-piece" style="--settings-order: 1">
                  <div class="profile-avatar profile-avatar--large"><img v-if="avatarUrl" :src="avatarUrl" alt="" /><span v-else>{{ username.slice(0, 1) }}</span></div>
                  <div><strong>{{ username || '未命名用户' }}</strong><span>个人资料预览</span></div>
                </div>
                <div class="settings-group settings-piece" style="--settings-order: 2"><label for="username">名称</label><input id="username" v-model.trim="username" maxlength="10" placeholder="输入你的名字" /><small>首页将显示“{{ username || '用户' }}的观影记录”。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 3"><label>本地头像</label><label class="avatar-upload"><Upload :size="17" /><span>从本地选择图片</span><input type="file" accept="image/*" @change="handleAvatarUpload" /></label><small>{{ avatarUploadMessage || '图片会裁剪为正方形并保存在当前浏览器。' }}</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 4"><label for="avatar-url">或使用图片地址</label><input id="avatar-url" v-model.trim="avatarUrl" inputmode="url" placeholder="https://example.com/avatar.jpg" /><small>留空时显示名称首字。</small></div>
              </template>

              <template v-else-if="settingsSection === 'home'">
                <div class="settings-group settings-piece" style="--settings-order: 1"><label>默认统计单位</label><div class="period-options" role="group" aria-label="时间单位"><button v-for="option in [{ value: 'year', label: '年' }, { value: 'month', label: '月' }, { value: 'week', label: '周' }, { value: 'day', label: '日' }]" :key="option.value" :class="{ selected: statPeriod === option.value }" @click="statPeriod = option.value">{{ option.label }}</button></div></div>
                <div class="settings-group settings-piece" style="--settings-order: 2"><label>首页最多展示</label><div class="period-options home-limit-options" role="group" aria-label="首页电影展示数量"><button v-for="limit in [5, 10]" :key="limit" :class="{ selected: homeDisplayLimit === limit }" @click="homeDisplayLimit = limit">{{ limit }} 部</button></div><small>默认展示 5 部，最多可以设置为 10 部。</small></div>
              </template>

              <template v-else-if="settingsSection === 'library'">
                <div class="settings-group settings-piece" style="--settings-order: 1"><label>快捷标签数量</label><div class="tag-limit-options"><button v-for="limit in [5, 7, 9]" :key="limit" :class="{ selected: libraryTagLimit === limit }" @click="libraryTagLimit = limit"><strong>{{ limit }}</strong><span>个标签</span></button></div><small>片库默认显示 5 个；更多标签可以横向滑动查看。</small></div>
              </template>

              <template v-else-if="settingsSection === 'categories'">
                <CategorySettings v-model:categories="categorySettings" />
              </template>

              <template v-else>
                <div class="network-options settings-piece" style="--settings-order: 1" role="group" aria-label="TMDB 网络方式">
                  <button :class="{ selected: tmdbNetworkMode === 'hosts' }" @click="tmdbNetworkMode = 'hosts'"><strong>系统 hosts</strong><span>国内推荐</span></button>
                  <button :class="{ selected: tmdbNetworkMode === 'custom' }" @click="tmdbNetworkMode = 'custom'"><strong>自定义地址</strong><span>反代或镜像</span></button>
                </div>
                <div class="tmdb-notice settings-piece" style="--settings-order: 2">
                  <Database :size="20" />
                  <div><strong>{{ tmdbNetworkMode === 'hosts' ? '使用 CheckTMDB hosts' : '使用你自己的服务地址' }}</strong><p>{{ tmdbNetworkMode === 'hosts' ? 'CheckTMDB 提供域名到可用 IP 的映射，不是 API 代理。配置到系统或路由器 hosts 后，应用仍访问 TMDB 官方域名。' : '仅填写你信任的 TMDB 反代地址；图片地址也需由该服务支持。' }}</p></div>
                </div>
                <div class="settings-group settings-piece" style="--settings-order: 3"><label for="tmdb-token">API 密钥</label><input id="tmdb-token" v-model.trim="tmdbToken" type="password" autocomplete="off" placeholder="输入 TMDB v3 API 密钥" /><small>支持 v3 API 密钥；旧的 Read Access Token 也会自动识别。密钥只保存在当前浏览器。</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 4"><label for="tmdb-api">API 地址</label><input id="tmdb-api" v-model.trim="tmdbApiBase" inputmode="url" /><small>官方默认：https://api.themoviedb.org/3</small></div>
                <div class="settings-group settings-piece" style="--settings-order: 5"><label for="tmdb-image">图片地址</label><input id="tmdb-image" v-model.trim="tmdbImageBase" inputmode="url" /><small>官方默认：https://image.tmdb.org/t/p</small></div>
                <div v-if="tmdbNetworkMode === 'hosts'" class="hosts-links settings-piece" style="--settings-order: 6"><a href="https://raw.githubusercontent.com/cnwikee/CheckTMDB/refs/heads/main/Tmdb_host_ipv4" target="_blank" rel="noreferrer">IPv4 hosts <ExternalLink :size="13" /></a><a href="https://raw.githubusercontent.com/cnwikee/CheckTMDB/refs/heads/main/Tmdb_host_ipv6" target="_blank" rel="noreferrer">IPv6 hosts <ExternalLink :size="13" /></a></div>
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
