<script setup>
import { computed, ref, watch } from 'vue'
import { Check, ChevronLeft, ChevronRight, Search, Star } from 'lucide-vue-next'
import MovieCarousel from './components/MovieCarousel.vue'
import MovieList from './components/MovieList.vue'
import MovieDetail from './components/MovieDetail.vue'
import { movies } from './data/movies'
import cinematicAnimeCollage from './assets/cinematic-anime-collage.png'
import pixelPlus from './assets/pixel-plus.webp'
import pixelHome from './assets/pixel-home.webp'
import pixelMovieList from './assets/pixel-movie-list.webp'
import pixelCards from './assets/pixel-cards.webp'
import pixelRows from './assets/pixel-rows.webp'

const currentPage = ref('home')
const movieRecords = ref(movies.map((movie) => ({ ...movie })))
const activeTab = ref('home')
const addOpen = ref(false)
const username = ref(localStorage.getItem('movie-username') || '通通')
const activeWatchStat = ref('watched')
const viewMode = ref('cards')
const statPeriod = ref(localStorage.getItem('movie-stat-period') || 'year')
const selectedYear = ref('2026')
const selectedMovie = ref(null)
const detailOrigin = ref('home')
const detailEntry = ref('home')
const transitionDirection = ref('forward')
const libraryQuery = ref('')
const libraryStatus = ref('watched')
const markingWatched = ref([])
const posterFlight = ref(null)
const phoneShell = ref(null)

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
const surfaceTransitionName = computed(() => transitionDirection.value === 'forward' ? 'surface-forward' : 'surface-back')
const libraryCounts = computed(() => ({ watched: watchedCount.value, unwatched: unwatchedCount.value }))
const libraryMovies = computed(() => {
  const keyword = libraryQuery.value.trim().toLocaleLowerCase('zh-CN')
  return movieRecords.value.filter((movie) => {
    const matchesStatus = libraryStatus.value === 'watched' ? movie.watched : !movie.watched
    const matchesQuery = !keyword || `${movie.title} ${movie.originalTitle} ${movie.meta}`.toLocaleLowerCase('zh-CN').includes(keyword)
    return matchesStatus && matchesQuery
  })
})

watch(username, (value) => localStorage.setItem('movie-username', value || '用户'))
watch(statPeriod, (value) => localStorage.setItem('movie-stat-period', value))

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
  }, 190)
  window.setTimeout(() => { posterFlight.value = null }, 720)
}

function openHomeListDetail(payload) {
  openDetailFromPoster(payload.movie, payload.source)
}

function closeDetail() {
  currentPage.value = detailOrigin.value
  selectedMovie.value = null
}

function showHome() {
  if (currentPage.value === 'home') return
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

function libraryPosterStyle(movie) {
  const path = movie.backdropUrl || movie.posterUrl || movie.backdrop_path || movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
    return { backgroundImage: `url(${src})` }
  }
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : undefined
}

function markLibraryWatched(movie) {
  if (movie.watched || markingWatched.value.includes(movie.id)) return
  markingWatched.value = [...markingWatched.value, movie.id]
  window.setTimeout(() => {
    movie.watched = true
    markingWatched.value = markingWatched.value.filter((id) => id !== movie.id)
  }, 920)
}

function updateWatched(value) {
  if (selectedMovie.value) selectedMovie.value.watched = value
}

function navigateDetail(direction) {
  const currentIndex = movieRecords.value.findIndex((movie) => movie.id === selectedMovie.value?.id)
  if (currentIndex < 0 || movieRecords.value.length < 2) return
  const nextIndex = (currentIndex + direction + movieRecords.value.length) % movieRecords.value.length
  selectedMovie.value = movieRecords.value[nextIndex]
}
</script>

