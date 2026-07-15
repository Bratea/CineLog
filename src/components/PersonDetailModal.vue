<script setup>
import { LoaderCircle, X } from 'lucide-vue-next'
defineProps({ person: { type: Object, required: true }, imageSrc: { type: String, default: '' } })
defineEmits(['close'])
</script>

<template>
  <div class="person-modal-backdrop" role="dialog" aria-modal="true" :aria-label="`${person.name}演员资料`" @click.self="$emit('close')">
    <section class="person-modal">
      <header><div><small>CAST PROFILE</small><h2>{{ person.name }}</h2></div><button aria-label="关闭演员资料" @click="$emit('close')"><X :size="17" /></button></header>
      <div class="person-modal__hero"><img v-if="imageSrc" :src="imageSrc" :alt="person.name" /><div><span>{{ person.role }}</span><p v-if="person.birthday">{{ person.birthday }}<template v-if="person.placeOfBirth"> · {{ person.placeOfBirth }}</template></p></div></div>
      <div v-if="person.detailState === 'loading'" class="person-modal__loading"><LoaderCircle :size="15" />正在读取演员资料…</div>
      <template v-else>
        <p class="person-modal__bio">{{ person.biography || 'TMDB 暂未提供这位演员的中文简介。' }}</p>
        <section v-if="person.knownFor?.length"><h3>其他代表作品</h3><div class="known-for"><article v-for="work in person.knownFor" :key="work.id"><img v-if="work.poster" :src="work.poster" :alt="work.title" /><div v-else></div><strong>{{ work.title }}</strong><span>{{ work.year }}</span></article></div></section>
      </template>
    </section>
  </div>
</template>

<style scoped>
.person-modal-backdrop{position:absolute;z-index:30;inset:0;display:grid;align-items:end;padding:16px;background:rgba(2,7,8,.62);backdrop-filter:blur(12px);animation:person-fade .24s ease both}.person-modal{max-height:82%;overflow-y:auto;padding:18px;border:1px solid rgba(255,255,255,.2);border-radius:26px;background:linear-gradient(155deg,rgba(26,34,34,.98),rgba(7,15,14,.99));box-shadow:0 28px 60px rgba(0,0,0,.5);animation:person-up .48s cubic-bezier(.16,1,.3,1) both}.person-modal header{display:flex;align-items:center;justify-content:space-between}.person-modal header small{color:#f2b85b;font-size:7px;font-weight:850;letter-spacing:.16em}.person-modal h2{margin:4px 0 0;color:#fff8ef;font:500 23px Georgia,'Songti SC',serif}.person-modal header button{display:grid;place-items:center;width:34px;height:34px;padding:0;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:50%;background:rgba(255,255,255,.06)}.person-modal__hero{display:flex;align-items:end;gap:13px;margin-top:15px}.person-modal__hero img{width:92px;height:112px;object-fit:cover;border-radius:17px;box-shadow:0 13px 26px rgba(0,0,0,.3)}.person-modal__hero span{display:inline-block;padding:5px 8px;color:#f4bb65;border:1px solid rgba(244,187,101,.25);border-radius:999px;background:rgba(244,187,101,.08);font-size:8px}.person-modal__hero p{margin:8px 0 3px;color:rgba(255,255,255,.48);font-size:8px;line-height:1.55}.person-modal__loading{display:flex;align-items:center;gap:7px;margin-top:18px;color:rgba(255,255,255,.55);font-size:9px}.person-modal__loading svg{animation:spin .8s linear infinite}.person-modal__bio{margin:17px 0 0;color:rgba(255,255,255,.68);font-size:9px;line-height:1.8}.person-modal h3{margin:18px 0 10px;color:#fff8ef;font:500 14px Georgia,serif}.known-for{display:flex;gap:9px;overflow-x:auto;padding-bottom:5px;scrollbar-width:none}.known-for article{flex:0 0 68px}.known-for img,.known-for article>div{display:block;width:68px;height:96px;object-fit:cover;border-radius:11px;background:rgba(255,255,255,.05)}.known-for strong,.known-for span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.known-for strong{margin-top:6px;color:rgba(255,255,255,.8);font-size:8px}.known-for span{margin-top:2px;color:#f2b85b;font-size:7px}@keyframes person-fade{from{opacity:0}}@keyframes person-up{from{opacity:0;transform:translateY(45px) scale(.96)}}@keyframes spin{to{transform:rotate(360deg)}}
</style>
