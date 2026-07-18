<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, GripVertical, Plus, X } from 'lucide-vue-next'
import type { Category } from '../types'

const props = defineProps<{ categories: Category[]; motionIntensity?: 'high' | 'medium' | 'low' }>()

const emit = defineEmits(['update:categories', 'saved'])

const activeId = ref(props.categories[0]?.id || '')
const newParentName = ref('')
const newTagName = ref('')
type DragKind = 'parent' | 'child'
type DragState = { type: DragKind; id: string; pointerId: number; startX: number; startY: number; element: HTMLElement }
type PendingHold = { startX: number; startY: number; pointerType: string; element: HTMLElement }

const dragState = ref<DragState | null>(null)
const selectedChildId = ref('')
const addOpen = ref(false)
const parentAddInput = ref(null)
const childViewport = ref<HTMLElement | null>(null)
const page = ref(1)
const pageSize = 10
let holdTimer: number | undefined
let pendingHold: PendingHold | null = null
let lastReorderAt = 0
let dragChanged = false
let childResizeTimer: number | undefined

const activeCategory = computed(() => props.categories.find((category) => category.id === activeId.value))
const pageCount = computed(() => Math.max(1, Math.ceil((activeCategory.value?.children.length || 0) / pageSize)))
const paginatedChildren = computed(() => activeCategory.value?.children.slice((page.value - 1) * pageSize, page.value * pageSize) || [])

function cloneCategories() {
  return props.categories.map((category) => ({
    ...category,
    children: category.children.map((child) => ({ ...child })),
  }))
}

function commitCategories(categories, message = '分类顺序已自动保存') {
  emit('update:categories', categories)
  emit('saved', message)
}

async function animateChildChange(change: () => void) {
  const viewport = childViewport.value
  const oldHeight = viewport?.getBoundingClientRect().height || 0
  change()
  await nextTick()
  if (!viewport) return
  const nextList = [...viewport.children].find((element) => !element.classList.contains('category-page-leave-active')) as HTMLElement | undefined
  const nextHeight = nextList?.getBoundingClientRect().height || 0
  if (!oldHeight || !nextHeight || Math.abs(oldHeight - nextHeight) < 1) return
  window.clearTimeout(childResizeTimer)
  viewport.style.height = `${oldHeight}px`
  void viewport.offsetHeight
  viewport.style.height = `${nextHeight}px`
  const duration = props.motionIntensity === 'high' ? 560 : props.motionIntensity === 'medium' ? 380 : 220
  childResizeTimer = window.setTimeout(() => { viewport.style.height = '' }, duration)
}

function setActive(id) {
  if (!dragState.value && activeId.value !== id) {
    void animateChildChange(() => {
      activeId.value = id
      selectedChildId.value = ''
      addOpen.value = false
      page.value = 1
    })
  }
}

async function toggleAdd() {
  addOpen.value = !addOpen.value
  if (addOpen.value) {
    await nextTick()
    parentAddInput.value?.focus()
  }
}

function selectChild(id) {
  if (!dragState.value) selectedChildId.value = id
}

function addParentCategory() {
  const label = newParentName.value.trim()
  if (!label || props.categories.some((category) => category.label === label)) return
  const categories = cloneCategories()
  const parentId = `custom-group-${Date.now()}`
  categories.push({ id: parentId, label, source: 'custom', children: [] })
  activeId.value = parentId
  newParentName.value = ''
  selectedChildId.value = ''
  page.value = 1
  addOpen.value = false
  commitCategories(categories, '大分类已添加并自动保存')
}

function addTag() {
  const label = newTagName.value.trim()
  if (!label || !activeId.value) return
  const categories = cloneCategories()
  const active = categories.find((category) => category.id === activeId.value)
  if (!active || active.children.some((child) => child.label === label)) return
  const childId = `custom-${Date.now()}`
  active.children.push({ id: childId, label, source: 'custom' })
  newTagName.value = ''
  selectedChildId.value = childId
  page.value = Math.max(1, Math.ceil(active.children.length / pageSize))
  commitCategories(categories, '标签已添加并自动保存')
}

function removeCategory(childId) {
  const categories = cloneCategories()
  const active = categories.find((category) => category.id === activeId.value)
  if (!active) return
  active.children = active.children.filter((child) => child.id !== childId)
  if (selectedChildId.value === childId) selectedChildId.value = ''
  page.value = Math.min(page.value, Math.max(1, Math.ceil(active.children.length / pageSize)))
  commitCategories(categories, '标签已删除并自动保存')
}

