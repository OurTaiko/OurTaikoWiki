<script setup lang="ts">
import type { SongsDatabase, SongStats, UserScore, RatingDimensions } from '@/types'
import EditScoreModal from '@components/EditScoreModal.vue'
import { loadSongsData } from '@data/songs'
import { calculateSongStats, MAX_CONSTANT_VALUE, parsePastedScores, calcMaxRatings } from '@utils/calculator'
import { difficultyBadgeMap, difficultyMap } from '@utils/difficulty'
import { eventBus } from '@utils/eventBus'
import { expandSongsDatabase, findSongByIdLevel } from '@utils/songHelpers'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
interface SongRow {
  id: string
  title: string
  title_cn?: string
  level: number
  constant: number
  isCn: boolean
  userScore?: UserScore
  stats?: SongStats
  maxRatings?: RatingDimensions
  drumrollSpeed?: number
}

type SortKey = 'title' | 'constant' | 'score' | 'rating' | 'great' | 'good' | 'bad' | 'drumrollSpeed' | 'combo' | 'updatedAt'
  | 'maxRating' | 'maxDaigouryoku' | 'maxStamina' | 'maxSpeed' | 'maxAccuracy' | 'maxRhythm' | 'maxComplex'

const calculateDrumrollSpeed = (score: UserScore | undefined, rollSeconds: number | undefined, balloonCount: number | undefined) => {
  if (!score || !rollSeconds || rollSeconds <= 0) return undefined
  return Math.max(0, (score.drumroll - (balloonCount ?? 0)) / rollSeconds)
}

const store = useScoreStore()
const songs = ref<SongRow[]>([])
const allSongs = ref<SongRow[]>([])
const songsDB = ref<SongsDatabase | null>(null)
const loading = ref(true)
const searchTerm = ref('')
const onlyCnSongs = ref(false)

// Edit Modal State
const showEditModal = ref(false)
const editingSong = ref<SongRow | null>(null)

const editingSongData = computed(() => {
  if (!editingSong.value || !songsDB.value) return undefined
  const [idStr, levelStr] = editingSong.value.id.split('-')
  const id = parseInt(idStr)
  const level = parseInt(levelStr) as 4 | 5
  const result = findSongByIdLevel(songsDB.value, id, level)
  return result?.levelData
})

const openEditModal = (song: SongRow) => {
  editingSong.value = song
  showEditModal.value = true
}

const closeEditModal = () => {
  showEditModal.value = false
  editingSong.value = null
}

const updateLocalStorage = async (newScore: UserScore) => {
  const scoreData = localStorage.getItem('taikoScoreData') || '[]'
  let scores: UserScore[]
  try {
    scores = parsePastedScores(scoreData, 'taikoScoreData')
  } catch (e) {
    scores = []
  }

  scores = scores.filter(s => !(s.id === newScore.id && s.level === newScore.level))
  scores.push(newScore)

  localStorage.setItem('taikoScoreData', JSON.stringify(scores))

  // Update store
  await store.init(true)
}

const removeFromLocalStorage = async (id: number, level: number) => {
  const scoreData = localStorage.getItem('taikoScoreData') || '[]'
  let scores: UserScore[]
  try {
    scores = parsePastedScores(scoreData, 'taikoScoreData')
  } catch (e) {
    scores = []
  }

  scores = scores.filter(s => !(s.id === id && s.level === level))

  localStorage.setItem('taikoScoreData', JSON.stringify(scores))

  // Update store
  await store.init(true)
}

const handleSaveScore = (scoreData: Partial<UserScore>) => {
  if (!editingSong.value) return

  const song = editingSong.value
  const [idStr, levelStr] = song.id.split('-')
  const id = parseInt(idStr)
  const level = parseInt(levelStr)
  
  const newScore: UserScore = {
    id,
    level,
    score: scoreData.score || 0,
    scoreRank: 0, 
    great: scoreData.great || 0,
    good: scoreData.good || 0,
    bad: scoreData.bad || 0,
    drumroll: scoreData.drumroll || 0,
    combo: scoreData.combo || 0,
    playCount: song.userScore?.playCount || 1,
    clearCount: song.userScore?.clearCount || 0,
    fullcomboCount: (scoreData.bad || 0) > 0 ? 0 : (song.userScore?.fullcomboCount || 0),
    perfectCount: ((scoreData.good || 0) > 0 || (scoreData.bad || 0) > 0) ? 0 : (song.userScore?.perfectCount || 0),
    updatedAt: new Date().toISOString()
  }
  
  song.userScore = newScore
  
  // Recalculate stats
  if (songsDB.value) {
     const result = findSongByIdLevel(songsDB.value, id, level as 4 | 5)
     if (result) {
        const stats = calculateSongStats(result.levelData, newScore, result.song.title, store.ratingAlgorithm.value)
        if (stats) {
           song.stats = stats
        }
        song.drumrollSpeed = calculateDrumrollSpeed(newScore, result.levelData.rollSeconds, result.levelData.balloonCount)
     }
  }

  updateLocalStorage(newScore)
  closeEditModal()
}

