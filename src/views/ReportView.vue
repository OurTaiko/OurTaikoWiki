<script setup lang="ts">
import type { SongStats, RatingDimensions } from '@/types'
import RadarChart from '@components/RadarChart.vue'
import TopTable from '@components/TopTable.vue'
import duplicateSongs from '@data/duplicateSongs'
import { calculateDrumrollSpeedB20 } from '@utils/calculator'
import { eventBus } from '@utils/eventBus'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useScoreStore()
const { 
    filteredSongStats, 
    overallRating, 
    lastOverallRating, 
    radarData, 
    lastRadarData,
    topLists, 
    isLoading, 
    error
} = store

const notice = computed(() => {
    if (isLoading.value) return t('report.loading')
    if (error.value) return error.value
    if (filteredSongStats.value.length === 0) return t('report.noData')
    return ''
})

const drumrollHintRef = ref<HTMLDetailsElement | null>(null)
const activeSection = ref('overview')
const activeSubTab = ref<'top' | 'recommend'>('top')

const menuItems = computed(() => [
    { id: 'overview', label: t('report.overview') },
    { id: 'rating', label: 'Rating' },
    { id: 'daigouryoku', label: t('radar.daigouryoku') },
    { id: 'stamina', label: t('radar.stamina') },
    { id: 'speed', label: t('radar.speed') },
    { id: 'accuracy_power', label: t('radar.accuracy') },
    { id: 'rhythm', label: t('radar.rhythm') },
    { id: 'complex', label: t('radar.complex') }
])

const radarDimensionKeys: Array<'daigouryoku' | 'stamina' | 'speed' | 'accuracy_power' | 'rhythm' | 'complex'> = [
    'daigouryoku',
    'stamina',
    'speed',
    'accuracy_power',
    'rhythm',
    'complex'
]

const tableDimensionKeys: Array<keyof SongStats & keyof RatingDimensions> = [
    'rating',
    'daigouryoku',
    'stamina',
    'speed',
    'accuracy_power',
    'rhythm',
    'complex'
]

const radarDimensionLabel = (key: 'daigouryoku' | 'stamina' | 'speed' | 'accuracy_power' | 'rhythm' | 'complex') => {
	return key === 'accuracy_power' ? t('radar.accuracy') : t(`radar.${key}`)
}

// V1 radar chart: 大歌力, 体力, 高速力, 精度力, 节奏, 复合
const radarLabels = computed(() => [
  t('radar.daigouryoku'),
  t('radar.stamina'),
  t('radar.speed'),
  t('radar.accuracy'),
  t('radar.rhythm'),
  t('radar.complex')
])

const radarValues = computed(() => [
  radarData.value.daigouryoku,
  radarData.value.stamina,
  radarData.value.speed,
  radarData.value.accuracy,
  radarData.value.rhythm,
  radarData.value.complex
])

const radarCurrentValue = (key: 'daigouryoku' | 'stamina' | 'speed' | 'accuracy_power' | 'rhythm' | 'complex') => {
    const value = radarData.value
    if (!value) return 0
    if (key === 'accuracy_power') return value.accuracy ?? 0
    return (value as any)[key] ?? 0
}

const dimensionColumnLabel = (key: keyof RatingDimensions) => {
    if (key === 'rating') return t('topTable.rating')
    if (key === 'accuracy_power') return t('radar.accuracy')
    return t(`radar.${key}`)
}

const getSongDimensionValue = (song: SongStats, key: keyof RatingDimensions) => {
    return song[key]
}

const getSongDimensionDiff = (song: SongStats, key: keyof RatingDimensions) => {
    if (key === 'rating') return song._ratingDiff ?? 0
    return song._dimensionDiffs?.[key] ?? 0
}

const getOverallDimensionValue = (key: keyof RatingDimensions): number => {
    if (key === 'rating') return overallRating.value
    if (key === 'accuracy_power') return radarData.value?.accuracy ?? 0
    return (radarData.value as any)?.[key] ?? 0
}

const isAboveOverall = (song: SongStats, key: keyof RatingDimensions): boolean => {
    return getSongDimensionValue(song, key) > getOverallDimensionValue(key)
}

