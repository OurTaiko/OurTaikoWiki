export interface RatingDimensions {
  rating: number
  daigouryoku: number
  stamina: number
  speed: number
  accuracy_power: number
  rhythm: number
  complex: number
}

export interface ScoreCounts {
  great: number
  good: number
  bad: number
}

export interface SongLevelData {
  constant: number
  totalNotes: number
  rollSeconds?: number
  balloonCount?: number
  composite: number
  avgDensity: number
  instDensity: number
  separation: number
  bpmChange: number
  hsChange: number
}

export interface SongData {
  id: number
  title: string
  is_cn?: boolean
  title_cn?: string
  level: {
    '4'?: SongLevelData
    '5'?: SongLevelData
  }
}

export interface UserScore extends ScoreCounts {
  id: number
  level: number
  score: number
  scoreRank: number
  drumroll: number
  combo: number
  playCount: number
  clearCount: number
  fullcomboCount: number
  perfectCount: number
  updatedAt: string
}

export interface SongStats extends RatingDimensions, ScoreCounts {
  id: number
  level: number
  title: string
  _constant?: number
  _maxRatings?: RatingDimensions
  _dimensionRanks?: Record<keyof RatingDimensions, number>
  _isUnplayed?: boolean
  _isNew?: boolean
  _ratingDiff?: number
  _dimensionDiffs?: Record<keyof RatingDimensions, number>
  _drumrollHits?: number
  _rollSeconds?: number
}

export type SongsDatabase = SongData[]

export type LockedScores = Record<string, UserScore>

export type RatingAlgorithm = 'great-only' | 'comprehensive'

// API 数据类型定义
export interface FumenDifficulty {
  constant: number
  totalNotes: number
  rollSeconds?: number
  balloonCount?: number
  composite: number
  avgDensity: number
  instDensity: number
  separation: number
  bpmChange: number
  hsChange: number
}

export interface FumenDataItem {
  id: number
  title: string
  constants: {
    easy?: FumenDifficulty
    normal?: FumenDifficulty
    hard?: FumenDifficulty
    oni?: FumenDifficulty
    ura?: FumenDifficulty
  }
}

export interface SongsCNItem {
  id: number
  song_name_jp: string
  song_name: string
  type: string
  level_1?: number | string
  level_2?: number | string
  level_3?: number | string
  level_4?: number | string
  level_5?: number | string
  subtitle?: string | null
  family?: string | null
  tag?: string
  sort?: number
  open_day?: string
}
