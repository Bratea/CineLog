<script setup>
import { computed, ref } from 'vue'
import { Check, ChevronRight, Search, SlidersHorizontal, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({
  movies: { type: Array, required: true },
  homeIcon: { type: String, required: true },
  listIcon: { type: String, required: true },
})

const emit = defineEmits(['home', 'open-detail'])
const query = ref('')
const status = ref('all')
const sortBy = ref('rating')

const filteredMovies = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase('zh-CN')
  const results = props.movies.filter((movie) => {
    const matchesQuery = !keyword || `${movie.title} ${movie.originalTitle} ${movie.meta}`.toLocaleLowerCase('zh-CN').includes(keyword)
    const matchesStatus = status.value === 'all' || (status.value === 'watched' ? movie.watched : !movie.watched)
    return matchesQuery && matchesStatus
  })

  return [...results].sort((a, b) => {
    if (sortBy.value === 'title') return a.title.localeCompare(b.title, 'zh-CN')
    if (sortBy.value === 'year') return Number(b.year) - Number(a.year)
    return (b.rating ?? -1) - (a.rating ?? -1)
  })
})

const counts = computed(() => ({
  all: props.movies.length,
  watched: props.movies.filter((movie) => movie.watched).length,
  unwatched: props.movies.filter((movie) => !movie.watched).length,
}))

function posterStyle(movie) {
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : undefined
}
</script>

<template>
  <section class="library-page" aria-label="电影列表页面">
    <header class="library-header">
      <div>
        <p>我的片库</p>
        <h1>全部电影</h1>
      </div>
      <div class="library-total"><strong>{{ movies.length }}</strong><span>部收藏</span></div>
    </header>

    <label class="search-box">
      <Search :size="18" stroke-width="2.2" />
      <input v-model="query" type="search" placeholder="搜索电影、类型或英文名" aria-label="搜索电影" />
      <kbd v-if="!query">⌘ K</kbd>
    </label>

    <div class="library-tools">
      <div class="status-tabs" role="group" aria-label="观看状态">
        <button v-for="item in [{ value: 'all', label: '全部' }, { value: 'watched', label: '看过' }, { value: 'unwatched', label: '想看' }]" :key="item.value" :class="{ selected: status === item.value }" @click="status = item.value">
          {{ item.label }}<span>{{ counts[item.value] }}</span>
        </button>
      </div>
      <label class="sort-control" aria-label="排序方式">
        <SlidersHorizontal :size="14" />
        <select v-model="sortBy">
          <option value="rating">评分</option>
          <option value="title">片名</option>
          <option value="year">年份</option>
        </select>
      </label>
    </div>

    <div class="result-heading">
      <span>{{ query ? `“${query}”的结果` : '收藏影片' }}</span>
      <small>{{ filteredMovies.length }} 部</small>
    </div>

    <div class="library-list" aria-live="polite">
      <article v-for="movie in filteredMovies" :key="movie.id" class="library-row" tabindex="0" @click="emit('open-detail', movie)" @keydown.enter="emit('open-detail', movie)">
        <div class="library-poster" :class="`library-poster--${movie.poster}`" :style="posterStyle(movie)">
          <span>{{ movie.posterText }}</span>
        </div>
        <div class="library-copy">
          <p>{{ movie.meta }} · {{ movie.year }}</p>
          <h2>{{ movie.title }}</h2>
          <div class="library-meta">
            <span class="score" :class="{ muted: movie.rating === null }"><Star :size="12" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '暂无评分' }}</span>
            <span class="watched" :class="{ pending: !movie.watched }"><Check :size="11" stroke-width="3" />{{ movie.watched ? '已观看' : '想看' }}</span>
          </div>
        </div>
        <button class="row-action" :aria-label="`查看${movie.title}详情`" @click.stop="emit('open-detail', movie)"><ChevronRight :size="17" /></button>
      </article>

      <div v-if="!filteredMovies.length" class="empty-state">
        <Search :size="24" />
        <strong>没有找到相关电影</strong>
        <span>试试换一个关键词或筛选条件</span>
      </div>
    </div>

    <nav class="library-nav" aria-label="主要导航">
      <button aria-label="首页" @click="emit('home')"><img :src="homeIcon" alt="" /></button>
      <button class="selected" aria-label="电影列表"><img :src="listIcon" alt="" /></button>
    </nav>
  </section>