function moveChild(childId: string, direction: number) {
  const categories = cloneCategories()
  const active = categories.find((category) => category.id === activeId.value)
  const from = active?.children.findIndex((child) => child.id === childId) ?? -1
  const to = from + direction
  if (!active || from < 0 || to < 0 || to >= active.children.length) return
  const [moved] = active.children.splice(from, 1)
  active.children.splice(to, 0, moved)
  page.value = Math.floor(to / pageSize) + 1
  selectedChildId.value = childId
  commitCategories(categories)
}

function changePage(nextPage) {
  const targetPage = Math.min(pageCount.value, Math.max(1, nextPage))
  if (targetPage === page.value) return
  void animateChildChange(() => {
    page.value = targetPage
    selectedChildId.value = ''
  })
}

function startHold(event: PointerEvent, type: DragKind, id: string) {
  if (event.button != null && event.button !== 0) return
  const element = event.currentTarget as HTMLElement
  clearTimeout(holdTimer)
  const pointerId = event.pointerId
  const startX = event.clientX
  const startY = event.clientY
  pendingHold = { startX, startY, pointerType: event.pointerType, element }
  element.setPointerCapture?.(pointerId)
  holdTimer = window.setTimeout(() => {
    if (!pendingHold) return
    dragState.value = { type, id, pointerId, startX, startY, element }
    dragChanged = false
    document.body.classList.add('category-drag-active')
    if (navigator.vibrate) navigator.vibrate(18)
  }, event.pointerType === 'touch' ? 300 : 350)
}

