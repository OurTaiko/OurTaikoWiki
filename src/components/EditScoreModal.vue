<script setup lang="ts">
import type { SongLevelData, SongStats, UserScore } from '@/types'
import { calculateSongStats } from '@utils/calculator'
import { computed, ref, watch } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
interface Props {
  show: boolean
  title: string
  initialScore?: UserScore
  songData?: SongLevelData
  songId?: number
  difficulty?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', score: Partial<UserScore>): void
  (e: 'clear'): void
}>()

const store = useScoreStore()
const { blacklistedSongs, toggleBlacklist, lockedScores, toggleLock: storeToggleLock, updateLockedScore } = store

const form = ref({
  score: 0,
  great: 0,
  good: 0,
  bad: 0,
  drumroll: 0,
  combo: 0
})

const isLocked = computed(() => {
  const key = getLockKey()
  return key ? !!lockedScores.value[key] : false
})

const isBlacklisted = computed(() => {
  const key = getLockKey()
  return key ? blacklistedSongs.value.includes(key) : false
})

const handleToggleBlacklist = () => {
  const id = props.songId || props.initialScore?.id
  const level = props.difficulty || props.initialScore?.level
  if (id !== undefined && level !== undefined) {
    toggleBlacklist(id, level)
  }
}

const getLockKey = () => {
  if (props.songId !== undefined && props.difficulty !== undefined) {
    return `${props.songId}-${props.difficulty}`
  }
  if (props.initialScore) {
    return `${props.initialScore.id}-${props.initialScore.level}`
  }
  return null
}

const toggleLock = () => {
  const id = props.songId || props.initialScore?.id || 0
  const level = props.difficulty || props.initialScore?.level || 0

  if (isLocked.value) {
    storeToggleLock(id, level)
  } else {
    storeToggleLock(id, level, {
      ...form.value,
      scoreRank: props.initialScore?.scoreRank || 0,
      playCount: props.initialScore?.playCount || 0,
      clearCount: props.initialScore?.clearCount || 0,
      fullcomboCount: props.initialScore?.fullcomboCount || 0,
      perfectCount: props.initialScore?.perfectCount || 0
    })
  }
}

const previewStats = computed<SongStats | null>(() => {
  if (!props.songData) return null

  const tempScore: UserScore = {
    id: 0,
    level: 0,
    score: form.value.score,
    scoreRank: 0,
    great: form.value.great,
    good: form.value.good,
    bad: form.value.bad,
    drumroll: form.value.drumroll,
    combo: form.value.combo,
    playCount: 0,
    clearCount: 0,
    fullcomboCount: 0,
    perfectCount: 0,
    updatedAt: ''
  }

  return calculateSongStats(props.songData, tempScore, store.ratingAlgorithm.value)
})

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.initialScore) {
      form.value = {
        score: props.initialScore.score,
        great: props.initialScore.great,
        good: props.initialScore.good,
        bad: props.initialScore.bad,
        drumroll: props.initialScore.drumroll,
        combo: props.initialScore.combo
      }
    } else {
      form.value = {
        score: 0,
        great: 0,
        good: 0,
        bad: 0,
        drumroll: 0,
        combo: 0
      }
    }
  }
})

const handleSave = () => {
  if (isLocked.value) {
    const id = props.songId || props.initialScore?.id || 0
    const level = props.difficulty || props.initialScore?.level || 0
    updateLockedScore(id, level, form.value)
  }
  emit('save', { ...form.value })
}

