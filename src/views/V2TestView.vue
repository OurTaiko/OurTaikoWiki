<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { calculateTaikoRating, type SongData, type CalculationInput } from '@utils/rating_v2'
import { parsePastedScores, calcY, calcSingleRating } from '@utils/calculator'
import type { UserScore } from '@/types'
import RadarChart from '@components/RadarChart.vue'

// --- Difficulty string → number mapping ---
const DIFFICULTY_MAP: Record<string, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
  oni: 4,
  edit: 5,
}

// --- State ---
const inputText = ref('')
const songsDB = ref<SongData[]>([])
const songMeta = ref<Map<string, { title: string; totalNotes: number }>>(new Map())
const dbLoading = ref(false)
const dbError = ref('')
const calculating = ref(false)
const calcError = ref('')
const entries = ref<Entry[]>([])
const dataSource = ref<'localStorage' | 'input' | 'none'>('none')

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
  // raw song data for detail view
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

// --- Recompute intermediate values for the selected entry ---
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

  // Determine which branch was used
  let branch: string
  if (e.accuracy <= 0.9) branch = 'acc ≤ 0.9: rating = rt_ini'
  else if (e.accuracy <= 0.95) branch = '0.9 < acc ≤ 0.95: rating = rt_90 + (rt_95 - rt_90) × (rt_ini - rt_90) / (rt_95_ref - rt_90)'
  else branch = 'acc > 0.95: rating = rt_95 + (rt_100 - rt_95) × (rt_ini - rt_95) / (rt_100_ref - rt_95)'

  // Dimension factors — from rating_v2 intermediate
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

// --- Load CSV ---
async function loadCSV() {
  dbLoading.value = true
  dbError.value = ''
  try {
    const resp = await fetch('/constants_id.csv')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const text = await resp.text()
    const { songs, meta } = parseCSV(text)
    songsDB.value = songs
    songMeta.value = meta
  } catch (e: any) {
    dbError.value = 'CSV加载失败: ' + e.message
  } finally {
    dbLoading.value = false
  }
}

// --- CSV parser ---
function parseCSV(text: string): { songs: SongData[]; meta: Map<string, { title: string; totalNotes: number }> } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { songs: [], meta: new Map() }

  const header = parseCSVLine(lines[0])
  const idx = (name: string) => header.indexOf(name)

  const songs: SongData[] = []
  const meta = new Map<string, { title: string; totalNotes: number }>()

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i])
    if (cols.length < header.length) continue

    const difficultyStr = cols[idx('difficulty')]?.trim().toLowerCase() ?? ''
    const difficulty = DIFFICULTY_MAP[difficultyStr]
    if (difficulty === undefined) continue

    const parseNum = (s: string) => { const v = parseFloat(s); return isNaN(v) ? 0 : v }

    const id = parseInt(cols[idx('id')]) || 0
    const totalNotes = parseInt(cols[idx('totalNotes')]) || 0

    songs.push({
      id,
      difficulty,
      stamina: parseNum(cols[idx('stamina')]),
      handspeed: parseNum(cols[idx('handspeed')]),
      burst: parseNum(cols[idx('burst')]),
      complex: parseNum(cols[idx('complex')]),
      rhythm: parseNum(cols[idx('rhythm')]),
      main_constant: parseNum(cols[idx('main_constant')]),
      sub_constant_1: parseNum(cols[idx('sub_constant_1')]),
      sub_constant_2: parseNum(cols[idx('sub_constant_2')]),
    })

    meta.set(`${id}-${difficulty}`, {
      title: cols[idx('title')]?.trim() ?? '',
      totalNotes,
    })
  }
  return { songs, meta }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

