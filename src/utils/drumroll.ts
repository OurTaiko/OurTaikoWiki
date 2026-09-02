import type { RatingEntry } from './rating'

export const DRUMROLL_SPEED_ABSOLUTE_MAX = 60
const MIN_SAMPLE_SIZE = 6
const MAD_MULTIPLIER = 2
const NORMALIZED_MAD_SCALE = 1.4826
const IQR_MULTIPLIER = 1
const MEDIAN_UPPER_RATIO = 1.75
const ZERO_SPREAD_TOLERANCE_RATIO = 1.5

export interface DrumrollAnalysis {
  value: number | null
  count: number
  max: number | null
  upperBound: number
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle]
}

function quantile(sortedValues: number[], proportion: number): number {
  const index = (sortedValues.length - 1) * proportion
  const lower = Math.floor(index)
  const fraction = index - lower
  return sortedValues[lower + 1] === undefined
    ? sortedValues[lower]
    : sortedValues[lower] + fraction * (sortedValues[lower + 1] - sortedValues[lower])
}

export function getDrumrollSpeed(
  drumrollHits: number | undefined,
  rollSeconds: number | undefined,
): number | null {
  if (drumrollHits === undefined || !Number.isFinite(drumrollHits) || drumrollHits < 0) return null
  if (rollSeconds === undefined || !Number.isFinite(rollSeconds) || rollSeconds <= 0) return null
  const speed = drumrollHits / rollSeconds
  return Number.isFinite(speed) && speed >= 0 ? speed : null
}

export function getDrumrollSpeedUpperBound(speeds: number[]): number {
  const logSpeeds = speeds
    .filter((speed) => Number.isFinite(speed) && speed > 0 && speed <= DRUMROLL_SPEED_ABSOLUTE_MAX)
    .map(Math.log)

  if (logSpeeds.length < MIN_SAMPLE_SIZE) return DRUMROLL_SPEED_ABSOLUTE_MAX

  const sorted = [...logSpeeds].sort((a, b) => a - b)
  const center = median(sorted)
  const mad = median(sorted.map((speed) => Math.abs(speed - center)))
  const q1 = quantile(sorted, 0.25)
  const q3 = quantile(sorted, 0.75)
  const iqr = q3 - q1
  const fallback = center + Math.log(ZERO_SPREAD_TOLERANCE_RATIO)
  const madUpperBound = mad > 0 ? center + MAD_MULTIPLIER * NORMALIZED_MAD_SCALE * mad : fallback
  const iqrUpperBound = iqr > 0 ? q3 + IQR_MULTIPLIER * iqr : fallback
  const ratioUpperBound = center + Math.log(MEDIAN_UPPER_RATIO)

  return Math.min(
    Math.exp(Math.min(madUpperBound, iqrUpperBound, ratioUpperBound)),
    DRUMROLL_SPEED_ABSOLUTE_MAX,
  )
}

export function isDrumrollSpeedValid(speed: number, upperBound: number): boolean {
  return Number.isFinite(speed) && speed >= 0 && speed <= upperBound
}

export function analyzeDrumroll(entries: RatingEntry[], weights: number[]): DrumrollAnalysis {
  const speedByChart = new Map<string, number>()
  entries.forEach((entry) => {
    if ((entry.difficulty === 4 || entry.difficulty === 5) && entry.drumrollSpeed !== null) {
      speedByChart.set(`${entry.id}-${entry.difficulty}`, entry.drumrollSpeed)
    }
  })

  const upperBound = getDrumrollSpeedUpperBound([...speedByChart.values()])
  const top20 = entries
    .flatMap((entry) => entry.drumrollSpeed !== null && isDrumrollSpeedValid(entry.drumrollSpeed, upperBound)
      ? [entry.drumrollSpeed]
      : [])
    .sort((a, b) => b - a)
    .slice(0, 20)
  const usedWeights = weights.slice(0, top20.length)
  const weightSum = usedWeights.reduce((sum, weight) => sum + weight, 0)
  const value = weightSum > 0
    ? top20.reduce((sum, speed, index) => sum + speed * usedWeights[index], 0) / weightSum
    : null

  return { value, count: top20.length, max: top20[0] ?? null, upperBound }
}