<template>
  <main class="app-shell">
    <section ref="phoneShell" class="phone" :class="{ 'phone--detail': currentPage === 'detail' }" :aria-label="currentPage === 'home' ? `${username}的观影记录首页` : currentPage === 'library' ? '电影列表页面' : currentPage === 'detail' ? '电影详情页面' : '个人设置页面'">
      <div class="ambient-orb ambient-orb--one" aria-hidden="true"></div>
      <div class="ambient-orb ambient-orb--two" aria-hidden="true"></div>

      <Transition :name="surfaceTransitionName" :duration="{ enter: 720, leave: 650 }">
        <section v-if="currentPage === 'home'" key="home" class="surface-view home-surface">
        <header class="topbar surface-piece" style="--piece-order: 0">
          <div class="welcome-row">
            <div>
              <h1>{{ username }}的观影记录</h1>
              <p>把看过的故事，留在这里。</p>
            </div>
            <button class="avatar-button" aria-label="打开个人设置" @click="currentPage = 'settings'"><span>{{ username.slice(0, 1) }}</span></button>
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
              <p>{{ activeWatchStat === 'watched' ? watchedSubtitle : `还有 ${unwatchedCount} 部等待观看` }}</p>
            </div>
            <select v-if="activeWatchStat === 'watched' && statPeriod === 'year'" v-model="selectedYear" class="year-select" aria-label="选择年份">
              <option v-for="year in watchedYears" :key="year" :value="year">{{ year }} 年</option>
            </select>
            <button v-else-if="activeWatchStat === 'watched'" class="period-badge" @click="currentPage = 'settings'">{{ periodLabel }}</button>
            <span v-else>{{ filteredMovies.length }} 部</span>
          </div>

          <Transition name="drop-swap" mode="out-in" class="surface-piece" style="--piece-order: 2">
            <MovieCarousel v-if="viewMode === 'cards'" :key="`cards-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="filteredMovies" @mark-watched="markWatched" @open-detail="openDetail" />
            <MovieList v-else :key="`list-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="filteredMovies" @open-detail="openHomeListDetail" />
          </Transition>
        </section>
        </section>

        <section v-else-if="currentPage === 'library'" key="library" class="surface-view library-surface" aria-label="电影列表页面">
          <header class="library-header surface-piece" style="--piece-order: 0">
            <div><p>我的观影</p><h1>观影总结</h1></div>
            <div class="library-total"><strong>{{ movieRecords.length }}</strong><span>部记录</span></div>
          </header>

          <label class="search-box surface-piece" style="--piece-order: 1">
            <Search :size="18" stroke-width="2.2" />
            <input v-model="libraryQuery" type="search" placeholder="搜索观影记录" aria-label="搜索观影记录" />
            <kbd v-if="!libraryQuery">⌘ K</kbd>
          </label>

          <div class="status-tabs surface-piece" style="--piece-order: 2" role="group" aria-label="观看状态">
            <button v-for="item in [{ value: 'watched', label: '已观看' }, { value: 'unwatched', label: '未观看' }]" :key="item.value" :class="{ selected: libraryStatus === item.value }" @click="libraryStatus = item.value">
              <strong>{{ libraryCounts[item.value] }}</strong><span>{{ item.label }}</span>
            </button>
          </div>

          <div class="result-heading surface-piece" style="--piece-order: 3">
            <span>{{ libraryQuery ? `“${libraryQuery}”的结果` : libraryStatus === 'watched' ? '已观看记录' : '未观看记录' }}</span>
            <small>{{ libraryMovies.length }} 部</small>
          </div>

          <div class="library-list surface-piece" style="--piece-order: 4" aria-live="polite">
            <article v-for="(movie, index) in libraryMovies" :key="movie.id" class="library-row" :style="{ '--row-order': index }" role="button" tabindex="0" @click="openDetailFromPoster(movie, $event.currentTarget)" @keydown.enter.prevent="openDetailFromPoster(movie, $event.currentTarget)">
              <div class="library-poster" :class="`library-poster--${movie.poster}`" :style="libraryPosterStyle(movie)"><span>{{ movie.posterText }}</span></div>
              <div class="library-copy">
                <p>{{ movie.meta }} · {{ movie.year }}</p>
                <h2>{{ movie.title }}</h2>
                <div class="library-meta">
                  <span class="score" :class="{ muted: movie.rating === null }"><Star :size="12" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '暂无评分' }}</span>
                  <span class="watched" :class="{ pending: !movie.watched }"><Check :size="11" stroke-width="3" />{{ movie.watched ? '已观看' : '未观看' }}</span>
                </div>
              </div>
              <button v-if="movie.watched" class="row-action" :aria-label="`查看${movie.title}详情`" @click.stop="openDetailFromPoster(movie, $event.currentTarget.closest('.library-row'))"><ChevronRight :size="17" /></button>
              <button v-else class="watch-ring" :class="{ completing: markingWatched.includes(movie.id) }" :aria-label="`将${movie.title}标记为已观看`" @click.stop="markLibraryWatched(movie)">
                <svg viewBox="0 0 36 36" aria-hidden="true"><circle class="ring-track" cx="18" cy="18" r="14"/><circle class="ring-progress" cx="18" cy="18" r="14"/><path class="ring-check" d="m11.5 18.2 4.2 4.1 8.8-9"/></svg>
              </button>
            </article>

            <div v-if="!libraryMovies.length" class="empty-state"><Search :size="24" /><strong>没有找到相关电影</strong><span>试试换一个关键词或筛选条件</span></div>
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

      <div v-if="addOpen && (currentPage === 'home' || currentPage === 'library')" class="sheet-backdrop" @click.self="addOpen = false">
        <div class="add-sheet" role="dialog" aria-modal="true" aria-label="添加电影记录">
          <div class="sheet-handle"></div>
          <h2>记录一部电影</h2>
          <p>添加观看状态、你的评分，以及只属于你的观影感受。</p>
          <button @click="addOpen = false">开始记录</button>
        </div>
      </div>

      <div v-if="posterFlight" class="poster-flight" :class="`poster-flight--${posterFlight.movie.poster}`" :style="{ '--flight-left': `${posterFlight.left}px`, '--flight-top': `${posterFlight.top}px`, '--flight-width': `${posterFlight.width}px`, '--flight-height': `${posterFlight.height}px`, ...libraryPosterStyle(posterFlight.movie) }" aria-hidden="true"></div>

      <MovieDetail v-if="currentPage === 'detail' && selectedMovie" :movie="selectedMovie" :entry-mode="detailEntry" @back="closeDetail" @navigate="navigateDetail" @update-watched="updateWatched" />

      <section v-if="currentPage === 'settings'" class="personal-settings">
        <header class="settings-header">
          <button aria-label="返回首页" @click="currentPage = 'home'"><ChevronLeft :size="22" /></button>
          <div><h1>个人设置</h1><p>你的观影空间，由你定义。</p></div>
        </header>

        <div class="profile-card">
          <div class="profile-avatar">{{ username.slice(0, 1) }}</div>
          <div><strong>{{ username || '未命名用户' }}</strong><span>{{ watchedCount }} 部已观看</span></div>
        </div>

        <div class="settings-group">
          <label for="username">用户名</label>
          <input id="username" v-model.trim="username" maxlength="10" placeholder="输入你的名字" />
          <small>首页将显示“{{ username || '用户' }}的观影记录”</small>
        </div>

        <div class="settings-group">
          <label>默认统计单位</label>
          <div class="period-options" role="group" aria-label="时间单位">
            <button v-for="option in [{ value: 'year', label: '年' }, { value: 'month', label: '月' }, { value: 'week', label: '周' }, { value: 'day', label: '日' }]" :key="option.value" :class="{ selected: statPeriod === option.value }" @click="statPeriod = option.value">
              {{ option.label }}
            </button>
          </div>
        </div>

        <button class="save-settings" @click="currentPage = 'home'">保存并返回</button>
      </section>
    </section>
  </main>
</template>
