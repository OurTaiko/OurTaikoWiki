<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { LockedScores, UserScore } from '@/types'
import { migrateOldFormat } from '@utils/calculator'
import { useScoreStore } from '@/store/scoreStore'
import { useI18n } from 'vue-i18n'
import { useModal } from '@composables/useModal'
import SakuraImportTab from '@/components/guide/SakuraImportTab.vue'
import KinokoImportTab from '@/components/guide/KinokoImportTab.vue'
import DonderSyncTab from '@/components/guide/DonderSyncTab.vue'
import ManualImportTab from '@/components/guide/ManualImportTab.vue'

const { t } = useI18n()
const router = useRouter()
const { showModal } = useModal()

// Tab 配置 — 调整顺序只需交换数组元素
const tabDefs = [
  { key: 'kinoko', icon: 'fa-key', labelKey: 'guide.kinokoTitle' as const, component: KinokoImportTab },
  { key: 'sakura', icon: 'fa-robot', labelKey: 'guide.sakuraTitle' as const, component: SakuraImportTab },
  { key: 'sync', icon: 'fa-arrows-rotate', labelKey: 'guide.syncTitle' as const, component: DonderSyncTab },
  { key: 'manual', icon: 'fa-file-import', labelKey: 'guide.manualTitle' as const, component: ManualImportTab },
]

const activeTab = ref(tabDefs[0].key)
const transitionName = ref('slide-left')

const switchTab = (key: string) => {
  if (key === activeTab.value) return
  const oldIndex = tabDefs.findIndex(t => t.key === activeTab.value)
  const newIndex = tabDefs.findIndex(t => t.key === key)
  transitionName.value = newIndex > oldIndex ? 'slide-left' : 'slide-right'
  activeTab.value = key
}

const activeComponent = computed(() => tabDefs.find(t => t.key === activeTab.value)?.component)
const indicatorLeft = computed(() => {
  const idx = tabDefs.findIndex(t => t.key === activeTab.value)
  return (idx / tabDefs.length) * 100 + '%'
})
const indicatorWidth = computed(() => 100 / tabDefs.length + '%')

// ---- 共享的数据解析函数 ----

/* 尝试解析旧版传分器格式 */
function tryParseTaikoScoreGetter(input: string): UserScore[] | null {
  try {
    const arr = JSON.parse(input);
    if (Array.isArray(arr) && (Array.isArray(arr[0]) || arr.length === 0)) {
      return migrateOldFormat(arr);
    }
  } catch (e) { }
  return null;
}

/* 尝试解析国际服 Donder Hiroba 抓分器格式 */
function tryParseDonderHiroba(input: string): UserScore[] | null {
  let parsed: any;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    return null;
  }

  const isLegacyItem = (obj: any) => {
    return obj && typeof obj === 'object' && 'songNo' in obj && 'difficulty' in obj && 'score' in obj;
  };

  const isGroupedItem = (obj: any) => {
    return obj && typeof obj === 'object' && 'songNo' in obj && 'difficulty' in obj && typeof obj.difficulty === 'object';
  };

  let rawItems: any[] = [];
  if (Array.isArray(parsed)) {
    rawItems = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (isLegacyItem(parsed) || isGroupedItem(parsed)) {
      rawItems = [parsed];
    } else {
      rawItems = Object.entries(parsed).map(([songNo, item]: [string, any]) => {
        if (item && typeof item === 'object' && !('songNo' in item)) {
          return { ...item, songNo };
        }
        return item;
      });
    }
  }

  if (rawItems.length === 0) return null;

  const difficultyMap: { [key: string]: number } = {
    'easy': 1,
    'normal': 2,
    'hard': 3,
    'oni': 4,
    'ura': 5
  };

  const rows: any[] = [];

  const pushRow = (songNo: any, difficultyName: string, scoreData: any) => {
    rows.push([
      songNo,
      difficultyMap[difficultyName] ?? 4,
      scoreData?.score ?? 0,
      scoreData?.badge ?? '',
      scoreData?.good ?? 0,
      scoreData?.ok ?? 0,
      scoreData?.bad ?? 0,
      scoreData?.roll ?? 0,
      scoreData?.maxCombo ?? 0,
      scoreData?.count?.play ?? 0,
      scoreData?.count?.clear ?? 0,
      (scoreData?.count?.fullcombo ?? 0) > 0,
      (scoreData?.count?.donderfullcombo ?? 0) > 0,
      ''
    ]);
  };

  for (const item of rawItems) {
    if (isLegacyItem(item)) {
      pushRow(item.songNo, item.difficulty, item.score);
      continue;
    }

    if (isGroupedItem(item)) {
      for (const [difficultyName, difficultyData] of Object.entries(item.difficulty || {})) {
        const scoreData = (difficultyData as any)?.score && typeof (difficultyData as any).score === 'object'
          ? (difficultyData as any).score
          : difficultyData;
        if (scoreData && typeof scoreData === 'object') {
          pushRow(item.songNo, difficultyName, scoreData);
        }
      }
    }
  }

  if (rows.length === 0) return null;
  return migrateOldFormat(rows);
}

