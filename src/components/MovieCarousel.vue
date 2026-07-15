<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { Check, ChevronRight, ChevronUp, Star } from 'lucide-vue-next'
import cinematicAnimeCollage from '../assets/cinematic-anime-collage.png'

const props = defineProps({
  movies: { type: Array, required: true },
  active: { type: Boolean, default: true },
})
const emit = defineEmits(['mark-watched', 'open-detail'])

const activeIndex = ref(0)
const deck = ref(null)
const glowCanvas = ref(null)
const dragStart = ref(null)
const dragX = ref(0)
const dragY = ref(0)
const dragAxis = ref(null)
const isDragging = ref(false)
const isOpeningDetail = ref(false)
const isReturning = ref(false)
const dragVelocityY = ref(0)
const swipeStartX = ref(null)
const swipeX = ref(0)
const swipeMax = ref(0)
const isSwiping = ref(false)
const swipeSettled = ref(false)
const swipeArmed = ref(false)

let openTimer
let returnTimer
let swipeArmTimer
let lastDragY = 0
let lastDragTime = 0

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
const openProgress = computed(() => Math.min(1, Math.max(0, -dragY.value / 112)))

function move(direction) {
  const count = props.movies.length
  if (!count) return
  activeIndex.value = (activeIndex.value + direction + count) % count
}

