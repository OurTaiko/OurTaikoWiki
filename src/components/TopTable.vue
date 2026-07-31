<script setup lang="ts">
import type { SongStats } from '@/types'
import GuideModal from '@components/GuideModal.vue'
import RatingProgressCell from '@components/RatingProgressCell.vue'
import { MAX_CONSTANT_VALUE } from '@utils/calculator'
import { difficultyMap } from '@utils/difficulty'
import { recommendSongs } from '@utils/recommend'
import { nextTick, ref, watch, computed } from 'vue'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'

interface Props {
  title: string
  data: SongStats[]
  valueKey: keyof SongStats
  showMode?: 'top' | 'recommend'
}

const props = withDefaults(defineProps<Props>(), {
  showMode: 'top'
})

const { t } = useI18n()
const store = useScoreStore()
const { songsDB, allSongStats, onlyCnSongs, blacklistedSongs, ratingAlgorithm } = store

const isLoading = ref(false)
const difficultyAdjustment = ref<number>(0)
const best20ConstantBase = ref<number>(0)
const showGuide = ref(false)

// 分页逻辑
const currentPage = ref(1)
const pageSize = 20

const totalPages = computed(() => Math.ceil(props.data.length / pageSize))

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return props.data.slice(start, end)
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

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

// 监听数据变化，重置页码
watch([() => props.data, () => props.valueKey], () => {
  currentPage.value = 1
})

const formatValue = (item: SongStats, key: keyof SongStats): string => {
  const value = item[key]
  if (typeof value === 'number') {
    return value.toFixed(2)
  }
  return String(value)
}

function increaseDifficulty() {
  difficultyAdjustment.value += 0.1
  calculateRecommendations()
}

function decreaseDifficulty() {
  difficultyAdjustment.value -= 0.1
  calculateRecommendations()
}

// 推荐列表，取前10首，基于全曲数据
const recommendedSongs = ref<SongStats[]>([]);

// 计算 B20 定数中位数
const calculatebest20ConstantBase = () => {
  if (!songsDB.value) return 0;
  
  const best20 = [...allSongStats.value]
    .sort((a, b) => (b[props.valueKey] as number) - (a[props.valueKey] as number))
    .slice(0, 20);
  
  if (best20.length === 0) return 0;
  
  const best20Constants = best20
    .map(s => {
      const songData = songsDB.value!.find(song => song.id === s.id);
      if (!songData) return 0;
      const levelData = songData.level[s.level as 4 | 5];
      return levelData?.constant ?? 0;
    })
    .filter(c => c > 0);
  
  if (best20Constants.length === 0) return 0;
  
  const sorted = [...best20Constants].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  // 计算中位数
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  return median + 0.1;
};

// 计算推荐歌曲
const calculateRecommendations = async () => {
  if (props.showMode !== 'recommend') return;
  
  isLoading.value = true;
  
  // 使用 setTimeout 让 UI 有机会更新显示加载状态
  await nextTick();
  
  setTimeout(() => {
    try {
      // 计算 B20 定数中位数
      best20ConstantBase.value = calculatebest20ConstantBase();
      
      // 创建筛选函数
      const filterFn = onlyCnSongs.value && songsDB.value
        ? (id: number) => {
            const song = songsDB.value!.find(s => s.id === id)
            return song?.is_cn === true
          }
        : undefined

      let currentDifficultyAdjustment = difficultyAdjustment.value;
      let songs: SongStats[] = [];
      const targetCount = 20;
      const maxAdjustment = MAX_CONSTANT_VALUE - best20ConstantBase.value;
      
      // 动态调整难度修正值，直到找到足够的推荐歌曲或达到最大值
      while (songs.length < targetCount && currentDifficultyAdjustment <= maxAdjustment) {
        songs = recommendSongs(
          allSongStats.value.length ? allSongStats.value : props.data, 
          props.valueKey,
          targetCount,
          filterFn,
          currentDifficultyAdjustment,
          best20ConstantBase.value,
          blacklistedSongs.value,
          ratingAlgorithm.value
        );
        
        // 如果歌曲数量不足，增加难度修正值
        if (songs.length < targetCount) {
          currentDifficultyAdjustment += 0.1;
        } else {
          break;
        }
      }
      
      // 更新实际使用的难度修正值
      if (currentDifficultyAdjustment !== difficultyAdjustment.value) {
        difficultyAdjustment.value = currentDifficultyAdjustment;
      }
      
      // 如果启用了国服筛选，替换标题为中文，并添加难度标识
      if (onlyCnSongs.value && songsDB.value) {
        const idToTitleCn = new Map<number, string>()
        songsDB.value.forEach(song => {
          if (song.title_cn) {
            idToTitleCn.set(song.id, song.title_cn)
          }
        })
        
        songs = songs.map(song => {
          const titleCn = idToTitleCn.get(song.id)
          const difficulty = difficultyMap[song.level] || ''
          if (titleCn) {
            return { ...song, title: `${titleCn}${difficulty}` }
          }
          return { ...song, title: `${song.title}${difficulty}` }
        })
      } else {
        // 未启用国服筛选时也添加难度标识
        songs = songs.map(song => {
          const difficulty = difficultyMap[song.level] || ''
          return { ...song, title: `${song.title}${difficulty}` }
        })
      }
      
      recommendedSongs.value = songs;
    } finally {
      isLoading.value = false;
    }
  }, 50);
};

