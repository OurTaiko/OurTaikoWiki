import type { ImportedScore, Song, V1Difficulty, V1Song } from '../types'
import {
  NORMALIZATION_FACTOR,
  calculateComprehensiveAccuracy,
  calcSingleRating,
  calcY,
  difficultyKey,
  filterDuplicates,
  filterIgnoredSongs,
  isDondafuruScore,
  ratingDimensionLabels,
  scoreJudgementsAreValid,
  songTitle,
  topValues,
  weightedAverage,
  type RatingDimensionKey,
  type RatingEntry,
  type RatingReport,
  type RatingSummaryItem,
} from './rating'

const CONSTANT_TO_X_MAP: Record<number, number> = {
  1.0: 0.05, 1.5: 0.10, 2.0: 0.15, 2.5: 0.20, 3.0: 0.25, 3.5: 0.30,
  4.0: 0.35, 4.5: 0.40, 5.0: 0.45, 5.5: 0.50, 6.0: 0.55, 6.2: 0.65,
  6.4: 0.75, 6.6: 0.85, 6.8: 0.95, 6.9: 1.00, 7.0: 1.14, 7.1: 1.29,
  7.2: 1.43, 7.3: 1.57, 7.4: 1.71, 7.5: 1.86, 7.6: 2.00, 7.7: 2.25,
  7.8: 2.50, 7.9: 2.75, 8.0: 3.00, 8.1: 3.25, 8.2: 3.50, 8.3: 3.75,
  8.4: 4.00, 8.5: 4.25, 8.6: 4.50, 8.7: 4.75, 8.8: 5.00, 8.9: 5.333,
  9.0: 5.666, 9.1: 6.00, 9.2: 6.333, 9.3: 6.666, 9.4: 7.00, 9.5: 7.50,
  9.6: 8.00, 9.7: 8.50, 9.8: 9.00, 9.9: 9.25, 10.0: 9.50, 10.1: 9.75,
  10.2: 10.00, 10.3: 10.50, 10.4: 11.00, 10.5: 11.333, 10.6: 11.666,
  10.7: 12.00, 10.8: 12.50, 10.9: 13.00, 11.0: 13.333, 11.1: 13.666,
  11.2: 14.00, 11.3: 14.50, 11.4: 15.00, 11.5: 15.25, 11.6: 15.50,
}

const FULL_REFERENCE: Record<RatingDimensionKey, { fullMid: number; fullAverage: number; threshold: number }> = {
  rating: { fullMid: 15.27045948521676, fullAverage: 15.29963809348486, threshold: 14.58 },
  power: { fullMid: 15.260226313838062, fullAverage: 15.290645757225318, threshold: 14.54 },
  stamina: { fullMid: 14.680215140150393, fullAverage: 14.915699776343342, threshold: 13.36 },
  speed: { fullMid: 14.245030515698776, fullAverage: 14.585896650692296, threshold: 13.99 },
  accuracy: { fullMid: 15.384801656857972, fullAverage: 15.399022586450302, threshold: 15.03 },
  rhythm: { fullMid: 14.521553509242171, fullAverage: 14.831288974113518, threshold: 14.02 },
  complex: { fullMid: 13.744459013898052, fullAverage: 14.255545767147531, threshold: 13.45 },
  burst: { fullMid: 0, fullAverage: 0, threshold: 0 },
}

const TOP_WEIGHTS = [
  ...Array(5).fill(0.4 / 5),
  ...Array(5).fill(0.3 / 5),
  ...Array(6).fill(0.2 / 6),
  ...Array(4).fill(0.1 / 4),
] as number[]

function getXFromConstant(constant: number): number {
  return CONSTANT_TO_X_MAP[constant] ?? 0.05
}

export function calculateV1SongRating(data: V1Difficulty, score: ImportedScore, title: string, key: RatingEntry['difficultyKey']): RatingEntry | null {
  const dondafuru = isDondafuruScore(score)
  if (!dondafuru && !scoreJudgementsAreValid(score, data.totalNotes)) return null
  const accuracy = dondafuru ? 1 : calculateComprehensiveAccuracy(score.good, score.ok, data.totalNotes)
  if (accuracy < 0.75 || accuracy > 1) return null

  const x = getXFromConstant(data.constant)
  const y = calcY(accuracy)
  const rating = calcSingleRating(x, y)
  const staminaRaw = data.avgDensity > data.instDensity
    ? data.avgDensity + data.avgDensity / 100 * (1 - data.instDensity / data.avgDensity) * (100 - data.avgDensity)
    : data.avgDensity - (1 - data.avgDensity / data.instDensity) * data.avgDensity
  const speedRaw = data.instDensity > data.avgDensity
    ? data.instDensity - (1 - data.avgDensity / data.instDensity) * (data.instDensity - data.avgDensity)
    : data.instDensity + (1 - data.instDensity / data.avgDensity) * (data.avgDensity - data.instDensity)
  const rhythmRaw = data.separation + data.separation / 100 * (data.bpmChange / 100) * (100 - data.separation)
  const individual = (raw: number) => Math.sqrt(rating * raw * NORMALIZATION_FACTOR / 100)

  return {
    id: score.id,
    difficulty: score.difficulty,
    difficultyKey: key,
    title,
    accuracy,
    great: score.good,
    good: score.ok,
    bad: score.bad,
    totalNotes: data.totalNotes,
    values: {
      rating,
      power: Math.sqrt(rating * x),
      stamina: individual(staminaRaw),
      speed: individual(speedRaw),
      accuracy: Math.sqrt(rating * y),
      rhythm: individual(rhythmRaw),
      complex: individual(data.composite),
    },
  }
}

function median(values: number[]): number {
  if (!values.length) return 0
  const middle = Math.floor(values.length / 2)
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2
}

function calculateSummary(entries: RatingEntry[]): RatingSummaryItem[] {
  return ratingDimensionLabels.v1.map(([key, label]) => {
    const values = topValues(entries, key)
    const mid = median(values)
    const average = weightedAverage(values, TOP_WEIGHTS)
    const reference = FULL_REFERENCE[key]
    const compensated = Number(average.toFixed(2)) >= reference.threshold
    const value = compensated
      ? mid + (average - reference.threshold) / (reference.fullAverage - reference.threshold) * (NORMALIZATION_FACTOR - reference.fullMid)
      : mid
    return { key, label, value, compensated }
  })
}

export function calculateV1Report(scores: ImportedScore[], songs: Song[], constants: Map<number, V1Song>): RatingReport {
  const entries = filterDuplicates(filterIgnoredSongs(scores.flatMap((score) => {
    const key = difficultyKey(score.difficulty)
    if (!key) return []
    const song = constants.get(score.id)
    const data = song?.constants[key]
    if (!data) return []
    const entry = calculateV1SongRating(data, score, songTitle(score.id, songs, song.title), key)
    return entry ? [entry] : []
  })))
  return { version: 'v1', entries, summary: calculateSummary(entries) }
}
