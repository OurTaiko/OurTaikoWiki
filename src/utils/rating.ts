import type { DifficultyKey, ImportedScore, Song } from '../types'

export type RatingVersion = 'v1' | 'v2'
export type RatingDimensionKey =
  | 'rating'
  | 'power'
  | 'stamina'
  | 'speed'
  | 'burst'
  | 'accuracy'
  | 'rhythm'
  | 'complex'

export interface RatingEntry {
  id: number
  difficulty: number
  difficultyKey: DifficultyKey
  title: string
  accuracy: number
  great: number
  good: number
  bad: number
  totalNotes: number
  values: Partial<Record<RatingDimensionKey, number>> & { rating: number }
}

export interface RatingSummaryItem {
  key: RatingDimensionKey
  label: string
  value: number
  compensated: boolean
}

export interface RatingReport {
  version: RatingVersion
  entries: RatingEntry[]
  summary: RatingSummaryItem[]
}

export const NORMALIZATION_FACTOR = 15.5
export const DIFFICULTY_KEYS: DifficultyKey[] = ['easy', 'normal', 'hard', 'oni', 'ura']

export const ratingDimensionLabels: Record<RatingVersion, Array<[RatingDimensionKey, string]>> = {
  v1: [
    ['rating', 'Rating'],
    ['power', '大歌力'],
    ['stamina', '体力'],
    ['speed', '手速'],
    ['accuracy', '精度'],
    ['rhythm', '节奏'],
    ['complex', '复合'],
  ],
  v2: [
    ['rating', 'Rating'],
    ['stamina', '体力'],
    ['speed', '手速'],
    ['burst', '爆发'],
    ['accuracy', '精度'],
    ['rhythm', '节奏'],
    ['complex', '复合'],
  ],
}

export function difficultyKey(index: number): DifficultyKey | undefined {
  return DIFFICULTY_KEYS[index - 1]
}

export function songTitle(id: number, songs: Song[], fallback?: string) {
  return songs.find((song) => song.id === id)?.title || fallback || `曲目 ${id}`
}

export function calculateComprehensiveAccuracy(great: number, good: number, totalNotes: number): number {
  if (totalNotes <= 0) return 0
  return (great + good / 2) / totalNotes
}

export function calcY(accuracy: number): number {
  const g0 = 0.75
  const g1 = 0.8278
  const g2 = 0.9793
  const y1 = (value: number) => 16730 * Math.pow(value - 0.75, 3.805)
  const y2 = (value: number) => 56.4468 * value - 45.7187
  const y3 = (value: number) => 0.2246 * Math.pow(2.718, 120 * (value - 0.972)) + 9.02

  if (accuracy <= g0) return 0
  if (accuracy <= g1) return y1(accuracy)
  if (accuracy <= g2) return y2(accuracy)
  return y3(g2) + (y3(accuracy) - y3(g2)) / (y3(1) - y3(g2)) * (NORMALIZATION_FACTOR - y3(g2))
}

export function calcSingleRating(x: number, y: number): number {
  const termP = 150 ** 2 - (x - y) ** 2 / 2
  const p = termP < 0 ? 150 : 150 - Math.sqrt(termP)
  const termW = 25 - (x - 15.5) ** 2 / 25 - (y - 23) ** 2 / 69
  const w = termW < 0 ? 0.5 : Math.max(Math.sqrt(termW) - 4, 0.5)
  return p === 0
    ? Math.pow(x, w) * Math.pow(y, 1 - w)
    : Math.pow(w * Math.pow(x, p) + (1 - w) * Math.pow(y, p), 1 / p)
}

export function topValues(entries: RatingEntry[], key: RatingDimensionKey): number[] {
  return entries
    .map((entry) => entry.values[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => b - a)
    .slice(0, 20)
}

export function weightedAverage(values: number[], weights: number[]): number {
  let sum = 0
  let weightSum = 0
  values.slice(0, weights.length).forEach((value, index) => {
    sum += value * weights[index]
    weightSum += weights[index]
  })
  return weightSum ? sum / weightSum : 0
}

export function scoreJudgementsAreValid(score: ImportedScore, totalNotes: number): boolean {
  return score.good + score.ok + score.bad <= totalNotes
}
