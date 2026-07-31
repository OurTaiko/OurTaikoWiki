<script setup lang="ts">
interface Props {
  show: boolean
  title?: string
  message: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '提示'
})

const emit = defineEmits<{
  (e: 'close'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleOverlayClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300" @click="handleOverlayClick">
      <div class="ffxiv-ui-dialog bg-white/90 shadow-2xl backdrop-blur-2xl border border-white/20 rounded-[32px] min-w-[320px] max-w-[90%] overflow-hidden transition-all duration-300">
        <div class="px-8 pt-8 pb-4">
          <h3 class="m-0 font-bold text-[#1D1D1F] text-xl text-center">{{ title }}</h3>
        </div>
        <div class="px-8 py-4">
          <p class="m-0 text-[#1D1D1F] text-center leading-relaxed whitespace-pre-wrap">{{ message }}</p>
        </div>
        <div class="flex justify-center p-6">
          <button class="bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-3 border-none rounded-2xl w-full font-bold text-white active:scale-[0.98] transition-all cursor-pointer" @click="handleClose">
            确定
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