</template>

<style lang="scss" scoped>
.library-page { position: absolute; z-index: 6; inset: 0; padding: 42px 20px 96px; overflow: hidden; background: linear-gradient(180deg, #fff 0%, #fafafa 64%, #f1f1f3 100%); animation: library-in .55s cubic-bezier(.16,1,.3,1) both; }
.library-header { display: flex; align-items: end; justify-content: space-between; }
.library-header p { margin: 0 0 5px; color: #96979c; font-size: 11px; font-weight: 700; letter-spacing: .1em; }
.library-header h1 { font-size: 30px; letter-spacing: -.07em; }
.library-total { display: flex; align-items: baseline; gap: 4px; padding-bottom: 3px; }
.library-total strong { font-size: 24px; letter-spacing: -.06em; }
.library-total span { color: #929399; font-size: 10px; font-weight: 650; }
.search-box { display: flex; align-items: center; gap: 9px; height: 45px; margin-top: 21px; padding: 0 13px; color: #6f7075; border: 1px solid #e5e5e8; border-radius: 15px; background: #f3f3f5; transition: border-color .2s ease, background .2s ease, box-shadow .2s ease; }
.search-box:focus-within { border-color: #c8c8cc; background: #fff; box-shadow: 0 8px 20px rgba(15,16,19,.07); }
.search-box input { min-width: 0; flex: 1; padding: 0; color: #1b1c1f; border: 0; outline: 0; background: transparent; font: inherit; font-size: 12px; }
.search-box input::placeholder { color: #a1a2a7; }
.search-box kbd { padding: 3px 6px; color: #8e8f94; border: 1px solid #dedee1; border-radius: 6px; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.04); font-family: inherit; font-size: 8px; }
.library-tools { display: flex; align-items: center; justify-content: space-between; gap: 9px; margin-top: 13px; }
.status-tabs { display: flex; min-width: 0; gap: 4px; }
.status-tabs button { display: inline-flex; align-items: center; gap: 4px; height: 31px; padding: 0 10px; color: #737479; border: 0; border-radius: 10px; background: transparent; font-size: 10px; font-weight: 750; transition: color .2s ease, background .25s ease, transform .2s ease; }
.status-tabs button span { color: #a3a4a8; font-size: 8px; }
.status-tabs button.selected { color: #fff; background: #1c1d20; box-shadow: 0 7px 14px rgba(18,19,22,.15); }
.status-tabs button.selected span { color: #b8b9bc; }
.status-tabs button:active { transform: scale(.94); }
.sort-control { display: flex; align-items: center; gap: 4px; height: 31px; padding: 0 8px; color: #77787d; border: 1px solid #e6e6e8; border-radius: 10px; background: #fff; }
.sort-control select { width: 43px; padding: 0; color: #55565b; border: 0; outline: 0; background: transparent; font: inherit; font-size: 9px; font-weight: 700; }
.result-heading { display: flex; align-items: center; justify-content: space-between; margin: 20px 2px 9px; }
.result-heading span { color: #232428; font-size: 12px; font-weight: 800; }
.result-heading small { color: #9a9ba0; font-size: 9px; }
.library-list { display: grid; gap: 8px; max-height: calc(100% - 205px); padding: 0 1px 10px; overflow-y: auto; scrollbar-width: none; }
.library-list::-webkit-scrollbar { display: none; }
.library-row { display: grid; grid-template-columns: 58px minmax(0, 1fr) 31px; align-items: center; gap: 11px; min-height: 76px; padding: 8px 9px; border: 1px solid #ececef; border-radius: 19px; outline: 0; background: rgba(255,255,255,.94); box-shadow: 0 5px 13px rgba(18,19,22,.035); cursor: pointer; transition: transform .3s cubic-bezier(.16,1,.3,1), box-shadow .3s ease, border-color .2s ease; animation: row-rise .55s cubic-bezier(.16,1,.3,1) both; }
.library-row:hover, .library-row:focus-visible { border-color: #dadade; transform: translateY(-2px); box-shadow: 0 11px 22px rgba(18,19,22,.08); }
.library-poster { position: relative; display: flex; align-items: end; width: 58px; height: 58px; overflow: hidden; padding: 6px; color: #fff; border-radius: 14px; background-size: cover; background-position: center; box-shadow: inset 0 0 0 1px rgba(255,255,255,.15); isolation: isolate; }
.library-poster::after { content: ''; position: absolute; z-index: -1; inset: 35% 0 0; background: linear-gradient(transparent, rgba(0,0,0,.72)); }
.library-poster span { max-width: 46px; font-size: 7px; font-weight: 900; line-height: 1.05; white-space: pre-line; }
.library-poster--pop { background: radial-gradient(circle at 60% 20%, #ffcc74 0 9%, transparent 10%), linear-gradient(155deg, #4bb5cd, #1c4e80 50%, #061425); }
.library-poster--crayon { background: radial-gradient(circle at 25% 20%, #ffde68 0 14%, transparent 15%), linear-gradient(155deg, #61c1de, #eca55c 51%, #b33730); }
.library-poster--coco { background: radial-gradient(circle at 63% 19%, #ffda6b 0 12%, transparent 13%), linear-gradient(150deg, #3a61ad, #8b4074 56%, #f29b53); }
.library-copy { min-width: 0; }
.library-copy > p { overflow: hidden; margin: 0; color: #96979c; font-size: 8px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.library-copy h2 { overflow: hidden; margin: 3px 0 6px; font-size: 13px; line-height: 1.25; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
.library-meta { display: flex; align-items: center; gap: 10px; }
.library-meta span { display: inline-flex; align-items: center; gap: 3px; font-size: 9px; font-weight: 750; }
.score { color: #45464b; }
.score svg { color: #f0b300; }
.score.muted { color: #96979c; }
.score.muted svg { color: #b8b9bd; }
.watched { color: #407a61; }
.watched svg { box-sizing: content-box; padding: 2px; color: #fff; border-radius: 50%; background: #477e66; }
.watched.pending { color: #9a720e; }
.watched.pending svg { color: #9a720e; background: #fff0c5; }
.row-action { display: grid; place-items: center; width: 31px; height: 31px; padding: 0; color: #fff; border: 0; border-radius: 50%; background: #1e1f22; transition: transform .25s cubic-bezier(.16,1,.3,1); }
.row-action:hover { transform: translateX(2px) scale(1.04); }
.empty-state { display: grid; place-items: center; gap: 6px; padding: 47px 16px; color: #a0a1a6; text-align: center; }
.empty-state strong { color: #55565b; font-size: 13px; }
.empty-state span { font-size: 10px; }
.library-nav { position: absolute; right: 20px; bottom: 22px; display: grid; grid-template-columns: repeat(2, 1fr); width: 116px; height: 59px; padding: 5px 7px; border: 1px solid rgba(255,255,255,.12); border-radius: 23px; background: rgba(23,24,27,.93); box-shadow: 0 13px 25px rgba(0,0,0,.2); backdrop-filter: blur(20px); }
.library-nav button { display: grid; place-items: center; height: 43px; padding: 5px; border: 0; border-radius: 50%; background: transparent; transition: transform .25s ease, background .25s ease; }
.library-nav button.selected { background: #fff; box-shadow: 0 3px 9px rgba(0,0,0,.18); }
.library-nav button:active { transform: scale(.9); }
.library-nav img { width: 31px; height: 31px; object-fit: contain; image-rendering: pixelated; }
@keyframes library-in { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
@keyframes row-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@media (max-height: 760px) { .library-page { padding-top: 31px; } .search-box { margin-top: 15px; } .result-heading { margin-top: 14px; } }
@media (prefers-reduced-motion: reduce) { .library-page, .library-row { animation: none; } }
</style>