const handleClearScore = () => {
  if (!editingSong.value) return
  
  const song = editingSong.value
  const [idStr, levelStr] = song.id.split('-')
  const id = parseInt(idStr)
  const level = parseInt(levelStr)

  song.userScore = undefined
  song.stats = undefined
  song.drumrollSpeed = undefined
  
  removeFromLocalStorage(id, level)
  closeEditModal()
}

// Filter State
const showFilter = ref(false)
const showMaxRatings = ref(false)
const minConstant = ref(1.0)
const maxConstant = ref(MAX_CONSTANT_VALUE)
const limitMin = ref(1.0)
const limitMax = ref(MAX_CONSTANT_VALUE)

const statusFilters = ref({
  filterPlayed: false,
  filterNotPlayed: false,
  filterCleared: false,
  filterNotCleared: false,
  filterFC: false,
  filterNotFC: false,
  filterAP: false,
  filterNotAP: false
})

const copySuccess = ref(false)

async function copyDataToClipboard() {
  try {
    const scoreData = localStorage.getItem('taikoScoreData') || ''
    if (!scoreData) {
      alert('没有可复制的数据')
      return
    }
    
    await navigator.clipboard.writeText(scoreData)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (err) {
    console.error('复制失败:', err)
    alert('复制失败，请手动复制数据')
  }
}

// Slider Logic
const minPos = computed(() => {
  return ((minConstant.value - limitMin.value) / (limitMax.value - limitMin.value)) * 100
})
const maxPos = computed(() => {
  return ((maxConstant.value - limitMin.value) / (limitMax.value - limitMin.value)) * 100
})

watch(minConstant, (v) => {
  if (v > maxConstant.value) minConstant.value = maxConstant.value
})
watch(maxConstant, (v) => {
  if (v < minConstant.value) maxConstant.value = minConstant.value
})

watch(() => store.ratingAlgorithm.value, () => {
  // Recalculate stats and maxRatings for all songs when algorithm changes
  allSongs.value = allSongs.value.map(song => {
    const [idStr, levelStr] = song.id.split('-')
    const id = parseInt(idStr)
    const level = parseInt(levelStr) as 4 | 5
    const result = findSongByIdLevel(songsDB.value!, id, level)
    if (!result) return song
    const maxRatings = calcMaxRatings(result.levelData, store.ratingAlgorithm.value)
    if (song.userScore) {
      const stats = calculateSongStats(result.levelData, song.userScore, song.title, store.ratingAlgorithm.value)
      return { ...song, stats: stats || undefined, maxRatings }
    }
    return { ...song, maxRatings }
  })
  applyCnFilter()
})

onMounted(async () => {
  // 从 localStorage 读取设置
  const savedSetting = localStorage.getItem('onlyCnSongs')
  if (savedSetting !== null) {
    onlyCnSongs.value = savedSetting === 'true'
  }

  // 监听国服筛选变化
  eventBus.on('cn-filter-changed', handleCnFilterChange)

  try {
    const db = await loadSongsData()
    songsDB.value = db
    const scoreInput = localStorage.getItem('taikoScoreData') || ''
    const userScores = scoreInput ? parsePastedScores(scoreInput, 'taikoScoreData') : []
    
    const scoreMap = new Map<string, UserScore>()
    userScores.forEach(s => {
      scoreMap.set(`${s.id}-${s.level}`, s)
    })

    const rows: SongRow[] = []
    const expandedEntries = expandSongsDatabase(db)
    
    for (const entry of expandedEntries) {
      const key = `${entry.id}-${entry.level}`
      const score = scoreMap.get(key)
      let stats: SongStats | undefined
      
      if (score) {
        const calculated = calculateSongStats(entry.data, score, entry.title, store.ratingAlgorithm.value)
        if (calculated) {
          stats = calculated
        }
      }

      const song = db.find(s => s.id === entry.id)

      rows.push({
        id: key,
        title: entry.title,
        title_cn: song?.title_cn,
        level: entry.level,
        constant: entry.data.constant,
        isCn: song?.is_cn || false,
        userScore: score,
        stats: stats,
        maxRatings: calcMaxRatings(entry.data, store.ratingAlgorithm.value),
        drumrollSpeed: calculateDrumrollSpeed(score, entry.data.rollSeconds, entry.data.balloonCount)
      })
    }
    
    // Sort by default (maybe by title or constant?)
    rows.sort((a, b) => b.constant - a.constant)
    
    allSongs.value = rows
    applyCnFilter()
    
    // Calculate min/max constant
    if (rows.length > 0) {
      let min = rows[0].constant
      let max = rows[0].constant
      rows.forEach(r => {
        if (r.constant < min) min = r.constant
        if (r.constant > max) max = r.constant
      })
      minConstant.value = Math.floor(min)
      maxConstant.value = Math.ceil(max)
      limitMin.value = Math.floor(min)
      limitMax.value = Math.ceil(max)
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  eventBus.off('cn-filter-changed', handleCnFilterChange)
})

function handleCnFilterChange(value: boolean) {
  onlyCnSongs.value = value
  applyCnFilter()
}

function applyCnFilter() {
  if (onlyCnSongs.value) {
    // 筛选国服曲目
    songs.value = allSongs.value.filter(song => song.isCn)
  } else {
    songs.value = allSongs.value
  }
}

const sortKey = ref<SortKey>('constant')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Tooltip Logic
const tooltipVisible = ref(false)
const tooltipStats = ref<SongStats | null>(null)
const tooltipStyle = ref({ top: '0px', left: '0px' })

const showTooltip = (e: MouseEvent, stats: SongStats) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  
  tooltipStats.value = stats
  tooltipVisible.value = true
  tooltipStyle.value = {
    top: `${rect.top + rect.height / 2}px`,
    left: `${rect.right + 12}px`
  }
}

const hideTooltip = () => {
  tooltipVisible.value = false
}

const toggleSort = (key: SortKey) => {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

const filteredSongs = computed(() => {
  let list = songs.value
  
  // 1. Search Filter
  if (searchTerm.value) {
    const term = searchTerm.value.toLowerCase()
    list = list.filter(s => s.title.toLowerCase().includes(term) || s.title_cn?.toLowerCase().includes(term))
  }
  
  // 2. Constant Range Filter
  list = list.filter(s => s.constant >= minConstant.value && s.constant <= maxConstant.value)
  
  // 3. Status Filters
  list = list.filter(s => {
    const score = s.userScore
    const isPlayed = !!score && (score.playCount > 0 || score.score > 0) // Fallback to score > 0 if playCount is missing
    const isCleared = !!score && score.clearCount > 0
    const isFC = !!score && score.fullcomboCount > 0
    const isAP = !!score && score.perfectCount > 0
    
    // Played Filter - 如果两个都没勾选，则不筛选（等同于都勾选）
    if (statusFilters.value.filterPlayed || statusFilters.value.filterNotPlayed) {
      if (!((isPlayed && statusFilters.value.filterPlayed) || (!isPlayed && statusFilters.value.filterNotPlayed))) return false
    }
    
    // Cleared Filter - 如果两个都没勾选，则不筛选
    if (statusFilters.value.filterCleared || statusFilters.value.filterNotCleared) {
      if (!((isCleared && statusFilters.value.filterCleared) || (!isCleared && statusFilters.value.filterNotCleared))) return false
    }
    
    // FC Filter - 如果两个都没勾选，则不筛选
    if (statusFilters.value.filterFC || statusFilters.value.filterNotFC) {
      if (!((isFC && statusFilters.value.filterFC) || (!isFC && statusFilters.value.filterNotFC))) return false
    }
    
    // AP Filter - 如果两个都没勾选，则不筛选
    if (statusFilters.value.filterAP || statusFilters.value.filterNotAP) {
      if (!((isAP && statusFilters.value.filterAP) || (!isAP && statusFilters.value.filterNotAP))) return false
    }
    
    return true
  })
  
  return list.sort((a, b) => {
    let valA: number | string = 0
    let valB: number | string = 0
    
    switch (sortKey.value) {
      case 'title':
        return sortOrder.value === 'asc' 
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title)
      case 'constant':
        valA = a.constant
        valB = b.constant
        break
      case 'score':
        valA = a.userScore?.score ?? -1
        valB = b.userScore?.score ?? -1
        break
      case 'rating':
        valA = a.stats?.rating ?? -1
        valB = b.stats?.rating ?? -1
        break
      case 'great':
        valA = a.userScore?.great ?? -1
        valB = b.userScore?.great ?? -1
        break
      case 'good':
        valA = a.userScore?.good ?? -1
        valB = b.userScore?.good ?? -1
        break
      case 'bad':
        valA = a.userScore?.bad ?? -1
        valB = b.userScore?.bad ?? -1
        break
      case 'drumrollSpeed':
        valA = a.drumrollSpeed ?? -1
        valB = b.drumrollSpeed ?? -1
        break
      case 'combo':
        valA = a.userScore?.combo ?? -1
        valB = b.userScore?.combo ?? -1
        break
      case 'updatedAt':
        // 使用时间戳进行排序，没有记录的排在最后
        valA = a.userScore?.updatedAt ? new Date(a.userScore.updatedAt).getTime() : 0
        valB = b.userScore?.updatedAt ? new Date(b.userScore.updatedAt).getTime() : 0
        break
      case 'maxRating':
        valA = a.maxRatings?.rating ?? -1
        valB = b.maxRatings?.rating ?? -1
        break
      case 'maxDaigouryoku':
        valA = a.maxRatings?.daigouryoku ?? -1
        valB = b.maxRatings?.daigouryoku ?? -1
        break
      case 'maxStamina':
        valA = a.maxRatings?.stamina ?? -1
        valB = b.maxRatings?.stamina ?? -1
        break
      case 'maxSpeed':
        valA = a.maxRatings?.speed ?? -1
        valB = b.maxRatings?.speed ?? -1
        break
      case 'maxAccuracy':
        valA = a.maxRatings?.accuracy_power ?? -1
        valB = b.maxRatings?.accuracy_power ?? -1
        break
      case 'maxRhythm':
        valA = a.maxRatings?.rhythm ?? -1
        valB = b.maxRatings?.rhythm ?? -1
        break
      case 'maxComplex':
        valA = a.maxRatings?.complex ?? -1
        valB = b.maxRatings?.complex ?? -1
        break
    }
    
    if (valA === valB) return 0
    const result = valA > valB ? 1 : -1
    return sortOrder.value === 'asc' ? result : -result
  })
})

const currentPage = ref(1)
const pageSize = ref(20)

const totalPages = computed(() => Math.ceil(filteredSongs.value.length / pageSize.value))

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredSongs.value.slice(start, end)
})

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const delta = 2
  const left = currentPage.value - delta
  const right = currentPage.value + delta + 1
  
  for (let i = 1; i <= totalPages.value; i++) {
    if (i === 1 || i === totalPages.value || (i >= left && i < right)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return pages
})

