<script setup>
import { computed, ref, watch } from 'vue'
import { ChevronLeft } from 'lucide-vue-next'
import MovieCarousel from './components/MovieCarousel.vue'
import MovieList from './components/MovieList.vue'
import MovieDetail from './components/MovieDetail.vue'
import { movies } from './data/movies'
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
  currentPage.value = 'detail'
}

function closeDetail() {
  currentPage.value = 'home'
  selectedMovie.value = null
}

function updateWatched(value) {
  if (selectedMovie.value) selectedMovie.value.watched = value
}
</script>

<template>
  <main class="app-shell">
    <section class="phone" :aria-label="currentPage === 'home' ? `${username}的观影记录首页` : currentPage === 'detail' ? '电影详情页面' : '个人设置页面'">
      <div class="ambient-orb ambient-orb--one" aria-hidden="true"></div>
      <div class="ambient-orb ambient-orb--two" aria-hidden="true"></div>

      <template v-if="currentPage === 'home'">
        <header class="topbar">
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
          <div class="stage-heading">
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

          <Transition name="drop-swap" mode="out-in">
            <MovieCarousel v-if="viewMode === 'cards'" :key="`cards-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="filteredMovies" @mark-watched="markWatched" @open-detail="openDetail" />
            <MovieList v-else :key="`list-${activeWatchStat}-${statPeriod}-${selectedYear}`" :movies="filteredMovies" />
          </Transition>
        </section>

        <nav class="bottom-nav" aria-label="主要导航">
          <button class="add-dock" aria-label="添加电影记录" @click="addOpen = true"><img :src="pixelPlus" alt="" /></button>
          <div class="nav-island">
            <button :class="{ selected: activeTab === 'home' }" aria-label="首页" @click="activeTab = 'home'"><img :src="pixelHome" alt="" /></button>
            <button :class="{ selected: activeTab === 'list' }" aria-label="电影列表" @click="activeTab = 'list'"><img :src="pixelMovieList" alt="" /></button>
          </div>
        </nav>

        <div v-if="addOpen" class="sheet-backdrop" @click.self="addOpen = false">
          <div class="add-sheet" role="dialog" aria-modal="true" aria-label="添加电影记录">
            <div class="sheet-handle"></div>
            <h2>记录一部电影</h2>
            <p>添加观看状态、你的评分，以及只属于你的观影感受。</p>
            <button @click="addOpen = false">开始记录</button>
          </div>
        </div>
      </template>

      <MovieDetail v-else-if="currentPage === 'detail' && selectedMovie" :movie="selectedMovie" @back="closeDetail" @update-watched="updateWatched" />

      <section v-else class="personal-settings">
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
