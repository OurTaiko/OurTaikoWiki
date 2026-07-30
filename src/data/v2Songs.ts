import type { SongData } from '@utils/rating_v2'

const GUGU_CONSTANTS_URL = 'https://cdn.ourtaiko.org/api/gugu_constants'
const FUMEN_CONSTANTS_URL = 'https://cdn.ourtaiko.org/api/fumendb_constants'

const DIFFICULTY_MAP = {
  hard: 3,
  oni: 4,
  edit: 5,
} as const

type DifficultyName = keyof typeof DIFFICULTY_MAP

interface GuguDifficulty {
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

type GuguConstantsResponse = Record<
  string,
  Partial<Record<DifficultyName, GuguDifficulty>>
>

interface FumenTitle {
  id: number | string
  title: string
}

export interface V2SongMeta {
  title: string
  totalNotes: number
}

export interface V2SongsData {
  songs: SongData[]
  meta: Map<string, V2SongMeta>
}

function parseNumericId(id: string): number | null {
  if (!/^\d+$/.test(id)) return null

  const numericId = Number(id)
  return Number.isSafeInteger(numericId) ? numericId : null
}

function isValidDifficulty(data: unknown): data is GuguDifficulty {
  if (!data || typeof data !== 'object') return false

  const values = data as Record<keyof GuguDifficulty, unknown>
  return [
    values.sub_constant_1,
    values.main_constant,
    values.sub_constant_2,
    values.stamina,
    values.handspeed,
    values.burst,
    values.complex,
    values.rhythm,
    values.totalNotes,
  ].every(value => typeof value === 'number' && Number.isFinite(value))
}

export function parseGuguConstants(
  constants: GuguConstantsResponse,
  titles: FumenTitle[] = [],
): V2SongsData {
  const titleMap = new Map(titles.map(song => [String(song.id), song.title]))
  const songs: SongData[] = []
  const meta = new Map<string, V2SongMeta>()

  for (const [rawId, difficulties] of Object.entries(constants)) {
    const id = parseNumericId(rawId)
    if (id === null) continue

    for (const difficultyName of Object.keys(DIFFICULTY_MAP) as DifficultyName[]) {
      const data = difficulties[difficultyName]
      if (!isValidDifficulty(data)) continue

      const difficulty = DIFFICULTY_MAP[difficultyName]
      songs.push({
        id,
        difficulty,
        stamina: data.stamina,
        handspeed: data.handspeed,
        burst: data.burst,
        complex: data.complex,
        rhythm: data.rhythm,
        main_constant: data.main_constant,
        sub_constant_1: data.sub_constant_1,
        sub_constant_2: data.sub_constant_2,
      })

      meta.set(`${id}-${difficulty}`, {
        title: titleMap.get(rawId) ?? '',
        totalNotes: data.totalNotes,
      })
    }
  }

  return { songs, meta }
}

async function loadTitles(): Promise<FumenTitle[]> {
  try {
    const response = await fetch(FUMEN_CONSTANTS_URL)
    if (!response.ok) return []
    return await response.json() as FumenTitle[]
  } catch {
    return []
  }
}

export async function loadV2SongsData(): Promise<V2SongsData> {
  const [constantsResponse, titles] = await Promise.all([
    fetch(GUGU_CONSTANTS_URL),
    loadTitles(),
  ])

  if (!constantsResponse.ok) {
    throw new Error(`HTTP ${constantsResponse.status}`)
  }

  const constants = await constantsResponse.json() as GuguConstantsResponse
  return parseGuguConstants(constants, titles)
}
