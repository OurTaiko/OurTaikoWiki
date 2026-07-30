<script setup lang="ts">
import { ref, computed } from 'vue'
import { calculateTaikoRating, calcFullScoreReference, calcCompensatedDim, type SongData, type CalculationInput, type FullScoreRef } from '@utils/rating_v2'
import { calcY, calcSingleRating } from '@utils/calculator'
import RadarChart from '@components/RadarChart.vue'
import { loadV2SongsData, type V2SongMeta } from '@data/v2Songs'

// --- State ---
const songsDB = ref<SongData[]>([])
const songMeta = ref<Map<string, V2SongMeta>>(new Map())
const dbLoading = ref(false)
const dbError = ref('')
const calculating = ref(false)
const entries = ref<Entry[]>([])
const fullScoreRefs = ref<Record<string, FullScoreRef> | null>(null)

type Entry = {
  title: string
  id: number
  level: number
  accuracy: number
  badRate: number
  totalNotes: number
  great: number
  good: number
  bad: number
  rating: number
  stamina_rt: number
  handspeed_rt: number
  burst_rt: number
  complex_rt: number
  rhythm_rt: number
  accuracy_rt: number
  intermediate: {
    burst_hs_factor: number
    complex_penalty: number
    rhythm_burst_factor: number
  }
  songData: SongData | null
}

// --- Sort state ---
const sortKey = ref<string | null>('rating')
const sortDir = ref<'asc' | 'desc'>('desc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

const sortedEntries = computed(() => {
  if (!sortKey.value) return entries.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...entries.value].sort((a: any, b: any) => {
    const va = a[sortKey.value!]
    const vb = b[sortKey.value!]
    if (typeof va === 'string') return va.localeCompare(vb) * dir
    return (va - vb) * dir
  })
})

// --- Selected entry for detail ---
const selectedEntry = ref<Entry | null>(null)

function selectEntry(e: Entry) {
  selectedEntry.value = selectedEntry.value === e ? null : e
}

const selectedDetail = computed(() => {
  const e = selectedEntry.value
  if (!e || !e.songData) return null
  const sd = e.songData

  const y090 = calcY(0.9, 'comprehensive')
  const y095 = calcY(0.95, 'comprehensive')
  const y1 = calcY(1, 'comprehensive')
  const yAcc = calcY(e.accuracy, 'comprehensive')

  const rt_90 = calcSingleRating(sd.sub_constant_1, y090)
  const rt_95_ref = calcSingleRating(sd.sub_constant_1, y095)
  const rt_95 = calcSingleRating(sd.main_constant, y095)
  const rt_100_ref = calcSingleRating(sd.main_constant, y1)
  const rt_100 = calcSingleRating(sd.sub_constant_2, y1)

  const x_ini = e.accuracy <= 0.95 ? sd.sub_constant_1 : sd.main_constant
  const rt_ini = calcSingleRating(x_ini, yAcc)

  let branch: string
  if (e.accuracy <= 0.9) branch = 'acc ≤ 0.9: rating = rt_ini'
  else if (e.accuracy <= 0.95) branch = '0.9 < acc ≤ 0.95: rating = rt_90 + (rt_95 - rt_90) × (rt_ini - rt_90) / (rt_95_ref - rt_90)'
  else branch = 'acc > 0.95: rating = rt_95 + (rt_100 - rt_95) × (rt_ini - rt_95) / (rt_100_ref - rt_95)'

  const im = e.intermediate

  return {
    y090, y095, y1, yAcc,
    rt_90, rt_95_ref, rt_95, rt_100_ref, rt_100, rt_ini,
    branch,
    used_constant: x_ini === sd.sub_constant_1 ? `副定数1 (${sd.sub_constant_1})` : `主定数 (${sd.main_constant})`,
    burst_hs_factor: im.burst_hs_factor,
    complex_penalty: im.complex_penalty,
    rhythm_burst_factor: im.rhythm_burst_factor,
  }
})