// 监听 showMode 和 valueKey 变化，重新计算推荐
watch(
  [() => props.showMode, () => props.valueKey, allSongStats, blacklistedSongs, ratingAlgorithm],
  (newVals, oldVals) => {
    if (props.showMode === 'recommend') {
      // 如果是从其他模式切换到推荐模式，或者 valueKey 变化，重置难度调整值
      if (oldVals && (oldVals[0] !== 'recommend' || oldVals[1] !== newVals[1])) {
        difficultyAdjustment.value = 0;
      }
      calculateRecommendations();
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="bg-transparent mt-0 p-0">
    <div class="flex justify-center items-center mb-8">
      <h2 class="m-0 font-bold text-[#1D1D1F] text-3xl tracking-tight">{{ title }}</h2>
    </div>
    
    <!-- Top 表格 -->
    <div v-if="showMode === 'top'" class="bg-white/50 shadow-sm backdrop-blur-sm border border-black/5 rounded-[24px] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.rank') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.songTitle') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.great') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.good') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.bad') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.constant') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.rating') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in paginatedData" :key="index" class="hover:bg-black/[0.02] transition-colors">
              <td class="p-4 border-black/5 border-b text-left">{{ (currentPage - 1) * pageSize + index + 1 }}</td>
              <td class="p-4 border-black/5 border-b text-left">
                <span class="font-semibold text-[#1D1D1F]">{{ item.title }}</span>
                <span v-if="item._isNew" class="bg-[#FF3B30] ml-2 px-1.5 py-0.5 rounded-full font-bold text-[10px] text-white">NEW</span>
              </td>
              <td class="p-4 border-black/5 border-b text-left">{{ item.great }}</td>
              <td class="p-4 border-black/5 border-b text-left">{{ item.good }}</td>
              <td class="p-4 border-black/5 border-b text-left">{{ item.bad }}</td>
              <td class="p-4 border-black/5 border-b font-mono text-left">{{ item._constant ?? '-' }}</td>
              <td class="p-4 border-black/5 border-b text-left">
                <template v-if="item._maxRatings">
                  <RatingProgressCell :song="item" :valueKey="valueKey" :formatValue="formatValue" />
                  <div v-if="item._ratingDiff && item._ratingDiff !== 0" class="mt-1 font-semibold text-[11px]" :class="item._ratingDiff > 0 ? 'text-[#FF3B30]' : 'text-[#007AFF]'">
                      {{ item._ratingDiff > 0 ? '+' : '' }}{{ item._ratingDiff.toFixed(2) }}
                  </div>
                </template>
                <div v-else class="text-[#8E8E93] text-xs">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分页控制 -->
      <div v-if="totalPages > 1" class="flex flex-wrap justify-center items-center gap-2 bg-black/5 p-6">
        <button 
          @click="prevPage" 
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
              @click="goToPage(p as number)"
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
          @click="nextPage" 
          :disabled="currentPage === totalPages"
          class="flex justify-center items-center bg-white/50 hover:bg-white/80 disabled:opacity-30 backdrop-blur-sm border border-black/5 rounded-full w-10 h-10 transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <i class="fa-chevron-right fas"></i>
        </button>

        <div class="ml-4 text-[#8E8E93] text-sm">
          {{ t('topTable.pageInfo', { current: currentPage, total: totalPages, count: data.length }) }}
        </div>
      </div>
    </div>
    
    <!-- 推荐歌曲列表 -->
    <div v-else-if="showMode === 'recommend'" class="mt-8 text-left">
      <!-- 难度调整工具栏 -->
      <div class="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4 mb-6">
        <div class="flex sm:flex-row flex-col sm:items-center gap-4">
          <span class="font-bold text-[#1D1D1F] text-sm tracking-tight">{{ t('topTable.recommend.prefAdjust') }}</span>
          <div class="inline-flex items-center bg-black/5 p-1 rounded-full overflow-hidden">
            <button 
              @click="decreaseDifficulty" 
              class="flex justify-center items-center bg-white hover:bg-gray-50 disabled:opacity-50 shadow-sm rounded-full w-8 h-8 text-[#1D1D1F] active:scale-95 transition-all disabled:cursor-not-allowed"
              :disabled="isLoading"
            >
              <i class="text-xs fas fa-minus"></i>
            </button>
            <div class="flex items-center px-4 min-w-[100px] text-center">
              <span v-if="isLoading" class="w-full font-medium text-[#8E8E93] text-xs">{{ t('topTable.recommend.calculating') }}</span>
              <div v-else class="flex flex-col items-center w-full">
                <span class="font-bold text-[#1D1D1F] text-sm">
                  {{ difficultyAdjustment >= 0 ? '+' : '' }}{{ difficultyAdjustment.toFixed(1) }}
                </span>
                <span class="text-[#8E8E93] text-[10px]">{{ t('topTable.recommend.base') }}: {{ best20ConstantBase > 0 ? best20ConstantBase.toFixed(1) : '-' }}</span>
              </div>
            </div>
            <button 
              @click="increaseDifficulty" 
              class="flex justify-center items-center bg-white hover:bg-gray-50 disabled:opacity-50 shadow-sm rounded-full w-8 h-8 text-[#1D1D1F] active:scale-95 transition-all disabled:cursor-not-allowed"
              :disabled="isLoading"
            >
              <i class="text-xs fas fa-plus"></i>
            </button>
          </div>
        </div>
        <button 
          @click="showGuide = !showGuide" 
          class="flex items-center self-start sm:self-auto gap-2 bg-black/5 hover:bg-black/10 px-5 py-2 rounded-full font-semibold text-[#1D1D1F] text-sm active:scale-95 transition-all"
        >
          <i class="text-xs fas fa-question-circle"></i>
          <span>{{ t('topTable.recommend.guide') }}</span>
        </button>
      </div>
      
      <!-- 加载提示 -->
      <div v-if="isLoading" class="flex justify-center items-center py-20">
        <div class="text-center">
          <div class="inline-block border-[#007AFF] border-[3px] border-t-transparent rounded-full w-10 h-10 animate-spin"></div>
          <p class="mt-4 font-medium text-[#8E8E93]">{{ t('topTable.recommend.calculatingFull') }}</p>
        </div>
      </div>

      <div v-if="!isLoading" class="bg-white/50 shadow-sm backdrop-blur-sm border border-black/5 rounded-[24px] overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.rank') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.songTitle') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.constant') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.recommend.accuracy') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.recommend.difficultyDiff') }}</th>
              <th class="bg-black/5 p-4 font-bold text-[#1D1D1F] text-left">{{ t('topTable.recommend.userRating') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(song, _) in recommendedSongs" :key="song.title" class="hover:bg-black/[0.02] transition-colors">
              <td class="p-4 border-black/5 border-b text-left">
                <template v-if="!(song as any)._isUnplayed && (song as any)._dimensionRanks && (song as any)._dimensionRanks[valueKey]">
                  <span class="font-bold text-[#1D1D1F]">{{ (song as any)._dimensionRanks[valueKey] }}</span>
                </template>
                <template v-else-if="(song as any)._isUnplayed">
                  <span class="text-[#8E8E93] text-xs">-</span>
                </template>
              </td>
              <td class="p-4 border-black/5 border-b font-bold text-[#1D1D1F] text-left">{{ song.title }}</td>
              <td class="p-4 border-black/5 border-b font-mono text-left">{{ (song as any)._constant ?? '-' }}</td>
              <td class="p-4 border-black/5 border-b text-left">
                <template v-if="typeof (song as any).great === 'number' && typeof (song as any).good === 'number' && (song as any)._constant && (song as any)._constant > 0 && (song as any)._songIndicatorValue">
                  {{
                    (() => {
                      try {
                        const total = (song as any).great + (song as any).good + (song as any).bad;
                        if (total === 0) return '-';
                        const acc = ((song as any).great) / total;
                        return (acc * 100).toFixed(2) + '%';
                      } catch { return '-'; }
                    })()
                  }}
                </template>
                <template v-else>-</template>
              </td>
              <td class="p-4 border-black/5 border-b font-semibold text-left" :class="{'text-[#34C759]': (song as any)._songIndicatorValue < (song as any)._best20IndicatorMedian, 'text-[#FF9500]': (song as any)._songIndicatorValue >= (song as any)._best20IndicatorMedian}">
                <template v-if="(song as any)._best20IndicatorMedian && (song as any)._best20IndicatorMedian !== 0">
                  {{ (((((song as any)._songIndicatorValue - (song as any)._best20IndicatorMedian) / (song as any)._best20IndicatorMedian) * 100) .toFixed(1)) }}%
                </template>
                <template v-else>-</template>
              </td>
              <td class="p-4 border-black/5 border-b text-left">
                <template v-if="(song as any)._maxRatings">
                  <RatingProgressCell :song="song" :valueKey="valueKey" :formatValue="formatValue" />
                </template>
                <div v-else class="text-[#8E8E93] text-xs">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- 使用说明弹窗 -->
    <GuideModal :show="showGuide" @close="showGuide = false" />
  </div>
</template>
