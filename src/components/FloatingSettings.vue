<script setup lang="ts">
import { eventBus } from '@utils/eventBus'
import { ref } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { ratingAlgorithm, setRatingAlgorithm, onlyCnSongs, setCnFilter } = useScoreStore()
const { t } = useI18n()
const isOpen = ref(false)

function toggleMenu() {
  isOpen.value = !isOpen.value
}

function closeMenu() {
  isOpen.value = false
}

function toggleCnSongs() {
  setCnFilter(!onlyCnSongs.value)
  // 触发全局事件通知其他组件更新 (保持兼容性)
  eventBus.emit('cn-filter-changed', onlyCnSongs.value)
}
</script>

<template>
  <div>
    <!-- Main Button -->
    <button 
      class="right-[30px] bottom-[162px] z-[999] fixed flex justify-center items-center bg-white/70 shadow-lg backdrop-blur-xl border border-white/20 rounded-full w-14 h-14 text-[#007AFF] text-2xl active:scale-90 transition-all duration-300 cursor-pointer" 
      @click="toggleMenu"
      :title="t('settings.title')"
    >
      <i class="z-[1] relative fas fa-cog"></i>
    </button>

    <!-- Popup Modal -->
    <Transition name="menu">
      <div v-if="isOpen" class="z-[2000] fixed inset-0 flex justify-center items-center bg-black/20 backdrop-blur-sm" @click="closeMenu">
        <div class="ffxiv-ui-dialog ffxiv-ui-dialog--compact bg-white/80 shadow-2xl backdrop-blur-xl p-6 border border-white/20 rounded-[32px] w-[90%] max-w-[320px]" @click.stop>
          <div class="flex justify-between items-center mb-6">
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl tracking-tight">{{ t('settings.title') }}</h3>
            <button class="flex justify-center items-center bg-black/5 hover:bg-black/10 rounded-full w-8 h-8 text-[#8E8E93] transition-colors cursor-pointer" @click="closeMenu">
              <i class="text-sm fas fa-times"></i>
            </button>
          </div>
          
          <div class="flex flex-col gap-3">
            <!-- 算法选择 -->
            <div class="flex flex-col gap-2 mb-2">
              <span class="px-2 font-medium text-[#8E8E93] text-xs uppercase tracking-wider">{{ t('settings.algo') }}</span>
              <div class="flex flex-col gap-2">
                <button
                  @click="setRatingAlgorithm('comprehensive')"
                  class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  :class="{ 'bg-[#007AFF]/10 text-[#007AFF]': ratingAlgorithm === 'comprehensive' }"
                >
                  <i v-if="ratingAlgorithm === 'comprehensive'" class="text-[#007AFF] fa-regular fa-circle-check"></i>
                  <i v-else class="fa-regular fa-circle"></i>
                  <span>{{ t('settings.algoGeneral') }}</span>
                </button>
                <button
                  @click="setRatingAlgorithm('great-only')"
                  class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base active:scale-[0.98] transition-all duration-200 cursor-pointer"
                  :class="{ 'bg-[#007AFF]/10 text-[#007AFF]': ratingAlgorithm === 'great-only' }"
                >
                  <i v-if="ratingAlgorithm === 'great-only'" class="text-[#007AFF] fa-regular fa-circle-check"></i>
                  <i v-else class="fa-regular fa-circle"></i>
                  <span>{{ t('settings.algoGood') }}</span>
                </button>
              </div>
            </div>

            <!-- 只查看国服设置 -->
            <span class="px-2 font-medium text-[#8E8E93] text-xs uppercase tracking-wider">{{ t('settings.server') }}</span>
            <button
              @click="toggleCnSongs"
              class="flex items-center gap-4 bg-black/5 hover:bg-black/10 px-5 py-4 rounded-2xl w-full font-semibold text-[#1D1D1F] text-base active:scale-[0.98] transition-all duration-200 cursor-pointer"
              :class="{ 'bg-[#007AFF]/10 text-[#007AFF]': onlyCnSongs }"
            >
                <i v-if="onlyCnSongs" class="text-[#007AFF] fa-regular fa-circle-check"></i>
                <i v-else class="fa-regular fa-circle"></i>
              <span>{{ t('settings.chinaOnly') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Overlay fade + scale transition */
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.2s ease-out;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
}

/* Content scale transition */
.menu-enter-active > div,
.menu-leave-active > div {
  transition: transform 0.2s ease-out, opacity 0.2s ease-out;
}

.menu-enter-from > div,
.menu-leave-to > div {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}
</style>