// --- Dimension keys for top 20 ---
const DIM_KEYS = ['rating', 'stamina_rt', 'handspeed_rt', 'burst_rt', 'complex_rt', 'rhythm_rt', 'accuracy_rt'] as const
type DimKey = typeof DIM_KEYS[number]
const DIM_LABELS: Record<DimKey, string> = {
  rating: 'Rating',
  stamina_rt: '体力',
  handspeed_rt: '手速',
  burst_rt: '爆发',
  complex_rt: '复合',
  rhythm_rt: '节奏',
  accuracy_rt: '精度',
}

// --- Load constants API ---
async function loadV2Data() {
  dbLoading.value = true
  dbError.value = ''
  try {
    const { songs, meta } = await loadV2SongsData()
    songsDB.value = songs
    songMeta.value = meta
  } catch (e: any) {
    dbError.value = '定数数据加载失败: ' + e.message
  } finally {
    dbLoading.value = false
  }
}

// --- Calculate all songs with perfect accuracy (良=100%, 可=0%, 不可=0%) ---
function calcAllPerfect() {
  calculating.value = true
  const results: Entry[] = []

  for (const song of songsDB.value) {
    const key = `${song.id}-${song.difficulty}`
    const meta = songMeta.value.get(key)
    if (!meta || meta.totalNotes <= 0) continue

    const input: CalculationInput = {
      id: song.id,
      difficulty: song.difficulty,
      accuracy_per: 1.0,
      bad_per: 0,
    }

    const result = calculateTaikoRating(songsDB.value, input)
    if (!result) continue

    results.push({
      title: meta.title || `ID ${song.id}`,
      id: song.id,
      level: song.difficulty,
      accuracy: 1.0,
      badRate: 0,
      totalNotes: meta.totalNotes,
      great: meta.totalNotes,
      good: 0,
      bad: 0,
      rating: result.rating,
      stamina_rt: result.stamina_rt,
      handspeed_rt: result.handspeed_rt,
      burst_rt: result.burst_rt,
      complex_rt: result.complex_rt,
      rhythm_rt: result.rhythm_rt,
      accuracy_rt: result.accuracy_rt,
      intermediate: result.intermediate,
      songData: song,
    })
  }

  entries.value = results.sort((a, b) => b.rating - a.rating)
  // 从全满分结果中提取补偿参考数据
  fullScoreRefs.value = calcFullScoreReference(songsDB.value)
  calculating.value = false
}

// --- Top 20 helpers ---
function getTop20(list: Entry[], key: DimKey): Entry[] {
  const valid = list.filter(e => !isNaN(e[key]))
  return [...valid].sort((a, b) => b[key] - a[key]).slice(0, 20)
}

const top20Summary = computed(() => {
  if (entries.value.length === 0) return null
  const refs = fullScoreRefs.value
  return DIM_KEYS.map(k => {
    const top20 = getTop20(entries.value, k).map(e => e[k])
    const comp = calcCompensatedDim(top20, refs?.[k])
    return {
      key: k,
      label: DIM_LABELS[k],
      avg: comp.playerA,
      compensated: comp.compensated,
      max: top20.length > 0 ? top20[0] : 0,
      count: Math.min(entries.value.length, 20),
      isCompensated: comp.isCompensated,
      playerB: comp.playerB,
      per: comp.per,
      threshold: comp.threshold,
      fullA: comp.fullA,
      fullB: comp.fullB,
    }
  })
})

// --- Radar chart ---
const RADAR_DIM_KEYS = ['stamina_rt', 'handspeed_rt', 'burst_rt', 'accuracy_rt', 'rhythm_rt', 'complex_rt'] as const
const RADAR_DIM_LABELS: string[] = ['体力', '手速', '爆发', '精度', '节奏', '复合']

const radarValues = computed(() => {
  if (entries.value.length === 0 || !top20Summary.value) return [0, 0, 0, 0, 0, 0]
  const summaryMap = new Map(top20Summary.value.map(s => [s.key, s]))
  return RADAR_DIM_KEYS.map(k => {
    const s = summaryMap.get(k)
    return s ? s.compensated : 0
  })
})

