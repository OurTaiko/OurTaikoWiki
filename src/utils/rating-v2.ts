import type { DifficultyKey, ImportedScore, Song, V1Difficulty, V1Song, V2Difficulty, V2DifficultyKey, V2SongMap } from '../types'
import { analyzeDrumroll, getDrumrollSpeed } from './drumroll'
import {
  NORMALIZATION_FACTOR,
  calculateComprehensiveAccuracy,
  calcSingleRating,
  calcY,
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

interface FlatV2Song extends V2Difficulty {
  id: number
  difficulty: number
  difficultyKey: RatingEntry['difficultyKey']
}

const WEIGHTS_A = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const WEIGHTS_B = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
const V2_DIFFICULTIES: Array<{ sourceKey: V2DifficultyKey; difficulty: number; difficultyKey: DifficultyKey }> = [
  { sourceKey: 'hard', difficulty: 3, difficultyKey: 'hard' },
  { sourceKey: 'oni', difficulty: 4, difficultyKey: 'oni' },
  { sourceKey: 'edit', difficulty: 5, difficultyKey: 'ura' },
]

function flattenDatabase(data: V2SongMap): FlatV2Song[] {
  return Object.entries(data).flatMap(([id, difficulties]) => V2_DIFFICULTIES.flatMap(({ sourceKey, difficulty, difficultyKey }) => {
    const item = difficulties[sourceKey]
    return item ? [{ ...item, id: Number(id), difficulty, difficultyKey }] : []
  }))
}

function calculateValues(song: FlatV2Song, accuracyPer: number, badPer: number): RatingEntry['values'] | null {
  if (accuracyPer < 0 || accuracyPer > 1 || badPer < 0 || badPer > 1) return null
  const accuracy = calcY(accuracyPer)
  const rt90 = calcSingleRating(song.sub_constant_1, calcY(0.9))
  const rt95Ref = calcSingleRating(song.sub_constant_1, calcY(0.95))
  const rt95 = calcSingleRating(song.main_constant, calcY(0.95))
  const rt100Ref = calcSingleRating(song.main_constant, calcY(1))
  const rt100 = calcSingleRating(song.sub_constant_2, calcY(1))
  const initialConstant = accuracyPer <= 0.95 ? song.sub_constant_1 : song.main_constant
  const initialRating = calcSingleRating(initialConstant, accuracy)

  let rating: number
  if (accuracyPer <= 0.9) rating = initialRating
  else if (accuracyPer <= 0.95) rating = rt90 + (rt95 - rt90) * (initialRating - rt90) / (rt95Ref - rt90)
  else rating = rt95 + (rt100 - rt95) * (initialRating - rt95) / (rt100Ref - rt95)

  const accuracyRating = Math.min(rating, accuracy) + Math.log(Math.max(rating, accuracy) - Math.min(rating, accuracy) + 1)
  const stamina = calcSingleRating(song.stamina, accuracy)
  const speed = calcSingleRating(song.handspeed, accuracy)
  const burstBase = calcSingleRating(song.burst, accuracy)
  const speedFactor = song.handspeed > 0 ? Math.min(accuracy / song.handspeed, 1) : 1
  const adjustedBurst = burstBase * speedFactor
  const burst = adjustedBurst > speed && song.burst !== song.handspeed
    ? speed + Math.min(Math.max(accuracy - song.handspeed, 0) / (song.burst - song.handspeed), 1) * (adjustedBurst - speed)
    : adjustedBurst

  // 原 v2 算法中，badPer 只在这里修正复合维度：0% 不可时系数为 1，3% 及以上时为 0.5。
  const complexBase = calcSingleRating(song.complex, accuracy)
  const complexPenalty = 5000 / 9 * Math.pow(Math.max(0.03 - badPer, 0), 2) + 0.5

  return {
    rating,
    stamina,
    speed,
    burst,
    complex: complexBase * complexPenalty,
    rhythm: calcSingleRating(song.rhythm, accuracy) * speedFactor,
    accuracy: accuracyRating,
  }
}

function calculateEntry(
  song: FlatV2Song,
  score: ImportedScore,
  title: string,
  timing?: Pick<V1Difficulty, 'rollSeconds' | 'balloonCount'>,
): RatingEntry | null {
  const dondafuru = isDondafuruScore(score)
  if (!dondafuru && !scoreJudgementsAreValid(score, song.totalNotes)) return null
  const accuracy = dondafuru ? 1 : calculateComprehensiveAccuracy(score.good, score.ok, song.totalNotes)
  if (accuracy < 0.75) return null
  const badPer = dondafuru ? 0 : song.totalNotes > 0 ? score.bad / song.totalNotes : 0
  const values = calculateValues(song, Math.max(0, Math.min(1, accuracy)), Math.max(0, Math.min(1, badPer)))
  if (!values || !Object.values(values).every(Number.isFinite)) return null
  return {
    id: score.id,
    difficulty: score.difficulty,
    difficultyKey: song.difficultyKey,
    title,
    accuracy,
    great: score.good,
    good: score.ok,
    bad: score.bad,
    totalNotes: song.totalNotes,
    drumrollSpeed: getDrumrollSpeed(score.drumroll - (timing?.balloonCount ?? 0), timing?.rollSeconds),
    values,
  }
}

export function calculateV2SongRating(
  data: V2Difficulty,
  score: ImportedScore,
  title: string,
  difficultyKey: RatingEntry['difficultyKey'],
): RatingEntry | null {
  return calculateEntry({
    ...data,
    id: score.id,
    difficulty: score.difficulty,
    difficultyKey,
  }, score, title)
}

interface FullReference {
  threshold: number
  fullB: number
}

function calculateFullReferences(songs: FlatV2Song[]): Record<RatingDimensionKey, FullReference> {
  const perfectEntries = songs.map((song) => ({
    id: song.id,
    difficulty: song.difficulty,
    difficultyKey: song.difficultyKey,
    title: '',
    accuracy: 1,
    great: song.totalNotes,
    good: 0,
    bad: 0,
    totalNotes: song.totalNotes,
    drumrollSpeed: null,
    values: calculateValues(song, 1, 0) || { rating: 0 },
  })) as RatingEntry[]

  return Object.fromEntries(ratingDimensionLabels.v2.map(([key]) => {
    const values = topValues(perfectEntries, key)
    return [key, { threshold: 14, fullB: weightedAverage(values, WEIGHTS_B) }]
  })) as Record<RatingDimensionKey, FullReference>
}

function calculateSummary(entries: RatingEntry[], songs: FlatV2Song[]): RatingSummaryItem[] {
  const refs = calculateFullReferences(songs)
  return ratingDimensionLabels.v2.map(([key, label]) => {
    const values = topValues(entries, key)
    const playerA = weightedAverage(values, WEIGHTS_A)
    const playerB = weightedAverage(values, WEIGHTS_B)
    const reference = refs[key]
    const compensated = playerB >= reference.threshold && reference.fullB > reference.threshold
    const progress = compensated ? (playerB - reference.threshold) / (reference.fullB - reference.threshold) : 0
    const value = compensated ? playerA + progress * (NORMALIZATION_FACTOR - playerA) : playerA
    return { key, label, value, compensated }
  })
}

export function calculateV2Report(
  scores: ImportedScore[],
  songs: Song[],
  constants: V2SongMap,
  v1Constants: Map<number, V1Song>,
): RatingReport {
  const database = flattenDatabase(constants)
  const byKey = new Map(database.map((song) => [`${song.id}-${song.difficulty}`, song]))
  const entries = filterDuplicates(filterIgnoredSongs(scores.flatMap((score) => {
    const song = byKey.get(`${score.id}-${score.difficulty}`)
    if (!song) return []
    const timing = v1Constants.get(score.id)?.constants[song.difficultyKey]
    const entry = calculateEntry(song, score, songTitle(score.id, songs), timing)
    return entry ? [entry] : []
  })))
  return {
    version: 'v2',
    entries,
    summary: calculateSummary(entries, database),
    drumroll: analyzeDrumroll(entries, WEIGHTS_A),
  }
}
