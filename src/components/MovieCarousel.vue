<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { Check, ChevronRight, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({ movies: { type: Array, required: true } })
const emit = defineEmits(['mark-watched', 'open-detail'])

const activeIndex = ref(0)
const deck = ref(null)
const glowCanvas = ref(null)
const dragStart = ref(null)
const dragX = ref(0)
const isDragging = ref(false)
const swipeStartX = ref(null)
const swipeX = ref(0)
const swipeMax = ref(0)
const isSwiping = ref(false)
const swipeSettled = ref(false)
const settlePulse = ref(false)
const suppressCardClick = ref(false)

let renderer
let scene
let camera
let material
let frame
let resizeObserver

const activeMovie = computed(() => props.movies[activeIndex.value])
const cardMovies = computed(() => {
  const count = props.movies.length
  if (!count) return []
  return props.movies.map((movie, index) => ({
    ...movie,
    offset: (index - activeIndex.value + count + Math.floor(count / 2)) % count - Math.floor(count / 2),
  })).filter((movie) => Math.abs(movie.offset) <= 1)
})

const visualOffset = (offset) => offset + dragX.value / 300

function move(direction) {
  const count = props.movies.length
  if (!count) return
  activeIndex.value = (activeIndex.value + direction + count) % count
  settlePulse.value = false
  window.requestAnimationFrame(() => {
    settlePulse.value = true
    window.setTimeout(() => { settlePulse.value = false }, 620)
  })
}

function pointerDown(event) {
  dragStart.value = event.clientX
  dragX.value = 0
  isDragging.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function pointerMove(event) {
  if (dragStart.value === null) return
  dragX.value = Math.max(-110, Math.min(110, event.clientX - dragStart.value))
}

function pointerUp(event) {
  if (dragStart.value === null) return
  const delta = event.clientX - dragStart.value
  suppressCardClick.value = Math.abs(delta) > 8
  if (Math.abs(delta) > 46) move(delta > 0 ? -1 : 1)
  dragStart.value = null
  dragX.value = 0
  isDragging.value = false
  window.setTimeout(() => { suppressCardClick.value = false }, 80)
}

function openCard(movie, offset) {
  if (offset === 0 && !suppressCardClick.value) emit('open-detail', movie)
}

function posterStyle(movie) {
  const path = movie.backdropUrl || movie.posterUrl || movie.backdrop_path || movie.poster_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
    return { backgroundImage: `url(${src})` }
  }
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : {}
}

function cardStyle(offset) {
  const value = visualOffset(offset)
  const isActive = Math.abs(offset) < 0.1
  return {
    '--x': `${value * 58}%`,
    '--rotate': `${value * 5}deg`,
    '--tilt': `${value * -6}deg`,
    '--lift': isActive ? '0px' : '12px',
    '--scale': isActive ? 1 : 0.9,
    '--opacity': isActive ? 1 : 0.76,
    '--blur': isActive ? '0px' : '.35px',
    '--z': isActive ? 3 : offset < 0 ? 1 : 2,
  }
}

function resetSwipe() {
  swipeStartX.value = null
  swipeX.value = 0
  swipeMax.value = 0
  isSwiping.value = false
  swipeSettled.value = false
}

function watchSwipeDown(event) {
  if (swipeSettled.value) return
  swipeStartX.value = event.clientX
  swipeMax.value = Math.max(0, event.currentTarget.clientWidth - 44)
  isSwiping.value = true
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function watchSwipeMove(event) {
  if (!isSwiping.value || swipeStartX.value === null) return
  swipeX.value = Math.max(0, Math.min(swipeMax.value, event.clientX - swipeStartX.value))
}

function completeWatchSwipe() {
  if (!activeMovie.value || swipeSettled.value) return
  swipeX.value = swipeMax.value
  swipeSettled.value = true
  isSwiping.value = false
  window.setTimeout(() => emit('mark-watched', activeMovie.value.id), 1050)
}

function watchSwipeUp() {
  if (!isSwiping.value) return
  if (swipeX.value >= swipeMax.value * .82) completeWatchSwipe()
  else {
    swipeX.value = 0
    isSwiping.value = false
  }
  swipeStartX.value = null
}

function renderGlow(time = 0) {
  if (!renderer || !scene || !material) return
  material.uniforms.uTime.value = time * 0.0005
  material.uniforms.uPointer.value = dragX.value / 110
  const palette = activeMovie.value?.poster === 'demon' ? [0.95, 0.47, 0.1] : activeMovie.value?.poster === 'coco' ? [0.49, 0.31, 0.83] : [0.18, 0.56, 0.82]
  material.uniforms.uColor.value.setRGB(...palette)
  renderer.render(scene, camera)
  frame = requestAnimationFrame(renderGlow)
}

function setupThree() {
  const canvas = glowCanvas.value
  const container = deck.value
  if (!canvas || !container) return

  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uPointer: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uColor: { value: new THREE.Color(0.95, 0.47, 0.1) },
    },
    vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime;
      uniform float uPointer;
      uniform vec2 uResolution;
      uniform vec3 uColor;
      void main() {
        vec2 uv = gl_FragCoord.xy / uResolution;
        float left = smoothstep(.82, .12, distance(uv, vec2(.12 + sin(uTime) * .04 + uPointer * .05, .52)));
        float right = smoothstep(.77, .10, distance(uv, vec2(.88 + cos(uTime * 1.2) * .03 + uPointer * .05, .4)));
        float aura = max(left, right) * .24;
        gl_FragColor = vec4(uColor * aura, aura);
      }
    `,
  })
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))

  const resize = () => {
    const { width, height } = container.getBoundingClientRect()
    renderer.setSize(width, height, false)
    material.uniforms.uResolution.value.set(width * renderer.getPixelRatio(), height * renderer.getPixelRatio())
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()
  renderGlow()
}

watch(activeIndex, () => nextTick())
watch(() => props.movies, () => { activeIndex.value = 0; resetSwipe() })
onMounted(setupThree)
onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resizeObserver?.disconnect()
  material?.dispose()
  renderer?.dispose()
})
</script>

<template>
  <section class="album" aria-label="电影相册">
    <div
      ref="deck"
      class="deck"
      :class="{ dragging: isDragging }"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
    >
      <canvas ref="glowCanvas" class="three-glow" aria-hidden="true"></canvas>

      <div v-if="!movies.length" class="empty-deck">
        <Check :size="21" stroke-width="2.5" />
        <h3>待看的都完成了</h3>
        <p>切到“已观看”继续浏览。</p>
      </div>

      <article
        v-for="movie in cardMovies"
        :key="movie.id"
        class="album-card"
        :class="[`album-card--${movie.poster}`, { 'settle-pop': movie.offset === 0 && settlePulse }]"
        :style="cardStyle(movie.offset)"
        :role="movie.offset === 0 ? 'button' : undefined"
        :aria-label="movie.offset === 0 ? `查看 ${movie.title} 详情` : undefined"
        :tabindex="movie.offset === 0 ? 0 : -1"
        @click="openCard(movie, movie.offset)"
        @keydown.enter.prevent="openCard(movie, movie.offset)"
        @keydown.space.prevent="openCard(movie, movie.offset)"
      >
        <div class="poster-image" :style="posterStyle(movie)"></div>
        <div v-if="movie.offset === 0" class="album-info">
          <p>{{ movie.meta }} · {{ movie.year }}</p>
          <h2>{{ movie.title }}</h2>
          <div class="album-bottom">
            <div class="movie-status">
              <span class="rating" :class="{ unrated: movie.rating === null }"><Star :size="13" :fill="movie.rating === null ? 'none' : 'currentColor'" />{{ movie.rating ?? '未评分' }}</span>
              <span class="watched" :class="{ pending: !movie.watched }"><Check :size="11" stroke-width="3" />{{ movie.watched ? '已观看' : '未观看' }}</span>
            </div>
            <button v-if="movie.watched" class="detail-button" aria-label="查看电影详情" @click.stop="emit('open-detail', movie)"><span>查看详情</span><i><ChevronRight :size="21" /></i></button>
            <div
              v-else
              class="watch-slider"
              :class="{ swiping: isSwiping, settled: swipeSettled }"
              :style="{ '--swipe-x': `${swipeX}px` }"
              role="slider"
              tabindex="0"
              aria-label="向右滑动标记为已观看"
              @pointerdown.stop="watchSwipeDown"
              @pointermove.stop="watchSwipeMove"
              @pointerup.stop="watchSwipeUp"
              @pointercancel.stop="watchSwipeUp"
              @keydown.right.prevent="completeWatchSwipe"
            >
              <span>{{ swipeSettled ? '完成！' : '向右滑动设为已观看' }}</span>
              <i class="watch-slider__handle">
                <svg v-if="swipeSettled" class="watch-success-svg" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="12"></circle>
                  <path d="M10.5 16.4 14.3 20 22 12.4"></path>
                </svg>
                <ChevronRight v-else :size="20" />
              </i>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="deck-footer">
      <div class="dots" aria-label="当前电影位置"><i v-for="(_, index) in movies" :key="index" :class="{ active: index === activeIndex }"></i></div>
    </div>
  </section>
</template>

<style lang="scss" scoped>
.album { margin: 0; }
.deck { position: relative; height: 374px; margin: 0 15px; overflow: hidden; border-radius: 30px; touch-action: pan-y; user-select: none; perspective: 1250px; }
.three-glow { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: .7; }
.album-card { position: absolute; z-index: var(--z); bottom: 0; left: 50%; width: min(69vw, 302px); height: 358px; overflow: hidden; color: #fff; border: 1px solid rgba(255,255,255,.38); border-radius: 27px; box-shadow: 0 19px 30px rgba(9, 10, 14, .19); opacity: var(--opacity); transform-origin: center bottom; transform: translateX(calc(-50% + var(--x))) translateY(var(--lift)) rotateZ(var(--tilt)) rotateY(calc(var(--rotate) * -.45)) scale(var(--scale)); filter: blur(var(--blur)); transition: transform 820ms cubic-bezier(.16, 1, .3, 1), opacity 620ms ease, filter 620ms ease; will-change: transform; backface-visibility: hidden; animation: card-rise .82s cubic-bezier(.16, 1,.3, 1) both; }
.album-card[role='button'] { cursor: pointer; }
.album-card[role='button']:focus-visible { outline: 2px solid #fff; outline-offset: -5px; }
.dragging .album-card { transition: none; }
.album-card.settle-pop { animation: settle-pop .62s cubic-bezier(.16,1,.3,1) both; }
.poster-image { position: absolute; inset: 0; background-size: 129% auto; background-position: center 35%; background-repeat: no-repeat; }
.poster-image::after { content: ''; position: absolute; inset: 24% 0 0; background: linear-gradient(180deg, transparent 0%, rgba(7, 9, 12, .05) 25%, rgba(7, 9, 12, .72) 70%, rgba(7, 9, 12, .92) 100%); }
.album-card--pop .poster-image { background-image: radial-gradient(circle at 60% 20%, #ffcc74 0 7%, transparent 8%), linear-gradient(155deg, #4bb5cd, #1c4e80 50%, #061425); }
.album-card--crayon .poster-image { background-image: radial-gradient(circle at 25% 20%, #ffde68 0 11%, transparent 12%), linear-gradient(155deg, #61c1de, #eca55c 51%, #b33730); }
.album-card--coco .poster-image { background-image: radial-gradient(circle at 63% 19%, #ffda6b 0 10%, transparent 11%), linear-gradient(150deg, #3a61ad, #8b4074 56%, #f29b53); }
.album-info { position: absolute; z-index: 2; right: 0; bottom: 0; left: 0; padding: 50px 13px 12px; background: linear-gradient(180deg, transparent, rgba(7,9,12,.82) 46%, rgba(7,9,12,.94)); }
.album-info p { margin: 0; color: rgba(255,255,255,.82); font-size: 10px; font-weight: 600; }
.album-info h2 { max-width: 92%; margin: 3px 0 0; font-size: 18px; line-height: 1.18; letter-spacing: -.055em; }
.album-bottom { margin-top: 6px; font-size: 10px; font-weight: 700; }
.movie-status { display: flex; align-items: center; gap: 12px; padding-left: 1px; }
.rating, .watched { display: inline-flex; align-items: center; gap: 4px; }
.rating { color: #fff; }
.rating svg { color: #ffd451; }
.watched { color: rgba(255,255,255,.85); }
.watched svg { box-sizing: content-box; padding: 2px; color: #131417; border-radius: 50%; background: #fff; }
.rating.unrated { color: rgba(255,255,255,.64); }
.watched.pending { color: #ffd86a; }
.watched.pending svg { color: #191a1d; background: #ffd86a; }
.detail-button { display: flex; align-items: center; justify-content: space-between; width: 100%; height: 40px; margin-top: 8px; padding: 4px 5px 4px 16px; color: #fff; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(24,25,27,.82); box-shadow: 0 8px 16px rgba(0,0,0,.18); backdrop-filter: blur(14px); font-size: 11px; font-weight: 500; }
.detail-button i { display: grid; place-items: center; width: 32px; height: 32px; color: #151619; border-radius: 50%; background: #fff; font-style: normal; transition: transform .25s cubic-bezier(.16,1,.3,1); }
.detail-button:hover i { transform: translateX(2px); }
.watch-slider { --swipe-x: 0px; position: relative; height: 40px; margin-top: 8px; overflow: hidden; color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.13); border-radius: 999px; background: rgba(24,25,27,.84); box-shadow: 0 8px 16px rgba(0,0,0,.18); touch-action: none; cursor: ew-resize; }
.watch-slider::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: calc(var(--swipe-x) + 40px); background: rgba(104,212,156,.18); transition: width .38s cubic-bezier(.16,1,.3,1); }
.watch-slider.swiping::before { transition: width 70ms linear; }
.watch-slider > span { position: absolute; inset: 0; display: grid; place-items: center; padding-left: 30px; font-size: 10px; font-weight: 650; letter-spacing: .01em; transition: color .25s ease; }
.watch-slider__handle { position: absolute; top: 3px; left: 3px; display: grid; place-items: center; width: 32px; height: 32px; color: #151619; border-radius: 50%; background: #fff; box-shadow: 0 4px 11px rgba(0,0,0,.24); font-style: normal; transform: translateX(var(--swipe-x)); transition: transform .46s cubic-bezier(.16,1,.3,1), background .3s ease; }
.watch-slider.swiping .watch-slider__handle { transition: transform 70ms linear, background .3s ease; }
.watch-slider.settled { color: #fff; border-color: rgba(131,221,176,.4); background: rgba(25,76,53,.88); box-shadow: 0 0 0 1px rgba(131,221,176,.12), 0 0 22px rgba(104,212,156,.26); }
.watch-slider.settled::before { width: 100%; background: rgba(104,212,156,.22); }
.watch-slider.settled .watch-slider__handle { color: #0f3a28; background: #83ddb0; animation: success-handle .78s cubic-bezier(.16,1,.3,1) both; }
.watch-success-svg { width: 28px; height: 28px; overflow: visible; }
.watch-success-svg circle, .watch-success-svg path { fill: none; stroke: #123e2b; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.4; }
.watch-success-svg circle { stroke-dasharray: 76; stroke-dashoffset: 76; animation: success-ring .5s ease-out .08s forwards; }
.watch-success-svg path { stroke-dasharray: 18; stroke-dashoffset: 18; animation: success-check .36s ease-out .42s forwards; }
.empty-deck { position: absolute; z-index: 2; inset: 18px; display: grid; place-content: center; justify-items: center; gap: 6px; color: #3e4045; border: 1px dashed rgba(27,28,31,.12); border-radius: 27px; background: rgba(255,255,255,.72); text-align: center; backdrop-filter: blur(14px); }
.empty-deck svg { box-sizing: content-box; padding: 9px; color: #1f5f42; border-radius: 50%; background: #dff4e8; }
.empty-deck h3 { margin: 4px 0 0; font-size: 15px; }
.empty-deck p { margin: 0; color: #95969b; font-size: 10px; }
.deck-footer { display: flex; align-items: center; justify-content: center; min-height: 39px; }
.dots { display: flex; gap: 7px; align-items: center; }
.dots i { display: block; width: 7px; height: 7px; border-radius: 100px; background: #d7d8db; transition: all .35s ease; }
.dots i.active { width: 19px; background: #17181b; }
@keyframes card-rise { from { opacity: 0; transform: translateX(calc(-50% + var(--x))) translateY(38px) rotateZ(var(--tilt)) rotateY(calc(var(--rotate) * -.45)) scale(calc(var(--scale) * .95)); } }
@keyframes settle-pop { 0% { transform: translateX(calc(-50% + var(--x))) translateY(8px) rotateZ(var(--tilt)) scale(.96); } 68% { transform: translateX(calc(-50% + var(--x))) translateY(-3px) rotateZ(var(--tilt)) scale(1.035); } 100% { transform: translateX(calc(-50% + var(--x))) translateY(var(--lift)) rotateZ(var(--tilt)) scale(var(--scale)); } }
@keyframes success-handle { 0% { transform: translateX(var(--swipe-x)) scale(.84); box-shadow: 0 0 0 0 rgba(131,221,176,.65); } 55% { transform: translateX(var(--swipe-x)) scale(1.16); box-shadow: 0 0 0 9px rgba(131,221,176,0); } 100% { transform: translateX(var(--swipe-x)) scale(1); box-shadow: 0 4px 11px rgba(0,0,0,.18); } }
@keyframes success-ring { to { stroke-dashoffset: 0; } }
@keyframes success-check { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .album-card, .dots i { transition: none; } }
@media (max-height: 760px) {
  .deck { height: 318px; }
  .album-card { height: 304px; }
  .album-info { padding-top: 44px; }
  .deck-footer { min-height: 30px; }
}
</style>