// --- Initialize ---
loadV2Data().then(() => {
  calcAllPerfect()
})
</script>

<template>
  <div
    class="bg-white/80 shadow-sm backdrop-blur-xl mx-auto p-8 max-md:p-4 border border-black/5 rounded-[32px] max-w-[1200px] min-h-[600px]">
    <h1 class="mb-6 font-bold text-[#1D1D1F] text-2xl tracking-tight">全曲 Rating 上限 (良100% / 可0% / 不可0%)</h1>

    <!-- CSV load status -->
    <div v-if="dbLoading" class="mb-4 text-[#8E8E93] text-sm">加载定数数据库...</div>
    <div v-else-if="dbError" class="mb-4 text-[#FF3B30] text-sm">{{ dbError }}</div>
    <div v-else-if="calculating" class="mb-4 text-[#8E8E93] text-sm">计算中...</div>
    <div v-else class="mb-4 text-[#34C759] text-sm">定数数据库已加载 ({{ songsDB.length }} 条) / 已计算 {{ entries.length }} 首曲目</div>

    <!-- Results -->
    <div v-if="entries.length > 0">
      <!-- Top 20 Summary -->
      <div v-if="top20Summary" class="mb-8">
        <h2 class="mb-4 font-bold text-[#1D1D1F] text-lg">
          Top 20 加权平均
          <span v-if="fullScoreRefs" class="ml-2 font-normal text-[#34C759] text-xs">补偿机制已启用</span>
        </h2>
        <div class="gap-3 grid grid-cols-2 md:grid-cols-4">
          <div v-for="d in top20Summary" :key="d.key"
            class="p-4 border rounded-[20px] text-center"
            :class="d.isCompensated ? 'bg-[#34C759]/5 border-[#34C759]/20' : 'bg-black/5 border-black/5'">
            <div class="font-semibold text-[#8E8E93] text-xs uppercase tracking-wider">{{ d.label }}</div>
            <!-- 补偿后值 -->
            <div class="mt-1 font-bold text-xl"
              :class="d.isCompensated ? 'text-[#34C759]' : 'text-[#007AFF]'">
              {{ d.compensated.toFixed(2) }}
              <span v-if="d.isCompensated" class="ml-1 text-[#34C759] text-xs">(+{{ (d.compensated - d.avg).toFixed(2) }})</span>
            </div>
            <!-- 原始A值 & B值 -->
            <div class="mt-0.5 text-[#8E8E93] text-[10px]">
              A={{ d.avg.toFixed(2) }} B={{ d.playerB.toFixed(2) }}
            </div>
            <!-- 补偿详情 -->
            <div v-if="d.isCompensated" class="mt-1 text-[#34C759] text-[9px] leading-tight">
              阈值={{ d.threshold.toFixed(2) }} per={{ (d.per * 100).toFixed(1) }}%
            </div>
            <div class="mt-0.5 text-[#8E8E93] text-[10px]">max {{ d.max.toFixed(2) }} / {{ d.count }}首</div>
          </div>
        </div>
        <!-- 补偿公式说明 -->
        <div v-if="fullScoreRefs" class="mt-3 bg-black/[0.02] p-3 border border-black/5 rounded-[12px] text-[#8E8E93] text-[11px] leading-relaxed">
          <span class="font-semibold text-[#1D1D1F]">补偿公式：</span>
          A = 原权重(1-10,10-1)加权平均，B = 20-1权重加权平均<br/>
          当 B ≥ 阈值(满分第40位) 时：per = (B − 阈值) / (满分B − 阈值)<br/>
          补偿后 = A + per × (15.5 − 满分A)
        </div>
      </div>

      <!-- Radar Chart -->
      <div v-if="entries.length > 0" class="mb-8 w-full max-w-[700px] h-[450px] mx-auto">
        <RadarChart :labels="RADAR_DIM_LABELS" :values="radarValues" />
      </div>

      <!-- Full table -->
      <h2 class="mb-3 font-bold text-[#1D1D1F] text-lg">全曲目结果 ({{ entries.length }}首, 按Rating降序)</h2>
      <div class="border border-black/5 rounded-[16px] overflow-auto max-h-[calc(100vh-340px)]">
        <table class="w-full text-xs border-collapse">
          <thead class="sticky top-0 z-10">
            <tr>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-left">#</th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-left cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('title')">
                曲目<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'title' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-left cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('level')">
                难度<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'level' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('rating')">
                Rating<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'rating' ? (sortDir === 'asc' ? '▲' : '▼') : '▼' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('stamina_rt')">
                体力<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'stamina_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('handspeed_rt')">
                手速<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'handspeed_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('burst_rt')">
                爆发<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'burst_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('complex_rt')">
                复合<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'complex_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('rhythm_rt')">
                节奏<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'rhythm_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('accuracy_rt')">
                精度<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'accuracy_rt' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('totalNotes')">
                Notes<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'totalNotes' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in sortedEntries" :key="e.id + '-' + e.level"
              class="hover:bg-black/[0.03] transition-colors cursor-pointer"
              :class="selectedEntry === e ? 'bg-[#007AFF]/5' : ''" @click="selectEntry(e)">
              <td class="p-3 border-black/5 border-b">{{ i + 1 }}</td>
              <td class="p-3 border-black/5 border-b max-w-[200px] font-semibold truncate">{{ e.title }}</td>
              <td class="p-3 border-black/5 border-b">{{ e.level }}</td>
              <td class="p-3 border-black/5 border-b font-mono font-bold text-right">{{ e.rating.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.stamina_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.handspeed_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.burst_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.complex_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.rhythm_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ e.accuracy_rt.toFixed(2) }}</td>
              <td class="p-3 border-black/5 border-b text-[#8E8E93] text-right">{{ e.totalNotes }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Song detail modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div v-if="selectedEntry && selectedDetail"
            class="z-[1000] fixed inset-0 flex justify-center items-start md:items-center bg-black/40 backdrop-blur-sm transition-opacity duration-300 p-4 overflow-y-auto"
            @mousedown.self="selectedEntry = null">
            <div
              class="bg-white/95 shadow-2xl backdrop-blur-2xl my-8 md:my-0 border border-white/20 rounded-[24px] w-full max-w-[700px] max-h-[calc(100vh-64px)] overflow-y-auto transition-all duration-300"
              @mousedown.stop>
              <!-- Header -->
              <div class="flex justify-between items-center sticky top-0 z-10 bg-white/95 backdrop-blur-2xl px-6 py-4 border-black/5 border-b rounded-t-[24px]">
                <h2 class="font-bold text-[#1D1D1F] text-lg">{{ selectedEntry.title }} (难度 {{ selectedEntry.level }})</h2>
                <button
                  class="bg-black/5 hover:bg-black/10 rounded-full w-8 h-8 font-bold text-[#1D1D1F] text-sm active:scale-95 transition-all cursor-pointer"
                  @click="selectedEntry = null">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>

              <!-- Body -->
              <div class="p-6">
                <!-- Section 1: Raw constants -->
                <h3 class="mb-2 font-bold text-[#8E8E93] text-xs uppercase tracking-wider">谱面定数</h3>
                <div class="gap-2 grid grid-cols-3 md:grid-cols-5 mb-4 text-sm">
                  <div v-for="item in [
                    { label: '主定数', v: selectedEntry.songData?.main_constant },
                    { label: '副定数1', v: selectedEntry.songData?.sub_constant_1 },
                    { label: '副定数2', v: selectedEntry.songData?.sub_constant_2 },
                    { label: '体力', v: selectedEntry.songData?.stamina },
                    { label: '手速', v: selectedEntry.songData?.handspeed },
                    { label: '爆发', v: selectedEntry.songData?.burst },
                    { label: '复合', v: selectedEntry.songData?.complex },
                    { label: '节奏', v: selectedEntry.songData?.rhythm },
                    { label: '总Notes', v: selectedEntry.totalNotes },
                  ]" :key="item.label" class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">{{ item.label }}</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ typeof item.v === 'number' ? item.v.toFixed(2) : '-' }}
                    </div>
                  </div>
                </div>

                <!-- Section 2: Input parameters -->
                <h3 class="mb-2 font-bold text-[#8E8E93] text-xs uppercase tracking-wider">输入参数</h3>
                <div class="gap-2 grid grid-cols-2 md:grid-cols-4 mb-4 text-sm">
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">良</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedEntry.great }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">可</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedEntry.good }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">不可</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedEntry.bad }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">accuracy_per</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ (selectedEntry.accuracy * 100).toFixed(4) }}%</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">bad_per</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ (selectedEntry.badRate * 100).toFixed(4) }}%</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">Y(acc) = accuracy</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.yAcc.toFixed(4) }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">rt_ini 所用定数</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.used_constant }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">rt_ini</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.rt_ini.toFixed(4) }}</div>
                  </div>
                </div>

                <!-- Section 3: Reference ratings -->
                <h3 class="mb-2 font-bold text-[#8E8E93] text-xs uppercase tracking-wider">参考 Rating 值</h3>
                <div class="mb-4 overflow-x-auto">
                  <table class="w-full text-[11px] border-collapse">
                    <thead>
                      <tr>
                        <th class="bg-black/5 p-2 font-bold text-left">变量</th>
                        <th class="bg-black/5 p-2 font-bold text-right">定数</th>
                        <th class="bg-black/5 p-2 font-bold text-right">Y 值</th>
                        <th class="bg-black/5 p-2 font-bold text-right">结果</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_90</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub1 ({{ selectedEntry.songData?.sub_constant_1?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.9) = {{ selectedDetail.y090.toFixed(4) }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{ selectedDetail.rt_90.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_95_ref</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub1 ({{ selectedEntry.songData?.sub_constant_1?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.95) = {{ selectedDetail.y095.toFixed(4) }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{ selectedDetail.rt_95_ref.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_95</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">main ({{ selectedEntry.songData?.main_constant?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.95) = {{ selectedDetail.y095.toFixed(4) }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{ selectedDetail.rt_95.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_100_ref</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">main ({{ selectedEntry.songData?.main_constant?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(1.0) = {{ selectedDetail.y1.toFixed(4) }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{ selectedDetail.rt_100_ref.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_100</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub2 ({{ selectedEntry.songData?.sub_constant_2?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(1.0) = {{ selectedDetail.y1.toFixed(4) }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{ selectedDetail.rt_100.toFixed(4) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Section 4: Rating formula -->
                <h3 class="mb-2 font-bold text-[#8E8E93] text-xs uppercase tracking-wider">公式分支 & 维度修正</h3>
                <div class="bg-black/5 mb-4 p-3 rounded-[12px] font-mono text-[#1D1D1F] text-xs leading-relaxed">
                  <div class="mb-2 font-semibold text-[#007AFF]">{{ selectedDetail.branch }}</div>
                  <div class="text-[#8E8E93]">rating = {{ selectedEntry.rating.toFixed(6) }}</div>
                </div>

                <div class="gap-2 grid grid-cols-2 md:grid-cols-4 text-sm">
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">burst_hs_factor</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.burst_hs_factor.toFixed(4) }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">complex_penalty</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.complex_penalty.toFixed(4) }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">rhythm手速因子 (burst_hs_factor)</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.burst_hs_factor.toFixed(4) }}</div>
                  </div>
                  <div class="bg-black/5 px-3 py-2 rounded-[12px]">
                    <div class="text-[#8E8E93] text-[10px]">rhythm_burst_factor</div>
                    <div class="font-mono font-bold text-[#1D1D1F]">{{ selectedDetail.rhythm_burst_factor.toFixed(4) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>

<style scoped>
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.92);
}
</style>
