<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const hasScoreData = ref(false)

const toggleLanguage = () => {
  locale.value = locale.value === 'zh' ? 'en' : 'zh'
  localStorage.setItem('lang', locale.value)
}

const checkScoreData = () => {
  hasScoreData.value = localStorage.getItem('taikoScoreData') !== null
}

onMounted(() => {
  checkScoreData()
  // 监听 storage 事件以响应 localStorage 的变化
  window.addEventListener('storage', checkScoreData)
  // 监听自定义事件以响应同一页面内的 localStorage 变化
  window.addEventListener('localStorageUpdate', checkScoreData)
})

onUnmounted(() => {
  window.removeEventListener('storage', checkScoreData)
  window.removeEventListener('localStorageUpdate', checkScoreData)
})

// 手动检查 localStorage 变化（用于同一标签页内的更新）
const navigateToReport = () => {
  checkScoreData()
  if (hasScoreData.value) {
    router.push('/report')
  }
}

const navigateToHome = () => {
  router.push('/')
}

const navigateToSongs = () => {
  router.push('/songs')
}

const navigateToFaq = () => {
  router.push('/faq')
}
const navigateToV2Full = () => {
  router.push('/v2full')
}
</script>

<template>
  <nav class="top-0 right-0 left-0 z-[1000] sticky bg-white/70 backdrop-blur-md border-black/5 border-b">
    <div
      class="flex max-md:flex-col justify-between items-center max-md:gap-4 mx-auto px-8 max-md:px-4 py-3 max-w-[1200px]">
      <div class="flex items-center gap-3 font-bold text-[#1D1D1F] text-xl">
        <span class="max-md:text-lg tracking-tight">太鼓之达人 Rating</span>
      </div>
      <div class="flex max-md:justify-center items-center gap-2 max-md:w-full">
        <button @click="navigateToHome" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/'
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-home"></i>
          <span class="max-md:hidden">{{ t('nav.guide') }}</span>
        </button>
        <button @click="navigateToSongs" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/songs',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/songs'
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-music"></i>
          <span class="max-md:hidden">{{ t('nav.songs') }}</span>
        </button>
        <button @click="navigateToReport" :disabled="!hasScoreData" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/report',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/report' && hasScoreData,
          'opacity-30 cursor-not-allowed': !hasScoreData
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-chart-bar"></i>
          <span class="max-md:hidden">{{ t('nav.report') }}</span>
        </button>
        <button @click="navigateToFaq" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/faq',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/faq'
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-circle-question"></i>
          <span class="max-md:hidden">{{ t('nav.faq') }}</span>
        </button>
        <button @click="() => { router.push('/v2test') }" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/v2test',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/v2test'
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-circle-question"></i>
          <span class="max-md:hidden">{{ t('nav.v2test') }}</span>
        </button>
        <button @click="navigateToV2Full" :class="{
          'bg-[#007AFF] text-white shadow-sm': route.path === '/v2full',
          'bg-black/5 text-[#1D1D1F] hover:bg-black/10': route.path !== '/v2full'
        }"
          class="flex items-center gap-2 px-5 py-2 rounded-full font-semibold text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-star"></i>
          <span class="max-md:hidden">{{ t('nav.v2full') }}</span>
        </button>
        <button @click="toggleLanguage"
          class="flex items-center gap-2 bg-black/5 hover:bg-black/10 px-4 py-2 rounded-full font-semibold text-[#1D1D1F] text-sm active:scale-95 transition-all duration-200 cursor-pointer">
          <i class="fas fa-globe"></i>
          <span>{{ locale === 'zh' ? 'EN' : '中文' }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>