// Reset to page 1 when filters change
watch([searchTerm, minConstant, maxConstant, statusFilters, onlyCnSongs, sortKey, sortOrder], () => {
  currentPage.value = 1
}, { deep: true })
</script>

<template>
  <div class="ffxiv-ui__workspace mx-auto p-8 max-md:p-4 max-w-[1300px]">
    <div class="mb-8">
      <div class="flex max-md:flex-col items-center max-md:items-stretch gap-4">
        <div class="relative flex-1 max-w-[400px]">
          <i class="top-1/2 left-4 absolute text-[#8E8E93] -translate-y-1/2 fas fa-search"></i>
          <input v-model="searchTerm" :placeholder="t('common.search')" class="bg-black/5 focus:bg-white px-10 py-2.5 border-none rounded-full outline-none focus:ring-[#007AFF]/20 focus:ring-2 w-full text-base transition-all" />
        </div>
        
        <div class="relative">
          <button @click="showFilter = !showFilter" class="flex items-center gap-2 bg-black/5 hover:bg-black/10 px-6 py-2.5 rounded-full font-semibold text-[#1D1D1F] text-sm active:scale-95 transition-all cursor-pointer">
            <i class="text-xs fas fa-filter"></i>
            {{ t('common.filter') }}
          </button>
          
          <div v-if="showFilter" class="top-full right-0 z-[100] absolute bg-white/90 shadow-2xl backdrop-blur-xl mt-3 p-6 border border-black/5 rounded-[24px] w-[320px]">
            <div class="mb-6">
              <h3 class="m-0 mb-4 font-bold text-[#1D1D1F] text-sm">{{ t('filter.range') }}: {{ minConstant.toFixed(1) }} - {{ maxConstant.toFixed(1) }}</h3>
              <div class="relative mb-2 w-full h-6">
                <div class="top-1/2 absolute bg-black/5 rounded-full w-full h-1.5 -translate-y-1/2"></div>
                <div class="top-1/2 z-[1] absolute bg-[#007AFF] h-1.5 -translate-y-1/2" :style="{ left: minPos + '%', width: (maxPos - minPos) + '%' }"></div>
                <input 
                  type="range" 
                  v-model.number="minConstant" 
                  :min="limitMin" 
                  :max="limitMax" 
                  step="0.1" 
                  class="top-1/2 left-0 z-[2] absolute [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md m-0 [&::-webkit-slider-thumb]:rounded-full w-full [&::-webkit-slider-thumb]:w-5 h-0 [&::-webkit-slider-thumb]:h-5 appearance-none [&::-webkit-slider-thumb]:appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto" 
                />
                <input 
                  type="range" 
                  v-model.number="maxConstant" 
                  :min="limitMin" 
                  :max="limitMax" 
                  step="0.1" 
                  class="top-1/2 left-0 z-[2] absolute [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md m-0 [&::-webkit-slider-thumb]:rounded-full w-full [&::-webkit-slider-thumb]:w-5 h-0 [&::-webkit-slider-thumb]:h-5 appearance-none [&::-webkit-slider-thumb]:appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto" 
                />
              </div>
            </div>
            
            <div class="mb-2">
              <h3 class="m-0 mb-4 font-bold text-[#1D1D1F] text-sm">{{ t('filter.status') }}</h3>
              <div class="flex flex-col gap-3">
                <div v-for="filter in [
                  { label: t('filter.played'), model: 'filterPlayed', modelNot: 'filterNotPlayed' },
                  { label: t('filter.cleared'), model: 'filterCleared', modelNot: 'filterNotCleared' },
                  { label: t('filter.fullCombo'), model: 'filterFC', modelNot: 'filterNotFC' },
                  { label: t('filter.allPerfect'), model: 'filterAP', modelNot: 'filterNotAP' }
                ]" :key="filter.label" class="flex justify-between items-center text-sm">
                  <span class="font-semibold text-[#1D1D1F]">{{ filter.label }}</span>
                  <div class="flex gap-4">
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" v-model="statusFilters[filter.model as keyof typeof statusFilters]" class="accent-[#007AFF]"> {{ t('common.yes') }}
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" v-model="statusFilters[filter.modelNot as keyof typeof statusFilters]" class="accent-[#007AFF]"> {{ t('common.no') }}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 pt-4 border-black/5 border-t">
              <label class="flex justify-between items-center cursor-pointer">
                <span class="font-semibold text-[#1D1D1F] text-sm">{{ t('filter.showMaxRatings') }}</span>
                <div class="relative">
                  <input type="checkbox" v-model="showMaxRatings" class="sr-only" />
                  <div class="rounded-full w-10 h-6 transition-colors" :class="showMaxRatings ? 'bg-[#007AFF]' : 'bg-black/15'"></div>
                  <div class="top-1 left-1 absolute bg-white shadow rounded-full w-4 h-4 transition-transform" :class="showMaxRatings ? 'translate-x-4' : 'translate-x-0'"></div>
                </div>
              </label>
            </div>
          </div>
        </div>

        <button @click="copyDataToClipboard" class="bg-[#007AFF] hover:bg-[#0071e3] px-6 py-2.5 rounded-full font-semibold text-white text-sm active:scale-95 transition-all cursor-pointer" :class="{ 'bg-[#34C759]': copySuccess }">
          {{ copySuccess ? '✓ ' + t('common.copied') : t('common.copy') }}
        </button>
        <span class="font-semibold text-[#8E8E93] text-sm">共 {{ filteredSongs.length }} 首</span>
      </div>
    </div>
    
    <div v-if="loading" class="py-20 text-center">
      <div class="inline-block border-[#007AFF] border-[3px] border-t-transparent rounded-full w-10 h-10 animate-spin"></div>
      <p class="mt-4 font-medium text-[#8E8E93]">{{ t('common.loading') }}</p>
    </div>
    
    <div v-else class="bg-white shadow-sm border border-black/5 rounded-[24px] overflow-x-auto">
      <table class="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th @click="toggleSort('title')" class="after:right-0 md:left-0 after:absolute md:sticky after:inset-y-0 bg-[#F2F2F2] after:bg-black/[0.08] hover:bg-[#E8E8E8] p-4 after:w-px font-bold text-[#1D1D1F] text-left after:content-[''] whitespace-nowrap transition-colors cursor-pointer after:pointer-events-none select-none">
              {{ t('topTable.songTitle') }} <span v-if="sortKey === 'title'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap select-none">{{ t('rating.difficulty') }}</th>
            <th @click="toggleSort('constant')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.level') }} <span v-if="sortKey === 'constant'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxRating')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxRating') }} <span v-if="sortKey === 'maxRating'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxDaigouryoku')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxDaigouryoku') }} <span v-if="sortKey === 'maxDaigouryoku'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxStamina')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxStamina') }} <span v-if="sortKey === 'maxStamina'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxSpeed')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxSpeed') }} <span v-if="sortKey === 'maxSpeed'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxAccuracy')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxAccuracy') }} <span v-if="sortKey === 'maxAccuracy'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxRhythm')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxRhythm') }} <span v-if="sortKey === 'maxRhythm'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="showMaxRatings" @click="toggleSort('maxComplex')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('songs.maxComplex') }} <span v-if="sortKey === 'maxComplex'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('score')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.score') }} <span v-if="sortKey === 'score'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('rating')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              Rating <span v-if="sortKey === 'rating'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('great')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.good') }} <span v-if="sortKey === 'great'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('good')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.ok') }} <span v-if="sortKey === 'good'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('bad')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.bad') }} <span v-if="sortKey === 'bad'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('drumrollSpeed')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.drumrollSpeed') }} <span v-if="sortKey === 'drumrollSpeed'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th @click="toggleSort('updatedAt')" class="bg-black/5 hover:bg-black/10 p-4 font-bold text-[#1D1D1F] text-left whitespace-nowrap transition-colors cursor-pointer select-none">
              {{ t('rating.lastPlay') }} <span v-if="sortKey === 'updatedAt'" class="ml-1">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="song in paginatedSongs" :key="song.id" @click="openEditModal(song)" class="group hover:bg-black/[0.02] transition-colors cursor-pointer">
            <td class="after:right-0 md:left-0 md:z-[1] after:absolute md:sticky after:inset-y-0 bg-[#FFFFFF] after:bg-black/[0.08] group-hover:bg-[#FAFAFA] p-4 border-black/5 border-b after:w-px min-w-[200px] font-semibold text-[#1D1D1F] text-left after:content-[''] transition-colors after:pointer-events-none">
              {{ (onlyCnSongs && song.title_cn) ? song.title_cn : song.title }}
              <span class="ml-1 font-normal text-[#8E8E93] text-xs">{{ difficultyMap[song.level] || '' }}</span>
            </td>
            <td class="p-4 border-black/5 border-b text-left">
              <span class="px-2.5 py-1 rounded-full font-bold text-[10px] text-white uppercase tracking-wider" :class="{
                'bg-[#34C759]': song.level === 1,
                'bg-[#AF52DE]': song.level === 2,
                'bg-[#FF9500]': song.level === 3,
                'bg-[#FF3B30]': song.level === 4,
                'bg-[#5856D6]': song.level === 5
              }">
                {{ difficultyBadgeMap[song.level] || song.level }}
              </span>
            </td>
            <td class="p-4 border-black/5 border-b font-mono text-left">{{ song.constant.toFixed(1) }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.rating.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.daigouryoku.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.stamina.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.speed.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.accuracy_power.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.rhythm.toFixed(2) ?? '-' }}</td>
            <td v-if="showMaxRatings" class="p-4 border-black/5 border-b font-mono text-left">{{ song.maxRatings?.complex.toFixed(2) ?? '-' }}</td>
            <td class="p-4 border-black/5 border-b font-mono text-left">{{ song.userScore?.score ?? '-' }}</td>
            <td 
              :class="{ 'text-[#007AFF] font-bold': song.stats }" 
              class="relative p-4 border-black/5 border-b font-mono text-left"
              @mouseenter="song.stats && showTooltip($event, song.stats)"
              @mouseleave="hideTooltip"
            >
              {{ song.stats?.rating.toFixed(2) || '-' }}
            </td>
            <td class="p-4 border-black/5 border-b font-mono text-left">{{ song.userScore?.great ?? '-' }}</td>
            <td class="p-4 border-black/5 border-b font-mono text-left">{{ song.userScore?.good ?? '-' }}</td>
            <td class="p-4 border-black/5 border-b font-mono text-left">{{ song.userScore?.bad ?? '-' }}</td>
            <td class="p-4 border-black/5 border-b font-mono text-left" :class="{ 'text-[#8E8E93]': song.drumrollSpeed !== undefined && song.drumrollSpeed > 60 }">
              {{ song.drumrollSpeed?.toFixed(2) ?? '-' }}
            </td>
            <td class="p-4 border-black/5 border-b text-[#8E8E93] text-xs text-left">{{ song.userScore?.updatedAt ? new Date(song.userScore.updatedAt).toLocaleDateString('zh-CN') : '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex flex-wrap justify-center items-center gap-2 mt-8">
      <button 
        @click="currentPage--" 
        :disabled="currentPage === 1"
        class="flex justify-center items-center bg-white/50 hover:bg-white/80 disabled:opacity-30 backdrop-blur-sm border border-black/5 rounded-full w-10 h-10 transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        <i class="fa-chevron-left fas"></i>
      </button>
      
      <div class="flex items-center gap-1">
        <template v-for="(p, index) in visiblePages" :key="index">
          <span v-if="p === '...'" class="px-2 text-[#8E8E93]">...</span>
          <button 
            v-else
            @click="currentPage = p as number"
            :class="[
              'w-10 h-10 rounded-full font-semibold text-sm transition-all cursor-pointer flex items-center justify-center',
              currentPage === p ? 'bg-[#007AFF] text-white shadow-lg shadow-[#007AFF]/20' : 'bg-white/50 hover:bg-white/80 text-[#1D1D1F] border border-black/5'
            ]"
          >
            {{ p }}
          </button>
        </template>
      </div>

      <button 
        @click="currentPage++" 
        :disabled="currentPage === totalPages"
        class="flex justify-center items-center bg-white/50 hover:bg-white/80 disabled:opacity-30 backdrop-blur-sm border border-black/5 rounded-full w-10 h-10 transition-all cursor-pointer disabled:cursor-not-allowed"
      >
        <i class="fa-chevron-right fas"></i>
      </button>

      <div class="ml-4 text-[#8E8E93] text-sm">
        {{ t('common.page', { page: currentPage, total: totalPages }) }}
      </div>
    </div>

    <EditScoreModal
      :show="showEditModal"
      :title="onlyCnSongs? editingSong?.title_cn || '' : editingSong?.title || ''"
      :initial-score="editingSong?.userScore"
      :song-data="editingSongData"
      :song-id="editingSong ? parseInt(editingSong.id.split('-')[0]) : undefined"
      :difficulty="editingSong ? parseInt(editingSong.id.split('-')[1]) : undefined"
      @close="closeEditModal"
      @save="handleSaveScore"
      @clear="handleClearScore"
    />

    <Teleport to="body">
      <Transition name="tooltip-fade">
        <div 
          v-if="tooltipVisible && tooltipStats" 
          class="before:top-1/2 before:right-full z-[9999] fixed before:absolute bg-black/90 px-3 py-2 before:border-[5px] before:border-transparent before:border-r-black/90 rounded text-white text-xs before:content-[''] whitespace-nowrap -translate-y-1/2 before:-translate-y-1/2 pointer-events-none"
          :style="tooltipStyle"
        >
          <div>{{ t('radar.daigouryoku') }}: {{ tooltipStats.daigouryoku.toFixed(2) }}</div>
          <div>{{ t('radar.stamina') }}: {{ tooltipStats.stamina.toFixed(2) }}</div>
          <div>{{ t('radar.speed') }}: {{ tooltipStats.speed.toFixed(2) }}</div>
          <div>{{ t('radar.accuracy') }}: {{ tooltipStats.accuracy_power.toFixed(2) }}</div>
          <div>{{ t('radar.rhythm') }}: {{ tooltipStats.rhythm.toFixed(2) }}</div>
          <div>{{ t('radar.complex') }}: {{ tooltipStats.complex.toFixed(2) }}</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}
</style>