function handleCnFilterChange(value: boolean) {
    store.setCnFilter(value)
}

function handleOutsideClick(event: MouseEvent) {
    const hint = drumrollHintRef.value
    if (hint?.open && !hint.contains(event.target as Node)) {
        hint.open = false
    }
}

onMounted(async () => {
    eventBus.on('cn-filter-changed', handleCnFilterChange)
    document.addEventListener('click', handleOutsideClick)

    await store.init()
})

onUnmounted(() => {
    eventBus.off('cn-filter-changed', handleCnFilterChange)
    document.removeEventListener('click', handleOutsideClick)
})

const currentTableData = computed(() => {
    if (activeSection.value === 'overview') return null
    const item = menuItems.value.find(i => i.id === activeSection.value)
    if (!item) return null
    return {
        title: item.label,
        data: topLists.value[activeSection.value as keyof typeof topLists.value],
        valueKey: activeSection.value as keyof SongStats,
        showMode: activeSubTab.value
    }
})

const radarDiffData = computed(() => {
    if (!lastRadarData.value) return null
    return {
        daigouryoku: radarData.value.daigouryoku - lastRadarData.value.daigouryoku,
        stamina: radarData.value.stamina - lastRadarData.value.stamina,
        speed: radarData.value.speed - lastRadarData.value.speed,
        accuracy_power: radarData.value.accuracy - lastRadarData.value.accuracy,
        rhythm: radarData.value.rhythm - lastRadarData.value.rhythm,
        complex: radarData.value.complex - lastRadarData.value.complex
    }
})

const drumrollSpeed = computed(() => {
    return calculateDrumrollSpeedB20(filteredSongStats.value, duplicateSongs)
})


const changedSongs = computed(() => {
    const list = topLists.value.rating as SongStats[]
    return list
        .filter(song => {
            const ratingDiff = song._ratingDiff ?? 0
            if (Math.abs(ratingDiff) >= 0.01) return true
            const diffs = song._dimensionDiffs
            if (!diffs) return false
            return (Object.values(diffs) as number[]).some(v => Math.abs(v) >= 0.01)
        })
        .sort((a, b) => (b._ratingDiff ?? 0) - (a._ratingDiff ?? 0))
})

</script>

