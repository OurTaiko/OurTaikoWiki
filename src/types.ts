export const difficultyKeys = ['easy', 'normal', 'hard', 'oni', 'ura'] as const

export type DifficultyKey = (typeof difficultyKeys)[number]
export type ThemeId = 'archive' | 'ffxiv'
export type SourceId = 'cn'
export type AlgoVersion = 'v1' | 'v2'

export interface Song {
  id: number
  title: string
  titleJp: string
  subtitle: string
  category: string
  family: string
  openDay: string
  sort: number
  levels: Record<DifficultyKey, number | string | null>
  source: SourceId
}

export interface V1Difficulty {
  constant: number
  totalNotes: number
  composite: number
  avgDensity: number
  instDensity: number
  separation: number
  bpmChange: number
  hsChange: number
}

export interface V1Song {
  id: number
  title: string
  constants: Partial<Record<DifficultyKey, V1Difficulty>>
}

export interface V2Difficulty {
  sub_constant_1: number
  main_constant: number
  sub_constant_2: number
  stamina: number
  handspeed: number
  burst: number
  complex: number
  rhythm: number
  totalNotes: number
}

export type V2DifficultyKey = 'hard' | 'oni' | 'edit'
export type V2SongMap = Record<string, Partial<Record<V2DifficultyKey, V2Difficulty>>>

export interface ImportedScore {
  id: number
  difficulty: number
  highScore: number
  scoreRank: number | string
  good: number
  ok: number
  bad: number
  drumroll: number
  combo: number
  plays: number
  clears: number
  fullCombos: number
  perfects: number
  updatedAt: string
}
