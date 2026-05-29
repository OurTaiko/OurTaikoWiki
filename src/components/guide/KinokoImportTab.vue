<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UserScore } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  showModal: (msg: string, title?: string) => void
  tryParseOfficialData: (data: any) => UserScore[] | null
}>()

const emit = defineEmits<{
  analyze: [data: UserScore[]]
}>()

const kinokoApiKey = ref(localStorage.getItem('kinokoApiKey') || '')
const kinokoPlayerId = ref(localStorage.getItem('kinokoPlayerId') || '')
const isLoading = ref(false)

const extractOfficialScores = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload

  const candidates = [
    payload?.data?.playedRecords?.scoreInfo,
    payload?.playedRecords?.scoreInfo,
    payload?.data?.songs,
    payload?.data?.scoreInfo,
    payload?.data,
    payload
  ]

  for (const item of candidates) {
    if (Array.isArray(item)) return item
  }

  return []
}

const fetchKinokoAndAnalyze = async () => {
  const apiKey = kinokoApiKey.value.trim()
  const playerId = kinokoPlayerId.value.trim()

  if (!apiKey) {
    props.showModal(t('guide.kinokoErrors.apiKeyRequired'), t('guide.kinokoErrors.hintTitle'))
    return
  }

  if (playerId && !/^\d+$/.test(playerId)) {
    props.showModal(t('guide.kinokoErrors.playerIdNumeric'), t('guide.kinokoErrors.errorTitle'))
    return
  }

  localStorage.setItem('kinokoApiKey', apiKey)
  localStorage.setItem('kinokoPlayerId', playerId)

  isLoading.value = true

  try {
    const query = playerId ? `?player_id=${encodeURIComponent(playerId)}` : ''
    const response = await fetch(`https://kinoko.zorua.cn/api/v1/scores/hiroba${query}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => null)
      throw new Error(
        errData?.message
          || errData?.detail
          || errData?.error
          || `${t('guide.kinokoErrors.requestFailed')} (${response.status})`
      )
    }

    const payload = await response.json()
    const songs = extractOfficialScores(payload)

    if (!songs || songs.length === 0) {
      props.showModal(t('guide.kinokoErrors.noData'), t('guide.kinokoErrors.failedTitle'))
      isLoading.value = false
      return
    }

    const output = props.tryParseOfficialData(songs)

    if (!output) {
      props.showModal(t('guide.kinokoErrors.format'), t('guide.kinokoErrors.failedTitle'))
      isLoading.value = false
      return
    }

    emit('analyze', output)
  } catch (error: any) {
    props.showModal(error.message || t('guide.kinokoErrors.syncFailed'), t('guide.kinokoErrors.failedTitle'))
    isLoading.value = false
  }
}
</script>

<template>
  <div class="p-10 text-left">
    <div class="space-y-6">
      <div class="space-y-4">
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            1</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.kinokoStep1Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed" v-html="t('guide.kinokoStep1Desc')"></p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            2</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.kinokoStep2Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed">{{ t('guide.kinokoStep2Desc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div
            class="flex flex-shrink-0 justify-center items-center bg-[#007AFF] rounded-full w-8 h-8 font-bold text-white text-sm">
            3</div>
          <div class="space-y-1">
            <p class="m-0 font-medium text-[#1D1D1F]">{{ t('guide.kinokoStep3Title') }}</p>
            <p class="m-0 text-[#86868B] text-sm leading-relaxed">{{ t('guide.kinokoStep3Desc') }}</p>
          </div>
        </div>
      </div>

      <div class="space-y-4 bg-black/5 p-6 rounded-[24px]">
        <p class="m-0 font-bold text-[#1D1D1F]">{{ t('guide.kinokoNoteTitle') }}</p>
        <ul class="space-y-1 m-0 pl-5 text-[#86868B] text-sm list-disc">
          <li>{{ t('guide.kinokoNote1') }}</li>
          <li>{{ t('guide.kinokoNote2') }}</li>
          <li>{{ t('guide.kinokoNote3') }}</li>
        </ul>
      </div>

      <div class="space-y-3 pt-2">
        <input v-model="kinokoApiKey" type="password" :placeholder="t('guide.kinokoApiKeyPlaceholder')"
          class="box-border bg-black/5 focus:bg-white px-6 py-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all"
          @keyup.enter="fetchKinokoAndAnalyze" />
        <input v-model="kinokoPlayerId" type="text" :placeholder="t('guide.kinokoPlayerIdPlaceholder')"
          class="box-border bg-black/5 focus:bg-white px-6 py-4 border-none rounded-2xl outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-[#1D1D1F] text-lg transition-all"
          @keyup.enter="fetchKinokoAndAnalyze" />
        <button @click="fetchKinokoAndAnalyze" :disabled="isLoading"
          class="bg-[#007AFF] hover:bg-[#0071E3] disabled:opacity-50 shadow-[#007AFF]/20 shadow-lg py-4 border-none rounded-2xl w-full font-bold text-white text-lg active:scale-[0.98] transition-all cursor-pointer">
          <i v-if="isLoading" class="mr-2 fa-solid fa-circle-notch fa-spin"></i>
          {{ isLoading ? t('report.calculating') : t('guide.kinokoBtnImport') }}
        </button>
      </div>
    </div>
  </div>
</template>