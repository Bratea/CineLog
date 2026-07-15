<script setup>
import { AnimatePresence, Motion } from 'motion-v'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  texts: { type: Array, default: () => [] },
  transition: { type: Object, default: () => ({ type: 'spring', damping: 28, stiffness: 360 }) },
  initial: { type: Object, default: () => ({ y: '100%', opacity: 0 }) },
  animate: { type: Object, default: () => ({ y: 0, opacity: 1 }) },
  exit: { type: Object, default: () => ({ y: '-120%', opacity: 0 }) },
  animatePresenceMode: { type: String, default: 'wait' },
  animatePresenceInitial: { type: Boolean, default: false },
  rotationInterval: { type: Number, default: 2000 },
  staggerDuration: { type: Number, default: 0 },
  staggerFrom: { type: [String, Number], default: 'first' },
  loop: { type: Boolean, default: true },
  auto: { type: Boolean, default: true },
  splitBy: { type: String, default: 'characters' },
  onNext: { type: Function, default: undefined },
  mainClassName: { type: String, default: '' },
  splitLevelClassName: { type: String, default: '' },
  elementLevelClassName: { type: String, default: '' },
})

const currentTextIndex = ref(0)
const renderKey = ref(0)
let intervalId = null

const currentText = computed(() => props.texts[currentTextIndex.value] || '')

function splitIntoCharacters(text) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(text)].map(({ segment }) => segment)
  }
  return [...text]
}

const elements = computed(() => {
  if (props.splitBy === 'lines') return currentText.value.split('\n').map((line, index, lines) => ({ characters: [line], needsSpace: index !== lines.length - 1 }))
  const words = currentText.value.split(' ')
  return words.map((word, index) => ({
    characters: props.splitBy === 'words' ? [word] : splitIntoCharacters(word),
    needsSpace: index !== words.length - 1,
  }))
})

function getStaggerDelay(index, total) {
  if (props.staggerFrom === 'last') return (total - 1 - index) * props.staggerDuration
  if (props.staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * props.staggerDuration
  if (props.staggerFrom === 'random') return Math.abs(Math.floor(Math.random() * total) - index) * props.staggerDuration
  if (typeof props.staggerFrom === 'number') return Math.abs(props.staggerFrom - index) * props.staggerDuration
  return index * props.staggerDuration
}

function next() {
  if (props.texts.length < 2) return
  const atEnd = currentTextIndex.value === props.texts.length - 1
  const nextIndex = atEnd ? (props.loop ? 0 : currentTextIndex.value) : currentTextIndex.value + 1
  if (nextIndex !== currentTextIndex.value) {
    currentTextIndex.value = nextIndex
    renderKey.value += 1
    props.onNext?.(nextIndex)
  }
}

function cleanupInterval() {
  if (intervalId) clearInterval(intervalId)
  intervalId = null
}

function startInterval() {
  cleanupInterval()
  if (props.auto && props.texts.length > 1) intervalId = setInterval(next, props.rotationInterval)
}

watch(() => props.texts, () => {
  currentTextIndex.value = 0
  renderKey.value += 1
  startInterval()
}, { deep: true })

onMounted(startInterval)
onUnmounted(cleanupInterval)
</script>

<template>
  <Motion tag="span" :class="['rotating-text', mainClassName]" layout>
    <span class="sr-only">{{ currentText }}</span>
    <AnimatePresence :mode="animatePresenceMode" :initial="animatePresenceInitial">
      <Motion :key="renderKey" tag="span" class="rotating-text__line" aria-hidden="true" layout>
        <span v-for="(word, wordIndex) in elements" :key="wordIndex" :class="['rotating-text__word', splitLevelClassName]">
          <Motion
            v-for="(character, characterIndex) in word.characters"
            :key="`${renderKey}-${characterIndex}`"
            tag="span"
            :initial="initial"
            :animate="animate"
            :exit="exit"
            :transition="{
              ...transition,
              delay: getStaggerDelay(
                elements.slice(0, wordIndex).reduce((sum, item) => sum + item.characters.length, 0) + characterIndex,
                elements.reduce((sum, item) => sum + item.characters.length, 0),
              ),
            }"
            :class="['rotating-text__character', elementLevelClassName]"
          >{{ character }}</Motion>
          <span v-if="word.needsSpace">&nbsp;</span>
        </span>
      </Motion>
    </AnimatePresence>
  </Motion>
</template>