<template>
    <div
        class="ffxiv-ui__panel bg-white/80 shadow-sm backdrop-blur-xl mx-auto p-8 max-md:p-4 border border-black/5 rounded-[32px] max-w-[1100px] min-h-[600px]">
        <div v-if="notice" class="my-10 font-medium text-[#8E8E93] text-center">{{ notice }}</div>

        <div v-else class="flex max-md:flex-col gap-8 min-h-[500px]">
            <!-- Sidebar -->
            <div
                class="flex flex-col flex-shrink-0 max-md:mb-6 pr-6 max-md:pr-0 max-md:pb-4 border-black/5 border-r max-md:border-r-0 max-md:border-b w-[220px] max-md:w-full">
                <div class="max-md:flex flex-1 max-md:gap-2 max-md:pb-2 max-md:overflow-x-auto custom-scrollbar">
                    <div v-for="item in menuItems" :key="item.id"
                        class="mb-1.5 max-md:mb-0 px-5 py-3 rounded-2xl font-semibold text-sm max-md:whitespace-nowrap active:scale-[0.98] transition-all duration-200 cursor-pointer"
                        :class="activeSection === item.id ? 'bg-[#007AFF] text-white shadow-sm' : 'text-[#1D1D1F] hover:bg-black/5'"
                        @click="activeSection = item.id">
                            {{ item.label }}
                        </div>
                </div>
            </div>

            <!-- Content Area -->
            <div class="relative flex-1 min-w-0">
                <!-- Overview Section -->
                <div v-if="activeSection === 'overview'" class="flex flex-col items-center">
                    <div class="mb-8 w-full text-center">
                        <h1 class="m-0 font-bold text-[#1D1D1F] text-3xl tracking-tight">{{ t('report.ratingRadar') }}</h1>
                    </div>

                    <!-- Rating + radar dimension deltas combined summary -->
                    <div class="mb-8 w-full max-w-[700px]">
                        <div class="flex flex-col md:flex-row gap-4 md:items-stretch">
                            <!-- Overall Rating card on the left -->
                            <div class="flex justify-center md:justify-start md:w-[220px]">
                                <div class="bg-black/5 p-6 rounded-[24px] min-w-[160px] text-center md:min-w-[200px] w-full flex flex-col items-center justify-center h-full border border-black/5">
                                    <div class="font-semibold text-[#8E8E93] text-sm uppercase tracking-wider">Rating</div>
                                    <div class="mt-1 font-bold text-[#007AFF] text-[40px] leading-none">
                                        {{ overallRating.toFixed(2) }}
                                    </div>
                                    <div v-if="lastOverallRating > 0">
                                        <div v-if="Math.abs(overallRating - lastOverallRating) >= 0.01"
                                            class="mt-2 font-bold text-sm"
                                            :class="overallRating >= lastOverallRating ? 'text-[#34C759]' : 'text-[#FF3B30]'">
                                            {{ overallRating >= lastOverallRating ? '+' : '-' }}
                                            {{ Math.abs(overallRating - lastOverallRating).toFixed(2) }}
                                        </div>
                                        <div v-else class="mt-2 font-semibold text-xs text-[#8E8E93]">
                                            {{ t('report.noChange') }}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Six-dimension cards on the right -->
                            <div class="flex-1" v-if="radarDiffData">
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                                    <div
                                        v-for="key in radarDimensionKeys"
                                        :key="key"
                                        class="bg-black/5 rounded-[24px] px-4 py-3 border border-black/5 text-center flex flex-col items-center justify-center h-full">
                                        <div class="font-semibold text-[#8E8E93] text-sm uppercase tracking-wider mb-1">
                                            {{ radarDimensionLabel(key) }}
                                        </div>
                                        <div class="font-bold text-[#007AFF] text-2xl leading-none mb-1">
                                            {{ radarCurrentValue(key).toFixed(2) }}
                                        </div>
                                        <div v-if="Math.abs(radarDiffData[key]) >= 0.01"
                                            class="mt-1 font-bold text-sm opacity-80"
                                            :class="radarDiffData[key] >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'">
                                            {{ radarDiffData[key] >= 0 ? '+' : '-' }}
                                            {{ Math.abs(radarDiffData[key]).toFixed(2) }}
                                        </div>
                                        <div v-else class="mt-1 font-semibold text-xs text-[#8E8E93] opacity-80">
                                            {{ t('report.noChange') }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex justify-start items-center gap-3 bg-black/5 mt-3 px-6 py-3 border border-black/5 rounded-[24px] text-left whitespace-nowrap">
                            <span class="font-semibold text-[#8E8E93] text-sm uppercase tracking-wider">{{ t('report.drumrollSpeed') }} B20</span>
                            <span class="font-bold text-[#007AFF] text-sm leading-none">{{ drumrollSpeed?.toFixed(2) ?? '-' }}</span>
                            <span class="font-semibold text-[#8E8E93] text-sm">{{ t('report.hitsPerSecond') }}</span>
                            <details ref="drumrollHintRef" class="group relative">
                                <summary
                                    class="flex justify-center items-center bg-[#007AFF]/10 hover:bg-[#007AFF]/20 border border-[#007AFF]/40 rounded-full w-5 h-5 font-bold text-[#007AFF] text-xs leading-none list-none transition-colors cursor-pointer select-none"
                                    :aria-label="t('report.drumrollSpeedHintLabel')"
                                >?</summary>
                                <div class="top-full right-0 z-20 absolute bg-white shadow-xl mt-2 p-3 border border-black/10 rounded-xl w-[280px] font-normal text-[#636366] text-xs leading-relaxed text-left normal-case tracking-normal whitespace-normal">
                                    {{ t('report.drumrollSpeedHint') }}
                                </div>
                            </details>
                        </div>
                    </div>

                    <div class="w-full max-w-[700px] h-[450px]">
                        <RadarChart :labels="radarLabels" :values="radarValues" />
                    </div>

                    <!-- Changed songs list -->
                    <div class="mt-7 w-full">
                        <div class="flex items-center justify-between mb-3">
                            <h2 class="font-bold text-[#1D1D1F] text-lg tracking-tight flex items-center gap-2">{{ t('report.changedSongs') }}<span class="w-px h-4 bg-black/15 rounded-full inline-block"></span><span class="inline-flex items-center bg-black/8 rounded-full px-2.5 py-0.5 text-sm font-semibold text-[#8E8E93]">{{ changedSongs.length }}{{ t('report.changedSongsUnit') }}</span></h2>
                        </div>
                        <div v-if="changedSongs.length" class="overflow-x-auto">
                            <div class="min-w-max">
                                <!-- Header row -->
                                <div class="flex items-center px-3 py-1.5 mb-1">
                                    <div class="w-44 shrink-0"></div>
                                    <div
                                        v-for="dKey in tableDimensionKeys"
                                        :key="dKey"
                                        class="w-16 text-center text-[11px] font-medium text-[#8E8E93] uppercase tracking-wide"
                                    >{{ dimensionColumnLabel(dKey) }}</div>
                                </div>
                                <!-- Song rows -->
                                <div
                                    v-for="(song, i) in changedSongs"
                                    :key="song.id + '-' + song.level"
                                    class="flex items-center px-3 py-2.5 rounded-xl"
                                    :class="i % 2 === 0 ? 'bg-black/[0.04]' : ''"
                                >
                                    <!-- Title -->
                                    <div class="w-44 shrink-0 flex items-center gap-1.5 pr-3">
                                        <span class="font-semibold text-sm text-[#1D1D1F] truncate">{{ song.title }}</span>
                                        <span v-if="song._isNew" class="shrink-0 bg-[#FF3B30] px-1.5 py-0.5 rounded-full font-bold text-[9px] text-white leading-none">NEW</span>
                                    </div>
                                    <!-- Dimension cells -->
                                    <div
                                        v-for="dKey in tableDimensionKeys"
                                        :key="dKey"
                                        class="w-16 flex flex-col items-center"
                                    >
                                        <span class="font-mono text-sm font-semibold leading-none"
                                            :class="isAboveOverall(song, dKey) ? 'text-[#1D1D1F]' : 'text-[#C7C7CC]'"
                                        >{{ getSongDimensionValue(song, dKey).toFixed(2) }}</span>
                                        <span
                                            v-if="Math.abs(getSongDimensionDiff(song, dKey)) >= 0.01"
                                            class="mt-0.5 text-[11px] font-bold leading-none"
                                            :class="isAboveOverall(song, dKey)
                                                ? (getSongDimensionDiff(song, dKey) > 0 ? 'text-[#34C759]' : 'text-[#FF3B30]')
                                                : 'text-[#C7C7CC]'"
                                        >{{ getSongDimensionDiff(song, dKey) > 0 ? '+' : '-' }}{{ Math.abs(getSongDimensionDiff(song, dKey)).toFixed(2) }}</span>
                                        <span v-else class="mt-0.5 text-[11px] leading-none text-[#C7C7CC]">—</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-else class="text-center text-[#8E8E93] text-xs sm:text-sm py-5">
                            {{ t('report.noChange') }}
                        </div>
                    </div>
                </div>

                <!-- Top Tables -->
                <div v-else-if="currentTableData">
                    <!-- Sub Tabs (Segmented Control Style) -->
                    <div class="inline-flex bg-black/5 mb-8 p-1 rounded-full">
                        <button 
                            class="px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200"
                            :class="activeSubTab === 'top' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F]'"
                            @click="activeSubTab = 'top'"
                        >
                            {{ t('report.top') }}
                        </button>
                        <button 
                            class="px-6 py-2 rounded-full font-semibold text-sm transition-all duration-200"
                            :class="activeSubTab === 'recommend' ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#8E8E93] hover:text-[#1D1D1F]'"
                            @click="activeSubTab = 'recommend'"
                        >
                            {{ t('report.recommend') }}
                        </button>
                    </div>

                    <TopTable :title="currentTableData.title" :data="currentTableData.data"
                        :valueKey="currentTableData.valueKey" :showMode="currentTableData.showMode" />
                </div>
            </div>
        </div>
    </div>
</template>