// --- Calculate ---
function calcFromRaw(raw: string): { entries: Entry[]; error: string } {
  try {
    let scores: UserScore[]
    try {
      scores = parsePastedScores(raw)
    } catch {
      return { entries: [], error: '无法解析输入的成绩数据' }
    }

    if (scores.length === 0) {
      return { entries: [], error: '未解析到任何成绩' }
    }

    const results: Entry[] = []

    for (const score of scores) {
      const song = songsDB.value.find(s => s.id === score.id && s.difficulty === score.level)
      if (!song) continue

      const key = `${score.id}-${score.level}`
      const meta = songMeta.value.get(key)
      if (!meta || meta.totalNotes <= 0) continue

      const totalNotes = meta.totalNotes

      // accuracy_per = (great * 1 + good * 0.5) / totalNotes (comprehensive)
      const accuracyPer = (score.great * 1 + score.good * 0.5) / totalNotes
      const badPer = score.bad / totalNotes

      // Clamp to [0, 1]
      const ap = Math.max(0, Math.min(1, accuracyPer))
      const bp = Math.max(0, Math.min(1, badPer))

      const input: CalculationInput = {
        id: score.id,
        difficulty: score.level,
        accuracy_per: ap,
        bad_per: bp,
      }

      const result = calculateTaikoRating(songsDB.value, input)
      if (!result) continue

      results.push({
        title: meta.title || `ID ${song.id}`,
        id: score.id,
        level: score.level,
        accuracy: ap,
        badRate: bp,
        totalNotes,
        great: score.great,
        good: score.good,
        bad: score.bad,
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

    return { entries: results.sort((a, b) => b.rating - a.rating), error: '' }
  } catch (e: any) {
    return { entries: [], error: e.message || '计算错误' }
  }
}

function doCalculate() {
  calcError.value = ''
  calculating.value = true
  entries.value = []

  const { entries: res, error: err } = calcFromRaw(inputText.value)
  if (err) {
    calcError.value = err
  } else {
    entries.value = res
    dataSource.value = 'input'
  }
  calculating.value = false
}

function loadFromLocalStorage() {
  const stored = localStorage.getItem('taikoScoreData')
  if (!stored) {
    calcError.value = 'localStorage 中没有成绩数据'
    return
  }
  calcError.value = ''
  calculating.value = true
  entries.value = []

  const { entries: res, error: err } = calcFromRaw(stored)
  if (err) {
    calcError.value = err
  } else {
    entries.value = res
    dataSource.value = 'localStorage'
  }
  calculating.value = false
}

// --- Top 20 weighted average ---
// Weights: pos 1-10 → 1,2,3,4,5,6,7,8,9,10 | pos 11-20 → 10,9,8,7,6,5,4,3,2,1
const TOP20_WEIGHTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
]

function getTop20(list: Entry[], key: DimKey): Entry[] {
  const valid = list.filter(e => !isNaN(e[key]))
  return [...valid].sort((a, b) => b[key] - a[key]).slice(0, 20)
}

function top20WeightedAvg(list: Entry[], key: DimKey): number {
  const top = getTop20(list, key)
  if (top.length === 0) return 0
  let wSum = 0, sum = 0
  for (let i = 0; i < top.length; i++) {
    const w = TOP20_WEIGHTS[i]
    sum += top[i][key] * w
    wSum += w
  }
  return wSum > 0 ? sum / wSum : 0
}

function top20Max(list: Entry[], key: DimKey): number {
  const top = getTop20(list, key)
  return top.length > 0 ? top[0][key] : 0
}

const top20Summary = computed(() => {
  if (entries.value.length === 0) return null
  return DIM_KEYS.map(k => ({
    key: k,
    label: DIM_LABELS[k],
    avg: top20WeightedAvg(entries.value, k),
    max: top20Max(entries.value, k),
    count: Math.min(entries.value.length, 20),
  }))
})

// --- Radar chart ---
const RADAR_DIM_KEYS = ['stamina_rt', 'handspeed_rt', 'burst_rt', 'accuracy_rt', 'rhythm_rt', 'complex_rt'] as const
const RADAR_DIM_LABELS: string[] = ['体力', '手速', '爆发', '精度', '节奏', '复合']

const radarValues = computed(() => {
  if (entries.value.length === 0) return [0, 0, 0, 0, 0, 0]
  return RADAR_DIM_KEYS.map(k => top20WeightedAvg(entries.value, k))
})
function logTop20Detail() {
  if (entries.value.length === 0) return
  console.group('%cRating V2 — Top 20 详细日志', 'font-size:14px;font-weight:bold;color:#007AFF')

  for (const key of DIM_KEYS) {
    const top = getTop20(entries.value, key)
    let wSum = 0, sum = 0
    const rows: Array<{ rank: number; title: string; value: number; weight: number; contribution: number }> = []

    for (let i = 0; i < top.length; i++) {
      const w = TOP20_WEIGHTS[i]
      const val = top[i][key]
      sum += val * w
      wSum += w
      rows.push({
        rank: i + 1,
        title: top[i].title,
        value: val,
        weight: w,
        contribution: val * w,
      })
    }

    console.groupCollapsed(
      `%c${DIM_LABELS[key]}%c 加权平均 = %c${(sum / wSum).toFixed(4)}%c  (max ${rows[0]?.value.toFixed(2) ?? '-'}, ${top.length}首)`,
      'font-weight:bold;color:#1D1D1F',
      '',
      'font-weight:bold;color:#007AFF',
      '',
    )
    console.table(rows.map(r => ({
      '#': r.rank,
      '曲目': r.title,
      '值': r.value.toFixed(4),
      '权重': r.weight,
      '贡献': r.contribution.toFixed(4),
    })))
    console.log(`权总和: ${wSum}, 加权和: ${sum.toFixed(4)}, 加权平均: ${(sum / wSum).toFixed(4)}`)
    console.groupEnd()
  }

  console.groupEnd()
}

watch(entries, () => {
  logTop20Detail()
})
// --- Initialize ---
loadCSV().then(() => {
  const stored = localStorage.getItem('taikoScoreData')
  if (stored) {
    const { entries: res, error: err } = calcFromRaw(stored)
    if (!err) {
      entries.value = res
      dataSource.value = 'localStorage'
    }
  }
})
</script>

<template>
  <div
    class="bg-white/80 shadow-sm backdrop-blur-xl mx-auto p-8 max-md:p-4 border border-black/5 rounded-[32px] max-w-[1200px] min-h-[600px]">
    <h1 class="mb-6 font-bold text-[#1D1D1F] text-2xl tracking-tight">Rating V2 算法测试</h1>

    <!-- CSV load status -->
    <div v-if="dbLoading" class="mb-4 text-[#8E8E93] text-sm">加载定数数据库...</div>
    <div v-else-if="dbError" class="mb-4 text-[#FF3B30] text-sm">{{ dbError }}</div>
    <div v-else class="mb-4 text-[#34C759] text-sm">定数数据库已加载 ({{ songsDB.length }} 条)</div>

    <!-- Input area -->
    <div class="mb-6">
      <div class="flex items-center gap-2 mb-2">
        <label class="font-semibold text-[#1D1D1F] text-sm">粘贴成绩数据</label>
        <span class="text-[#8E8E93] text-xs">(支持旧版传分器 / Donder Hiroba / 新版 Donder Tool 格式)</span>
      </div>
      <textarea v-model="inputText"
        class="p-4 border border-black/10 focus:border-[#007AFF] rounded-[16px] outline-none w-full h-[160px] font-mono text-xs transition-colors resize-y"
        placeholder="留空则使用 localStorage 中的成绩..."></textarea>
      <div class="flex items-center gap-3 mt-3">
        <button
          class="bg-[#007AFF] enabled:hover:bg-[#0062CC] disabled:opacity-50 px-6 py-2.5 rounded-full font-semibold text-white text-sm active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
          :disabled="calculating || songsDB.length === 0 || !inputText.trim()" @click="doCalculate">
          {{ calculating ? '计算中...' : '计算输入数据' }}
        </button>
        <button
          class="bg-black/5 enabled:hover:bg-black/10 disabled:opacity-50 px-6 py-2.5 rounded-full font-semibold text-[#1D1D1F] text-sm active:scale-[0.98] transition-all cursor-pointer disabled:cursor-not-allowed"
          :disabled="calculating || songsDB.length === 0" @click="loadFromLocalStorage">
          重新加载 localStorage 成绩
        </button>
        <span v-if="dataSource === 'localStorage'"
          class="bg-[#34C759]/10 px-3 py-1 rounded-full font-medium text-[#34C759] text-xs">来源: localStorage</span>
        <span v-else-if="dataSource === 'input'"
          class="bg-[#FF9500]/10 px-3 py-1 rounded-full font-medium text-[#FF9500] text-xs">来源: 手动输入 (未保存)</span>
      </div>
    </div>

    <!-- Error -->
    <div v-if="calcError" class="mb-4 text-[#FF3B30] text-sm">{{ calcError }}</div>

    <!-- Results -->
    <div v-if="entries.length > 0">
      <!-- Top 20 Summary -->
      <div v-if="top20Summary" class="mb-8">
        <h2 class="mb-4 font-bold text-[#1D1D1F] text-lg">Top 20 加权平均 (权重: 1-10位=1-10, 11-20位=10-1)</h2>
        <div class="gap-3 grid grid-cols-2 md:grid-cols-4">
          <div v-for="d in top20Summary" :key="d.key"
            class="bg-black/5 p-4 border border-black/5 rounded-[20px] text-center">
            <div class="font-semibold text-[#8E8E93] text-xs uppercase tracking-wider">{{ d.label }}</div>
            <div class="mt-1 font-bold text-[#007AFF] text-xl">{{ d.avg.toFixed(2) }}</div>
            <div class="mt-0.5 text-[#8E8E93] text-[10px]">max {{ d.max.toFixed(2) }} / {{ d.count }}首</div>
          </div>
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
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('accuracy')">
                准度<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'accuracy' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
              </th>
              <th class="bg-[#F2F2F7] p-3 font-bold text-[#1D1D1F] text-right cursor-pointer hover:bg-black/[0.08] transition-colors select-none" @click="toggleSort('badRate')">
                不可%<span class="ml-1 text-[10px] text-[#8E8E93]">{{ sortKey === 'badRate' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}</span>
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
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ (e.accuracy * 100).toFixed(2) }}%</td>
              <td class="p-3 border-black/5 border-b font-mono text-right">{{ (e.badRate * 100).toFixed(2) }}%</td>
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
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub1 ({{
                          selectedEntry.songData?.sub_constant_1?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.9) = {{ selectedDetail.y090.toFixed(4)
                          }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{
                          selectedDetail.rt_90.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_95_ref</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub1 ({{
                          selectedEntry.songData?.sub_constant_1?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.95) = {{ selectedDetail.y095.toFixed(4)
                          }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{
                          selectedDetail.rt_95_ref.toFixed(4) }}</td>
                      </tr>
                      <tr :class="selectedEntry.accuracy <= 0.95 ? 'bg-[#007AFF]/5' : ''">
                        <td class="p-2 border-black/5 border-b font-mono">rt_95</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">main ({{
                          selectedEntry.songData?.main_constant?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(0.95) = {{ selectedDetail.y095.toFixed(4)
                          }}</td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{
                          selectedDetail.rt_95.toFixed(4) }}</td>
                      </tr>
                      <tr>
                        <td class="p-2 border-black/5 border-b font-mono">rt_100_ref</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">main ({{
                          selectedEntry.songData?.main_constant?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(1.0) = {{ selectedDetail.y1.toFixed(4) }}
                        </td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{
                          selectedDetail.rt_100_ref.toFixed(4) }}</td>
                      </tr>
                      <tr :class="selectedEntry.accuracy > 0.95 ? 'bg-[#007AFF]/5' : ''">
                        <td class="p-2 border-black/5 border-b font-mono">rt_100</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">sub2 ({{
                          selectedEntry.songData?.sub_constant_2?.toFixed(2) }})</td>
                        <td class="p-2 border-black/5 border-b font-mono text-right">Y(1.0) = {{ selectedDetail.y1.toFixed(4) }}
                        </td>
                        <td class="p-2 border-black/5 border-b font-mono font-bold text-right">{{
                          selectedDetail.rt_100.toFixed(4) }}</td>
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