function moveHold(event: PointerEvent) {
  const drag = dragState.value
  if (!drag) return
  event.preventDefault()
  const scrollHost = drag.element.closest('.personal-settings') as HTMLElement | null
  if (scrollHost) {
    const rect = scrollHost.getBoundingClientRect()
    const edge = Math.min(92, rect.height * .18)
    if (event.clientY < rect.top + edge) scrollHost.scrollBy({ top: -12, behavior: 'auto' })
    else if (event.clientY > rect.bottom - edge) scrollHost.scrollBy({ top: 12, behavior: 'auto' })
  }
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(`[data-drag-type="${drag.type}"]`) as HTMLElement | null
  const targetId = target?.dataset.dragId
  if (!targetId || targetId === drag.id) return
  const reorderInterval = props.motionIntensity === 'high' ? 190 : props.motionIntensity === 'medium' ? 125 : 70
  if (performance.now() - lastReorderAt < reorderInterval) return
  lastReorderAt = performance.now()

  const categories = cloneCategories()
  if (drag.type === 'parent') {
    const from = categories.findIndex((category) => category.id === drag.id)
    const to = categories.findIndex((category) => category.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = categories.splice(from, 1)
    categories.splice(to, 0, moved)
  } else {
    const active = categories.find((category) => category.id === activeId.value)
    const from = active?.children.findIndex((child) => child.id === drag.id) ?? -1
    const to = active?.children.findIndex((child) => child.id === targetId) ?? -1
    if (from < 0 || to < 0) return
    const [moved] = active.children.splice(from, 1)
    active.children.splice(to, 0, moved)
  }
  emit('update:categories', categories)
  dragChanged = true
}

function endHold(event?: PointerEvent) {
  clearTimeout(holdTimer)
  const shouldNotify = Boolean(dragState.value && dragChanged)
  const element = dragState.value?.element || pendingHold?.element
  if (element && event?.pointerId != null && element.hasPointerCapture?.(event.pointerId)) {
    element.releasePointerCapture(event.pointerId)
  }
  pendingHold = null
  dragState.value = null
  dragChanged = false
  document.body.classList.remove('category-drag-active')
  if (shouldNotify) emit('saved', '分类顺序已自动保存')
}

function cancelHold(event: PointerEvent) {
  if (!dragState.value && pendingHold) {
    const distance = Math.hypot(event.clientX - pendingHold.startX, event.clientY - pendingHold.startY)
    const tolerance = pendingHold.pointerType === 'touch' ? 18 : 8
    if (distance <= tolerance) return
    clearTimeout(holdTimer)
    pendingHold = null
  }
}

onBeforeUnmount(() => {
  clearTimeout(holdTimer)
  clearTimeout(childResizeTimer)
  document.body.classList.remove('category-drag-active')
})
</script>

<template>
  <div class="category-manager settings-piece" :class="[`motion-${motionIntensity || 'medium'}`, { 'is-dragging': dragState }]" style="--settings-order: 1" @pointermove="moveHold" @pointerup="endHold" @pointercancel="endHold">
    <div class="category-manager-intro">
      <strong>内容分类</strong>
      <span>点按切换，长按后拖动调整显示顺序</span>
    </div>

    <div class="category-parent-bar">
      <TransitionGroup name="category-order" tag="div" class="category-parent-list" role="tablist" aria-label="大分类">
        <button
          v-for="(category, index) in categories"
          :key="category.id"
          :style="{ '--move-delay-high': `${index * 54}ms`, '--move-delay-medium': `${index * 30}ms` }"
          :data-drag-id="category.id"
          data-drag-type="parent"
          :class="{ selected: activeId === category.id, dragging: dragState?.type === 'parent' && dragState?.id === category.id }"
          role="tab"
          :aria-selected="activeId === category.id"
          @click="setActive(category.id)"
          @pointerdown="startHold($event, 'parent', category.id)"
          @pointermove="cancelHold"
          @contextmenu.prevent
        >
          <GripVertical :size="13" />
          <span>{{ category.label }}</span>
        </button>
      </TransitionGroup>
      <button class="category-add-toggle" :class="{ open: addOpen }" type="button" aria-label="添加分类" :aria-expanded="addOpen" @click="toggleAdd"><Plus :size="18" /></button>
    </div>

    <Transition name="category-add">
      <form v-if="addOpen" class="category-parent-add-form" @submit.prevent="addParentCategory">
        <input ref="parentAddInput" v-model="newParentName" maxlength="12" placeholder="添加大分类，例如：纪录片" aria-label="大分类名称" />
        <button type="submit" :disabled="!newParentName.trim()"><Plus :size="16" />添加大分类</button>
      </form>
    </Transition>

    <section v-if="activeCategory" class="category-child-section">
      <header>
        <div><strong>{{ activeCategory.label }}分类</strong><span>{{ activeCategory.children.length }} 个</span></div>
        <small>长按任意分类拖动</small>
      </header>
      <div ref="childViewport" class="category-child-viewport">
        <Transition name="category-page">
          <TransitionGroup :key="`${activeCategory.id}-${page}`" name="category-order" tag="div" class="category-child-list">
            <div
              v-for="(child, index) in paginatedChildren"
              :key="child.id"
              :style="{ '--move-delay-high': `${index * 54}ms`, '--move-delay-medium': `${index * 30}ms`, '--category-row': index }"
              :data-drag-id="child.id"
              data-drag-type="child"
              :class="{ selected: selectedChildId === child.id, dragging: dragState?.type === 'child' && dragState?.id === child.id }"
              @click="selectChild(child.id)"
              @pointerdown="startHold($event, 'child', child.id)"
              @pointermove="cancelHold"
              @contextmenu.prevent
            >
              <span class="category-child-rank">{{ String((page - 1) * pageSize + index + 1).padStart(2, '0') }}</span>
              <i class="category-child-grip"><GripVertical :size="16" /></i>
              <div class="category-child-copy">
                <strong>{{ child.label }}</strong>
                <small>{{ child.source === 'data' ? '来自影片数据' : child.source === 'custom' ? '自定义' : '默认' }}</small>
              </div>
              <nav class="category-row-actions" :aria-label="`${child.label}排序操作`">
                <button type="button" :disabled="activeCategory.children.findIndex((item) => item.id === child.id) === 0" :aria-label="`${child.label}上移`" @pointerdown.stop @click.stop="moveChild(child.id, -1)"><ChevronUp :size="13" /></button>
                <button type="button" :disabled="activeCategory.children.findIndex((item) => item.id === child.id) === activeCategory.children.length - 1" :aria-label="`${child.label}下移`" @pointerdown.stop @click.stop="moveChild(child.id, 1)"><ChevronDown :size="13" /></button>
                <button v-if="child.source === 'custom'" type="button" :aria-label="`删除${child.label}`" @pointerdown.stop @click.stop="removeCategory(child.id)"><X :size="13" /></button>
              </nav>
            </div>
          </TransitionGroup>
        </Transition>
      </div>

      <nav class="category-pagination" :aria-label="`${activeCategory.label}分类分页`">
        <button type="button" aria-label="上一页" :disabled="page <= 1" @click="changePage(page - 1)"><ChevronLeft :size="15" /></button>
        <span><strong>{{ page }}</strong><small>/ {{ pageCount }}</small></span>
        <em>每页 {{ pageSize }} 个</em>
        <button type="button" aria-label="下一页" :disabled="page >= pageCount" @click="changePage(page + 1)"><ChevronRight :size="15" /></button>
      </nav>

      <form class="category-tag-add-form" @submit.prevent="addTag">
        <input v-model="newTagName" maxlength="12" :placeholder="`添加${activeCategory.label}标签`" aria-label="标签名称" />
        <button type="submit" :disabled="!newTagName.trim()"><Plus :size="15" />添加标签</button>
      </form>
    </section>
  </div>
</template>