const handleClear = () => {
  if (confirm(t('editModal.confirmClear'))) {
    emit('clear')
  }
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show"
      class="z-[1000] fixed inset-0 flex justify-center items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300"
      @mousedown.self="$emit('close')">
      <div
        class="ffxiv-ui-dialog bg-white/90 shadow-2xl backdrop-blur-2xl border border-white/20 rounded-[32px] w-[95%] max-w-[500px] overflow-hidden transition-all duration-300"
        @mousedown.stop>
        <!-- Header -->
        <div class="flex justify-between items-center px-8 py-6">
          <div class="space-y-1">
            <h3 class="m-0 font-bold text-[#1D1D1F] text-xl">{{ t('editModal.title') }}</h3>
            <p class="m-0 max-w-[300px] text-[#86868B] text-sm truncate">{{ title }}</p>
          </div>
          <button
            class="flex justify-center items-center bg-black/5 hover:bg-black/10 border-none rounded-full w-8 h-8 text-[#1D1D1F] transition-all cursor-pointer"
            @click="$emit('close')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="space-y-6 px-8 pb-8">
          <!-- Score Input -->
          <div class="space-y-2">
            <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.score') }}</label>
            <input type="number" v-model.number="form.score"
              class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all" />
          </div>

          <!-- Counts Grid -->
          <div class="gap-4 grid grid-cols-3">
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.good') }}</label>
              <input type="number" v-model.number="form.great"
                class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.ok') }}</label>
              <input type="number" v-model.number="form.good"
                class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.bad') }}</label>
              <input type="number" v-model.number="form.bad"
                class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
          </div>

          <!-- Combo & Drumroll -->
          <div class="gap-4 grid grid-cols-2">
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.roll') }}</label>
              <input type="number" v-model.number="form.drumroll"
                class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
            <div class="space-y-2">
              <label class="block px-1 font-semibold text-[#1D1D1F] text-sm">{{ t('rating.combo') }}</label>
              <input type="number" v-model.number="form.combo"
                class="box-border bg-black/5 focus:bg-white px-4 py-3 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] transition-all" />
            </div>
          </div>

          <!-- Preview Section -->
          <div v-if="previewStats" class="space-y-4 bg-black/5 p-6 rounded-[24px]">
            <div class="flex justify-between items-center">
              <span class="font-medium text-[#86868B]">{{ t('editModal.preview') }}</span>
              <span class="font-bold text-[#007AFF] text-2xl">{{ previewStats.rating.toFixed(2) }}</span>
            </div>
            <div class="gap-3 grid grid-cols-3">
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.daigouryoku')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.daigouryoku.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.stamina')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.stamina.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.speed')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.speed.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.accuracy')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.accuracy_power.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.rhythm')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.rhythm.toFixed(1) }}</span>
              </div>
              <div class="flex flex-col items-center bg-white/50 p-3 rounded-xl">
                <span class="font-bold text-[#86868B] text-[10px] uppercase tracking-wider">{{ t('radar.complex')
                }}</span>
                <span class="font-bold text-[#1D1D1F]">{{ previewStats.complex.toFixed(1) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-3 pt-2">
            <button
              class="flex justify-center items-center bg-red-50 hover:bg-red-100 disabled:opacity-30 border-none rounded-2xl w-12 h-12 text-[#FF3B30] transition-all cursor-pointer"
              @click="handleClear" :disabled="!initialScore" :title="t('editModal.clearScore')">
              <i class="fa-solid fa-trash"></i>
            </button>
            <button
              class="flex justify-center items-center border-none rounded-2xl w-12 h-12 transition-all cursor-pointer"
              :class="isLocked ? 'bg-[#FF9500]/10 text-[#FF9500]' : 'bg-black/5 text-[#86868B]'" @click="toggleLock"
              :title="isLocked ? t('editModal.locked') : t('editModal.lock')">
              <i class="fa-solid" :class="isLocked ? 'fa-lock' : 'fa-lock-open'"></i>
            </button>
            <button
              class="flex justify-center items-center border-none rounded-2xl w-12 h-12 transition-all cursor-pointer"
              :class="isBlacklisted ? 'bg-red-500 text-white' : 'bg-black/5 text-[#86868B]'"
              @click="handleToggleBlacklist"
              :title="isBlacklisted ? t('editModal.blacklisted') : t('editModal.blacklist')">
              <i class="fa-solid fa-ban"></i>
            </button>
            <div class="flex flex-1 gap-3">
              <button
                class="flex-1 bg-black/5 hover:bg-black/10 py-3 border-none rounded-2xl font-semibold text-[#1D1D1F] transition-all cursor-pointer"
                @click="$emit('close')">{{ t('common.cancel') }}</button>
              <button
                class="flex-1 bg-[#007AFF] hover:bg-[#0071E3] shadow-[#007AFF]/20 shadow-lg py-3 border-none rounded-2xl font-bold text-white transition-all cursor-pointer"
                @click="handleSave">{{ t('common.save') }}</button>
            </div>
          </div>
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

.modal-enter-from>div,
.modal-leave-to>div {
  transform: scale(0.9);
}
</style>
