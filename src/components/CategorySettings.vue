<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { GripVertical, Plus, X } from 'lucide-vue-next'

const props = defineProps({
  categories: { type: Array, required: true },
})

const emit = defineEmits(['update:categories'])

const activeId = ref(props.categories[0]?.id || '')
const newCategoryName = ref('')
const dragState = ref(null)
const selectedChildId = ref('')
const addOpen = ref(false)
const addInput = ref(null)
let holdTimer
let pendingHold

function cloneCategories() {
  return props.categories.map((category) => ({
    ...category,
    children: category.children.map((child) => ({ ...child })),
  }))
}

function setActive(id) {
  if (!dragState.value) {
    activeId.value = id
    selectedChildId.value = ''
    addOpen.value = false
  }
}

async function toggleAdd() {
  addOpen.value = !addOpen.value
  if (addOpen.value) {
    await nextTick()
    addInput.value?.focus()
  }
}

function selectChild(id) {
  if (!dragState.value) selectedChildId.value = id
}

function addCategory() {
  const label = newCategoryName.value.trim()
  if (!label || !activeId.value) return
  const categories = cloneCategories()
  const active = categories.find((category) => category.id === activeId.value)
  if (!active || active.children.some((child) => child.label === label)) return
  const childId = `custom-${Date.now()}`
  active.children.push({ id: childId, label, source: 'custom' })
  newCategoryName.value = ''
  selectedChildId.value = childId
  addOpen.value = false
  emit('update:categories', categories)
}

function removeCategory(childId) {
  const categories = cloneCategories()
  const active = categories.find((category) => category.id === activeId.value)
  if (!active) return
  active.children = active.children.filter((child) => child.id !== childId)
  if (selectedChildId.value === childId) selectedChildId.value = ''
  emit('update:categories', categories)
}

function startHold(event, type, id) {
  if (event.button != null && event.button !== 0) return
  clearTimeout(holdTimer)
  const pointerId = event.pointerId
  const startX = event.clientX
  const startY = event.clientY
  pendingHold = { startX, startY }
  holdTimer = window.setTimeout(() => {
    dragState.value = { type, id, pointerId, startX, startY }
    event.currentTarget?.setPointerCapture?.(pointerId)
    if (navigator.vibrate) navigator.vibrate(18)
  }, 350)
}

function moveHold(event) {
  const drag = dragState.value
  if (!drag) return
  event.preventDefault()
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(`[data-drag-type="${drag.type}"]`)
  const targetId = target?.dataset.dragId
  if (!targetId || targetId === drag.id) return

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
}

function endHold() {
  clearTimeout(holdTimer)
  pendingHold = null
  dragState.value = null
}

function cancelHold(event) {
  if (!dragState.value && pendingHold && Math.hypot(event.clientX - pendingHold.startX, event.clientY - pendingHold.startY) > 8) {
    clearTimeout(holdTimer)
    pendingHold = null
  }
}

onBeforeUnmount(() => clearTimeout(holdTimer))
</script>

<template>
  <div class="category-manager settings-piece" style="--settings-order: 1" @pointermove="moveHold" @pointerup="endHold" @pointercancel="endHold">
    <div class="category-manager-intro">
      <strong>内容分类</strong>
      <span>点按切换，长按后拖动调整显示顺序</span>
    </div>

    <div class="category-parent-bar">
      <div class="category-parent-list" role="tablist" aria-label="大分类">
        <button
          v-for="category in categories"
          :key="category.id"
          :data-drag-id="category.id"
          data-drag-type="parent"
          :class="{ selected: activeId === category.id, dragging: dragState?.type === 'parent' && dragState?.id === category.id }"
          role="tab"
          :aria-selected="activeId === category.id"
          @click="setActive(category.id)"
          @pointerdown="startHold($event, 'parent', category.id)"
          @pointermove="cancelHold"
          @pointerleave="!dragState && endHold()"
        >
          <GripVertical :size="13" />
          <span>{{ category.label }}</span>
        </button>
      </div>
      <button class="category-add-toggle" :class="{ open: addOpen }" type="button" aria-label="添加分类" :aria-expanded="addOpen" @click="toggleAdd"><Plus :size="18" /></button>
    </div>

    <section v-for="category in categories" v-show="activeId === category.id" :key="category.id" class="category-child-section">
      <header>
        <div><strong>{{ category.label }}分类</strong><span>{{ category.children.length }} 个</span></div>
        <small>长按任意分类拖动</small>
      </header>
      <div class="category-child-list">
        <div
          v-for="child in category.children"
          :key="child.id"
          :data-drag-id="child.id"
          data-drag-type="child"
          :class="{ selected: selectedChildId === child.id, dragging: dragState?.type === 'child' && dragState?.id === child.id }"
          @click="selectChild(child.id)"
          @pointerdown="startHold($event, 'child', child.id)"
          @pointermove="cancelHold"
          @pointerleave="!dragState && endHold()"
        >
          <GripVertical :size="16" />
          <span>{{ child.label }}</span>
          <small>{{ child.source === 'data' ? '来自影片数据' : child.source === 'custom' ? '自定义' : '默认' }}</small>
          <button v-if="child.source === 'custom'" :aria-label="`删除${child.label}`" @pointerdown.stop @click.stop="removeCategory(child.id)"><X :size="14" /></button>
        </div>
      </div>
    </section>

    <Transition name="category-add">
      <form v-if="addOpen" class="category-add-form" @submit.prevent="addCategory">
        <input ref="addInput" v-model="newCategoryName" maxlength="12" :placeholder="`添加${categories.find((item) => item.id === activeId)?.label || ''}分类`" aria-label="自定义分类名称" />
        <button type="submit" :disabled="!newCategoryName.trim()"><Plus :size="16" />添加</button>
      </form>
    </Transition>
  </div>
</template>
