<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  show: boolean
}

defineProps<Props>()
const { t } = useI18n()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleOverlayMouseDown = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300" @mousedown="handleOverlayMouseDown">
      <div class="ffxiv-ui-dialog flex flex-col bg-white/90 shadow-2xl backdrop-blur-2xl border border-white/20 rounded-[32px] w-[95%] max-w-[800px] max-h-[85vh] overflow-hidden transition-all duration-300">
        <!-- Header -->
        <div class="flex flex-shrink-0 justify-between items-center px-8 py-6 border-black/5 border-b">
          <div class="flex items-center gap-3">
            <div class="bg-[#007AFF]/10 p-2 rounded-full">
              <i class="text-[#007AFF] fa-solid fa-circle-info"></i>
            </div>
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl">{{ t('guideModal.title') }}</h3>
          </div>
          <button class="flex justify-center items-center bg-black/5 hover:bg-black/10 border-none rounded-full w-8 h-8 text-[#1D1D1F] transition-all cursor-pointer" @click="handleClose">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Content -->
        <div class="space-y-8 p-8 overflow-y-auto">
          <!-- Warning Card -->
          <div class="flex gap-3 bg-[#FF9500]/10 p-4 border border-[#FF9500]/20 rounded-2xl">
            <i class="mt-1 text-[#FF9500] fa-solid fa-triangle-exclamation"></i>
            <p class="m-0 font-semibold text-[#FF9500] text-sm">{{ t('guideModal.notice') }}</p>
          </div>
          
          <!-- Section: Principle -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#007AFF] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">{{ t('guideModal.principle.title') }}</h4>
            </div>
            <p class="text-[#86868B] leading-relaxed">{{ t('guideModal.principle.desc') }}</p>
            <div class="gap-4 grid grid-cols-1 md:grid-cols-3">
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#34C759] fa-solid fa-arrow-trend-up"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">{{ t('guideModal.principle.item1Title') }}</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">{{ t('guideModal.principle.item1Desc') }}</p>
              </div>
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#007AFF] fa-solid fa-sliders"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">{{ t('guideModal.principle.item2Title') }}</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">{{ t('guideModal.principle.item2Desc') }}</p>
              </div>
              <div class="space-y-2 bg-black/5 p-4 rounded-2xl">
                <i class="text-[#FF3B30] fa-solid fa-bullseye"></i>
                <h5 class="m-0 font-bold text-[#1D1D1F] text-sm">{{ t('guideModal.principle.item3Title') }}</h5>
                <p class="m-0 text-[#86868B] text-xs leading-relaxed">{{ t('guideModal.principle.item3Desc') }}</p>
              </div>
            </div>
          </section>
          
          <!-- Section: How to use -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#AF52DE] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">{{ t('guideModal.howTo.title') }}</h4>
            </div>
            
            <div class="space-y-4">
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">1</div>
                <div class="space-y-1">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">{{ t('guideModal.howTo.step1Title') }}</h5>
                  <p class="m-0 text-[#86868B] text-sm">{{ t('guideModal.howTo.step1Desc') }}</p>
                </div>
              </div>
              
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">2</div>
                <div class="space-y-2">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">{{ t('guideModal.howTo.step2Title') }}</h5>
                  <ul class="space-y-2 m-0 pl-4 text-[#86868B] text-sm list-disc">
                    <li>{{ t('guideModal.howTo.step2Desc1') }}</li>
                    <li>{{ t('guideModal.howTo.step2Desc2') }}</li>
                  </ul>
                </div>
              </div>
              
              <div class="flex gap-4 bg-black/5 p-4 rounded-2xl">
                <div class="flex flex-shrink-0 justify-center items-center bg-[#AF52DE] rounded-full w-6 h-6 font-bold text-white text-xs">3</div>
                <div class="space-y-2">
                  <h5 class="m-0 font-bold text-[#1D1D1F]">{{ t('guideModal.howTo.step3Title') }}</h5>
                  <p class="m-0 text-[#86868B] text-sm">{{ t('guideModal.howTo.step3Desc') }}</p>
                </div>
              </div>
            </div>
          </section>
          
          <!-- Section: Strategy -->
          <section class="space-y-4">
            <div class="flex items-center gap-2">
              <div class="bg-[#34C759] rounded-full w-1 h-5"></div>
              <h4 class="m-0 font-bold text-[#1D1D1F] text-lg">{{ t('guideModal.strategy.title') }}</h4>
            </div>
            <ul class="space-y-2 m-0 pl-6 text-[#86868B] text-sm list-disc">
              <li>{{ t('guideModal.strategy.item1') }}</li>
              <li>{{ t('guideModal.strategy.item2') }}</li>
              <li>{{ t('guideModal.strategy.item3') }}</li>
              <li>{{ t('guideModal.strategy.item4') }}</li>
            </ul>
          </section>
        </div>

        <!-- Footer -->
        <div class="flex flex-shrink-0 justify-end px-8 py-6 border-black/5 border-t">
          <button class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg px-8 py-3 border-none rounded-2xl font-bold text-white transition-all cursor-pointer" @click="handleClose">
            {{ t('guideModal.closeBtn') }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.9);
}
</style>