/* 尝试解析新版 LLX Donder Tool 传分器格式 */
function tryParseDonderTool(input: any): UserScore[] | null {
  let parsed: any;
  try {
    if (typeof input === 'string') parsed = JSON.parse(input);
    else parsed = input;
  } catch (e) {
    return null;
  }
  return tryParseOfficialData(parsed);
}

/* 尝试官方格式 */
function tryParseOfficialData(data: any): UserScore[] | null {
  const isNewFormat = (obj: any) => {
    return obj && typeof obj === 'object' && (
      (Array.isArray(obj) && obj.length > 0 && obj[0] && typeof obj[0] === 'object' && 'song_no' in obj[0]) ||
      (!Array.isArray(obj) && 'song_no' in obj)
    );
  };
  if (!isNewFormat(data)) return null;
  let arr = Array.isArray(data) ? data : [data];
  return migrateOldFormat(arr.map((item: any) => [
    item.song_no,
    item.level,
    item.high_score,
    item.best_score_rank,
    item.good_cnt,
    item.ok_cnt,
    item.ng_cnt,
    item.pound_cnt,
    item.combo_cnt,
    item.stage_cnt,
    item.clear_cnt,
    item.full_combo_cnt,
    item.dondaful_combo_cnt,
    item.update_datetime || item.highscore_datetime || ''
  ]));
}

// ---- 共享的分析后处理 ----

const restoreLockedScores = (scoreData: UserScore[]): UserScore[] => {
  try {
    const lockedDataStr = localStorage.getItem('taiko-locked-songs')
    if (!lockedDataStr) return scoreData

    const lockedData: LockedScores = JSON.parse(lockedDataStr)
    const lockedKeys = Object.keys(lockedData)
    if (lockedKeys.length === 0) return scoreData

    const result = [...scoreData]
    for (const key in lockedData) {
      const lockedScore = lockedData[key]
      const [songId, level] = key.split('-').map(Number)

      const index = result.findIndex(item => item.id === songId && item.level === level)

      if (index !== -1) {
        result[index] = lockedScore
      } else {
        result.push(lockedScore)
      }
    }
    return result
  } catch (e) {
    console.error('Failed to restore locked scores', e)
    return scoreData
  }
}

const analyze = async (scoreData: UserScore[]) => {
  scoreData = restoreLockedScores(scoreData)
  const input = JSON.stringify(scoreData)

  const currentScoreData = localStorage.getItem('taikoScoreData')
  if (currentScoreData && currentScoreData !== input) {
    localStorage.setItem('lastTaikoScore', currentScoreData)
  }

  localStorage.setItem('taikoScoreData', input)

  const store = useScoreStore()
  await store.init(true)

  window.dispatchEvent(new Event('localStorageUpdate'))
  router.push('/report')
}
</script>

<template>
  <div class="mx-auto max-w-[800px]">
    <!-- 顶部提示卡片 -->
    <section class="bg-white/70 shadow-sm backdrop-blur-xl mb-6 p-6 border border-white/20 rounded-[24px]">
      <div class="flex items-start gap-4">
        <div class="bg-[#007AFF]/10 p-2 rounded-full">
          <i class="text-[#007AFF] fa-solid fa-circle-info"></i>
        </div>
        <div class="space-y-2">
          <p class="m-0 font-medium text-[#1D1D1F]">曲目列表页面点击歌曲可以修改成绩，右下角菜单按钮可以加入我们的 QQ 群</p>
          <p class="m-0 text-[#86868B] text-sm">{{ t('guide.disclaimer') }}</p>
        </div>
      </div>
    </section>

    <section class="bg-white/70 shadow-sm backdrop-blur-xl my-8 border border-white/20 rounded-[32px] overflow-hidden">
      <!-- Tab 栏 -->
      <div class="relative flex border-black/5 border-b">
        <div class="bottom-0 absolute bg-[#007AFF] rounded-full h-0.5 transition-all duration-300 ease-out" :style="{
          left: indicatorLeft,
          width: indicatorWidth
        }" />
        <button v-for="tab in tabDefs" :key="tab.key" @click="switchTab(tab.key)"
          class="z-10 relative flex-1 py-4 border-none font-semibold text-sm transition-colors duration-200 cursor-pointer"
          :class="activeTab === tab.key ? 'text-[#007AFF]' : 'text-[#86868B] hover:text-[#1D1D1F]'">
          <i class="mr-2" :class="'fa-solid ' + tab.icon"></i>{{ t(tab.labelKey) }}
        </button>
      </div>

      <!-- Tab 内容区域 -->
      <Transition :name="transitionName" mode="out-in">
        <component v-if="activeComponent" :is="activeComponent" :key="activeTab" :show-modal="showModal"
          :try-parse-official-data="tryParseOfficialData" :try-parse-donder-tool="tryParseDonderTool"
          :try-parse-donder-hiroba="tryParseDonderHiroba" :try-parse-taiko-score-getter="tryParseTaikoScoreGetter"
          @analyze="analyze" />
      </Transition>
    </section>
  </div>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-left-leave-to {
  transform: translateX(-30px);
  opacity: 0;
}

.slide-left-enter-from {
  transform: translateX(30px);
  opacity: 0;
}

.slide-right-leave-to {
  transform: translateX(30px);
  opacity: 0;
}

.slide-right-enter-from {
  transform: translateX(-30px);
  opacity: 0;
}
</style>
