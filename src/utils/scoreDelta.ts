import type { ImportedScore } from '../types'

export type ScoreDeltaKind = 'none' | 'new' | 'up' | 'down' | 'same'

export interface ScoreDeltaInfo {
  kind: ScoreDeltaKind
  delta: number
  previous: number | null
}

export function scoreKey(id: number, difficulty: number): string {
  return `${id}-${difficulty}`
}

export function buildScoreMap(scores: ImportedScore[]): Map<string, ImportedScore> {
  return new Map(scores.map((score) => [scoreKey(score.id, score.difficulty), score]))
}

/**
 * 计算当前成绩与“上次导入”快照之间的增减幅。
 * - none：尚无上次导入快照（首次导入，没有对比基准）
 * - new ：该谱面是本次导入新增的，不在上次快照中
 * - up / down / same：与上次快照同谱面的分数差
 */
export function getScoreDelta(
  current: ImportedScore,
  previousMap: Map<string, ImportedScore>,
): ScoreDeltaInfo {
  if (previousMap.size === 0) return { kind: 'none', delta: 0, previous: null }

  const previous = previousMap.get(scoreKey(current.id, current.difficulty))
  if (!previous) return { kind: 'new', delta: 0, previous: null }

  const delta = current.highScore - previous.highScore
  if (delta > 0) return { kind: 'up', delta, previous: previous.highScore }
  if (delta < 0) return { kind: 'down', delta, previous: previous.highScore }
  return { kind: 'same', delta: 0, previous: previous.highScore }
}