function pointerDown(event) {
  if (isOpeningDetail.value || event.target.closest('.watch-slider')) return
  window.clearTimeout(returnTimer)
  isReturning.value = false
  dragStart.value = { x: event.clientX, y: event.clientY }
  dragX.value = 0
  dragY.value = 0
  dragVelocityY.value = 0
  dragAxis.value = null
  isDragging.value = true
  lastDragY = event.clientY
  lastDragTime = event.timeStamp || performance.now()
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function pointerMove(event) {
  if (dragStart.value === null) return
  const deltaX = event.clientX - dragStart.value.x
  const deltaY = event.clientY - dragStart.value.y
  const now = event.timeStamp || performance.now()
  const elapsed = Math.max(8, now - lastDragTime)
  const instantVelocityY = (event.clientY - lastDragY) / elapsed
  dragVelocityY.value = dragVelocityY.value * .68 + instantVelocityY * .32
  lastDragY = event.clientY
  lastDragTime = now
  if (!dragAxis.value && Math.hypot(deltaX, deltaY) > 7) {
    if (deltaY < -5 && Math.abs(deltaY) > Math.abs(deltaX) * .7) dragAxis.value = 'vertical'
    else if (Math.abs(deltaX) > Math.abs(deltaY) * 1.15) dragAxis.value = 'horizontal'
  }
  if (dragAxis.value === 'vertical') {
    const upwardDistance = Math.max(0, -deltaY)
    const resistedUpward = upwardDistance <= 92 ? upwardDistance : 92 + (upwardDistance - 92) * .34
    dragY.value = deltaY < 0 ? -Math.min(132, resistedUpward) : Math.min(20, deltaY * .38)
  } else if (dragAxis.value === 'horizontal') {
    dragX.value = Math.max(-110, Math.min(110, deltaX))
  }
}

function pointerUp() {
  if (dragStart.value === null) return
  const shouldOpenDetail = dragAxis.value === 'vertical' && (dragY.value < -58 || (dragY.value < -40 && dragVelocityY.value < -.72))
  if (shouldOpenDetail) {
    beginDetailOpen(activeMovie.value)
  } else if (dragAxis.value === 'horizontal' && Math.abs(dragX.value) > 46) {
    move(dragX.value > 0 ? -1 : 1)
  } else if (dragAxis.value === 'vertical' && dragY.value !== 0) {
    isReturning.value = true
    window.clearTimeout(returnTimer)
    returnTimer = window.setTimeout(() => { isReturning.value = false }, 640)
  }

  dragStart.value = null
  dragX.value = 0
  if (!isOpeningDetail.value) dragY.value = 0
  dragVelocityY.value = 0
  dragAxis.value = null
  isDragging.value = false
}

function beginDetailOpen(movie) {
  if (!movie || isOpeningDetail.value) return
  isOpeningDetail.value = true
  openTimer = window.setTimeout(() => emit('open-detail', movie), 480)
}

function resetOpenState() {
  window.clearTimeout(openTimer)
  window.clearTimeout(returnTimer)
  isOpeningDetail.value = false
  isReturning.value = false
  dragStart.value = null
  dragX.value = 0
  dragY.value = 0
  dragVelocityY.value = 0
  dragAxis.value = null
  isDragging.value = false
}

function posterStyle(movie) {
  // 首页卡片使用竖版海报作为主体；横版背景只在没有海报时兜底。
  const path = movie.posterUrl || movie.poster_path || movie.backdropUrl || movie.backdrop_path
  if (path) {
    const src = path.startsWith('http') ? path : `https://image.tmdb.org/t/p/original${path}`
    return { backgroundImage: `url(${src})` }
  }
  return movie.poster === 'demon' ? { backgroundImage: `url(${cinematicAnimeCollage})` } : {}
}

function cardStyle(offset) {
  const value = visualOffset(offset)
  const isActive = Math.abs(offset) < 0.1
  const progress = isActive ? openProgress.value : 0
  return {
    '--x': `${value * 58}%`,
    '--rotate': `${value * 5}deg`,
    '--tilt': `${value * -6}deg`,
    '--lift': isActive ? `${progress * -50}px` : '12px',
    '--scale': isActive ? 1 + progress * .075 : 0.9,
    '--open-tilt': isActive ? `${progress * -1.6}deg` : '0deg',
    '--open-progress': progress,
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
  swipeArmed.value = false
  window.clearTimeout(swipeArmTimer)
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
  if (!swipeArmed.value) {
    armWatchSwipe()
    return
  }
  swipeArmed.value = false
  window.clearTimeout(swipeArmTimer)
  swipeX.value = swipeMax.value
  swipeSettled.value = true
  isSwiping.value = false
  window.setTimeout(() => emit('mark-watched', activeMovie.value.id), 1050)
}

function armWatchSwipe() {
  swipeArmed.value = true
  isSwiping.value = false
  swipeX.value = swipeMax.value
  window.setTimeout(() => { swipeX.value = 0 }, 180)
  window.clearTimeout(swipeArmTimer)
  swipeArmTimer = window.setTimeout(() => { swipeArmed.value = false }, 2600)
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
watch(() => props.active, (active) => { if (!active) resetOpenState() })
onMounted(setupThree)
onBeforeUnmount(() => {
  window.clearTimeout(openTimer)
  window.clearTimeout(returnTimer)
  window.clearTimeout(swipeArmTimer)
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
      :class="{ dragging: isDragging, returning: isReturning, 'opening-detail': isOpeningDetail }"
      @pointerdown="pointerDown"
      @pointermove="pointerMove"
      @pointerup="pointerUp"
      @pointercancel="pointerUp"
      @dragstart.prevent
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
        :class="[`album-card--${movie.poster}`, { 'active-card': movie.offset === 0 }]"
        :style="cardStyle(movie.offset)"
        :aria-label="movie.offset === 0 ? `向上推动 ${movie.title} 查看详情` : undefined"
      >
        <div class="poster-image" :style="posterStyle(movie)"></div>
        <div v-if="movie.offset === 0" class="album-info">
          <p>{{ movie.meta }} · {{ movie.year }}</p>
          <h2>{{ movie.title }}</h2>
          <div v-if="movie.watched" class="watched-card-footer">
            <span class="card-stars" :aria-label="`评分 ${movie.rating ?? 0} 分`">
              <Star v-for="star in 5" :key="star" :size="13" :class="{ filled: star <= Math.round((movie.rating || 0) / 2) }" :fill="star <= Math.round((movie.rating || 0) / 2) ? 'currentColor' : 'none'" />
            </span>
            <time>{{ movie.watchedDate || movie.releaseDate || movie.release_date || movie.year }}</time>
          </div>
          <div v-else class="album-bottom">
            <div
              class="watch-slider"
              :class="{ swiping: isSwiping, armed: swipeArmed, settled: swipeSettled }"
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
              <span>{{ swipeSettled ? '已加入观看记录' : swipeArmed ? '再次向右滑动确认' : '滑动完成观看' }}</span>
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
        <div v-if="movie.offset === 0" class="pull-detail-hint" aria-hidden="true">
          <ChevronUp :size="13" stroke-width="2.4" />
          <span>向上拖动展开</span>
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
.deck { position: relative; height: 374px; margin: 0 15px; overflow: hidden; border-radius: 30px; touch-action: none; user-select: none; perspective: 1250px; }
.three-glow { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: .7; }
.album-card { position: absolute; z-index: var(--z); bottom: 0; left: 50%; width: min(69vw, 302px); height: 358px; overflow: hidden; color: #fff; border: 1px solid rgba(255,255,255,.38); border-radius: calc(27px - var(--open-progress, 0) * 5px); box-shadow: 0 calc(19px + var(--open-progress, 0) * 12px) 30px rgba(9, 10, 14, calc(.19 + var(--open-progress, 0) * .13)); opacity: var(--opacity); transform-origin: center bottom; transform: translateX(calc(-50% + var(--x))) translateY(var(--lift)) rotateZ(var(--tilt)) rotateX(var(--open-tilt,0deg)) rotateY(calc(var(--rotate) * -.45)) scale(var(--scale)); filter: blur(var(--blur)); transition: transform 820ms cubic-bezier(.16, 1, .3, 1), opacity 620ms ease, filter 620ms ease, border-radius 420ms ease, box-shadow 420ms ease; will-change: transform; backface-visibility: hidden; animation: card-rise .82s cubic-bezier(.16, 1,.3, 1) both; }
.album-card.active-card { cursor: ns-resize; }
.dragging .album-card { transition: none; }
.returning .album-card.active-card { transition:transform .62s cubic-bezier(.2,.86,.24,1.12),border-radius .42s ease,box-shadow .42s ease; }
.opening-detail .album-card:not(.active-card) { opacity: 0 !important; transform: translateX(calc(-50% + var(--x))) translateY(34px) scale(.82); transition: transform .44s cubic-bezier(.3,.7,.25,1), opacity .3s ease; }
.opening-detail .album-card.active-card { z-index: 6; border-radius: 17px; box-shadow: 0 38px 74px rgba(9,10,14,.42); animation:card-open-lift .5s cubic-bezier(.2,.72,.18,1) both; transition:border-radius .48s ease,box-shadow .48s ease; }
.opening-detail .active-card .poster-image { animation:poster-open-lift .5s cubic-bezier(.2,.72,.18,1) both; }
.opening-detail .active-card .album-info { animation:card-info-release .36s ease-out both; }
.opening-detail .three-glow { opacity:.18; transform:scale(1.05); transition:opacity .42s ease,transform .5s cubic-bezier(.2,.72,.18,1); }
.poster-image { position: absolute; inset: 0; overflow: hidden; background-color: #111318; background-size: cover; background-position: center; background-repeat: no-repeat; }
.poster-image::before { content: ''; position: absolute; z-index: 0; inset: 0; background-image: inherit; background-size: contain; background-position: center; background-repeat: no-repeat; }
.poster-image::after { content: ''; position: absolute; z-index: 1; inset: 40% 0 0; background: linear-gradient(180deg, transparent 0%, rgba(7, 9, 12, .04) 28%, rgba(7, 9, 12, .42) 72%, rgba(7, 9, 12, .68) 100%); }
.album-card--pop .poster-image { background-image: radial-gradient(circle at 60% 20%, #ffcc74 0 7%, transparent 8%), linear-gradient(155deg, #4bb5cd, #1c4e80 50%, #061425); }
.album-card--crayon .poster-image { background-image: radial-gradient(circle at 25% 20%, #ffde68 0 11%, transparent 12%), linear-gradient(155deg, #61c1de, #eca55c 51%, #b33730); }
.album-card--coco .poster-image { background-image: radial-gradient(circle at 63% 19%, #ffda6b 0 10%, transparent 11%), linear-gradient(150deg, #3a61ad, #8b4074 56%, #f29b53); }
.album-info { position: absolute; z-index: 2; right: 0; bottom: 0; left: 0; padding: 72px 14px 14px; background: transparent; text-shadow: 0 2px 10px rgba(0,0,0,.72); }
.album-info p { margin: 0; color: rgba(255,255,255,.82); font-size: 10px; font-weight: 600; }
.album-info h2 { max-width: 94%; margin: 4px 0 0; font-size: 19px; line-height: 1.16; letter-spacing: -.055em; }
.pull-detail-hint { position: absolute; z-index: 4; top: 10px; left: 50%; display: flex; align-items: center; gap: 4px; padding: 5px 9px; color: rgba(255,255,255,.72); border: 1px solid rgba(255,255,255,.15); border-radius: 999px; background: rgba(9,11,14,.12); backdrop-filter: blur(9px); font-size: 9px; font-weight: 650; transform: translateX(-50%) translateY(calc(var(--open-progress, 0) * -12px)); opacity: calc(.62 - var(--open-progress, 0) * .62); transition: opacity .2s ease, transform .2s ease; pointer-events: none; }
.pull-detail-hint svg { animation: pull-hint 1.5s ease-in-out infinite; }
.album-bottom { margin-top: 6px; font-size: 10px; font-weight: 700; }
.watched-card-footer { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:9px; }
.card-stars { display:flex; align-items:center; gap:3px; color:rgba(255,255,255,.3); }
.card-stars svg { stroke-width:1.8; }
.card-stars svg.filled { color:#ffd451; }
.watched-card-footer time { color:rgba(255,255,255,.66); font-size:9px; font-weight:700; }
.watch-slider { --swipe-x: 0px; position: relative; height: 42px; margin-top: 8px; overflow: hidden; color: rgba(255,255,255,.68); border: 1px solid rgba(255,255,255,.17); border-radius: 999px; background: linear-gradient(145deg,rgba(255,255,255,.09),rgba(13,16,19,.48)); box-shadow: inset 0 1px 0 rgba(255,255,255,.1),0 9px 20px rgba(0,0,0,.2); backdrop-filter:blur(16px) saturate(1.25); touch-action: none; cursor: ew-resize; }
.watch-slider::before { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: calc(var(--swipe-x) + 42px); background: linear-gradient(90deg,rgba(91,190,136,.28),rgba(91,190,136,.08)); transition: width .38s cubic-bezier(.16,1,.3,1); }
.watch-slider.swiping::before { transition: width 70ms linear; }
.watch-slider > span { position: absolute; inset: 0; display: grid; place-items: center; padding-left: 36px; font-size: 9px; font-weight: 720; letter-spacing:.04em; transition: color .25s ease; }
.watch-slider__handle { position: absolute; top: 3px; left: 3px; display: grid; place-items: center; width: 34px; height: 34px; color: #162019; border-radius: 50%; background: linear-gradient(145deg,#fff,#dfe9e3); box-shadow: 0 5px 13px rgba(0,0,0,.28),inset 0 1px 0 #fff; font-style: normal; transform: translateX(var(--swipe-x)); transition: transform .46s cubic-bezier(.16,1,.3,1), background .3s ease; }
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
@keyframes card-open-lift { 0% { transform:translateX(calc(-50% + var(--x))) translateY(var(--lift)) rotateZ(var(--tilt)) rotateX(var(--open-tilt,0deg)) scale(var(--scale)); } 68% { transform:translateX(calc(-50% + var(--x))) translateY(-82px) rotateZ(0) rotateX(-.35deg) scale(1.145); } 100% { transform:translateX(calc(-50% + var(--x))) translateY(-74px) rotateZ(0) rotateX(0) scale(1.13); } }
@keyframes poster-open-lift { 0% { transform:scale(1); filter:saturate(1); } 100% { transform:scale(1.045); filter:saturate(1.08); } }
@keyframes card-info-release { 0% { opacity:1; transform:none; } 100% { opacity:.28; transform:translateY(12px); } }
@keyframes success-handle { 0% { transform: translateX(var(--swipe-x)) scale(.84); box-shadow: 0 0 0 0 rgba(131,221,176,.65); } 55% { transform: translateX(var(--swipe-x)) scale(1.16); box-shadow: 0 0 0 9px rgba(131,221,176,0); } 100% { transform: translateX(var(--swipe-x)) scale(1); box-shadow: 0 4px 11px rgba(0,0,0,.18); } }
@keyframes success-ring { to { stroke-dashoffset: 0; } }
@keyframes success-check { to { stroke-dashoffset: 0; } }
@keyframes pull-hint { 0%,100% { transform: translateY(2px); } 50% { transform: translateY(-2px); } }
@media (prefers-reduced-motion: reduce) { .album-card, .dots i { transition: none; } }
@media (max-height: 760px) {
  .deck { height: 318px; }
  .album-card { height: 304px; }
  .album-info { padding-top: 44px; }
  .deck-footer { min-height: 30px; }
}
</style>
.watch-slider.armed { color:#ffe8a7; border-color:rgba(255,210,105,.36); background:rgba(66,51,23,.64); box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 20px rgba(255,195,67,.12); }
.watch-slider.armed::before { background:linear-gradient(90deg,rgba(255,198,73,.3),rgba(255,198,73,.06)); }
.watch-slider.armed .watch-slider__handle { color:#4b3510; background:linear-gradient(145deg,#ffe9a8,#edbd50); }
