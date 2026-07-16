<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  open: { type: Boolean, default: false },
  title: { type: String, default: '选择观看日期' },
})
const emit = defineEmits(['update:modelValue', 'update:open'])
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const monthTitle = computed(() => `${viewYear.value}年${String(viewMonth.value + 1).padStart(2, '0')}月`)
const days = computed(() => {
  const start = new Date(viewYear.value, viewMonth.value, 1)
  const gridStart = new Date(viewYear.value, viewMonth.value, 1 - start.getDay())
  const today = formatDate(new Date())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const value = formatDate(date)
    return { value, day: date.getDate(), currentMonth: date.getMonth() === viewMonth.value, today: value === today }
  })
})

watch(() => props.open, (open) => {
  if (!open) return
  const date = props.modelValue ? new Date(`${props.modelValue}T00:00:00`) : new Date()
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
})

function moveMonth(offset) {
  const date = new Date(viewYear.value, viewMonth.value + offset, 1)
  viewYear.value = date.getFullYear()
  viewMonth.value = date.getMonth()
}
function select(value) {
  emit('update:modelValue', value)
  emit('update:open', false)
}
</script>

<template>
  <Transition name="date-calendar">
    <div v-if="open" class="date-picker-backdrop" @click.self="$emit('update:open', false)">
      <section class="date-picker" role="dialog" aria-modal="true" :aria-label="title">
        <header><strong>{{ monthTitle }}</strong><div><button type="button" aria-label="上个月" @click="moveMonth(-1)"><ChevronLeft :size="14" /></button><button type="button" aria-label="下个月" @click="moveMonth(1)"><ChevronRight :size="14" /></button></div></header>
        <div class="date-picker__week" aria-hidden="true"><span v-for="day in ['日','一','二','三','四','五','六']" :key="day">{{ day }}</span></div>
        <div class="date-picker__grid"><button v-for="date in days" :key="date.value" type="button" :class="{ outside: !date.currentMonth, today: date.today, selected: modelValue === date.value }" :aria-label="date.value" :aria-pressed="modelValue === date.value" @click="select(date.value)">{{ date.day }}</button></div>
        <footer><button type="button" @click="select('')">清除</button><button type="button" @click="select(formatDate(new Date()))">今天</button></footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.date-picker-backdrop{position:absolute;z-index:50;inset:0;display:grid;place-items:center;padding:18px;background:rgba(3,9,10,.42);backdrop-filter:blur(8px)}.date-picker{width:min(286px,100%);padding:12px;box-sizing:border-box;color:#24272b;border:1px solid rgba(219,221,225,.96);border-radius:19px;background:rgba(255,255,255,.985);box-shadow:0 24px 52px rgba(17,20,24,.28)}.date-picker header{display:flex;align-items:center;justify-content:space-between;min-height:30px;padding:0 2px 8px}.date-picker header strong{font-size:12px;font-weight:850}.date-picker header>div{display:flex;gap:5px}.date-picker button{border:0}.date-picker header button{display:grid;place-items:center;width:29px;height:29px;padding:0;color:#54585e;border:1px solid #e4e5e8;border-radius:9px;background:#f5f5f6}.date-picker__week,.date-picker__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.date-picker__week span{padding:5px 0;color:#a1a4a8;font-size:8px;font-weight:800;text-align:center}.date-picker__grid button{height:31px;padding:0;color:#393d42;border-radius:9px;background:transparent;font-size:9px;font-weight:750}.date-picker__grid button.outside{color:#c5c7ca}.date-picker__grid button.today{box-shadow:inset 0 0 0 1px #c6a065}.date-picker__grid button.selected{color:#fff;background:#25282d;box-shadow:0 5px 12px rgba(37,40,45,.2)}.date-picker footer{display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:9px;border-top:1px solid #eceef0}.date-picker footer button{height:28px;padding:0 9px;color:#4b5056;border-radius:8px;background:transparent;font-size:8px;font-weight:850}.date-picker footer button:last-child{color:#fff;background:#25282d}.date-calendar-enter-active,.date-calendar-leave-active{transition:opacity .24s ease}.date-calendar-enter-active .date-picker{animation:calendar-in .42s cubic-bezier(.16,1,.3,1) both}.date-calendar-leave-to{opacity:0}@keyframes calendar-in{from{opacity:0;transform:translateY(14px) scale(.93)}to{opacity:1;transform:none}}
</style>
