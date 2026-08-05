import type { Song, SongCategory, SourceId } from '../types'

const API_BASE = 'https://cdn.ourtaiko.org/api'

interface RawCnSongType {
  type?: string
  sort?: number
}

interface RawCnSong {
  id: number
  sort?: number
  open_day?: string
  type?: string
  types?: RawCnSongType[]
  song_name_jp?: string
  song_name?: string
  subtitle?: string | null
  family?: string | boolean | null
  level_1?: number | string
  level_2?: number | string
  level_3?: number | string
  level_4?: number | string
  level_5?: number | string
}

export interface SongSourceDefinition {
  id: SourceId
  label: string
  shortLabel: string
  description: string
  endpoint: string
}

export const songSources: SongSourceDefinition[] = [
  {
    id: 'cn',
    label: 'CN 国服曲目',
    shortLabel: 'CN',
    description: '国服名称、分类、星级与上线日期',
    endpoint: `${API_BASE}/cnsongs`,
  },
]

function normalizeLevel(value: number | string | undefined): number | string | null {
  if (value === undefined || value === '' || value === '-') return null
  return value
}

function normalizeCnCategories(raw: RawCnSong): SongCategory[] {
  if (Array.isArray(raw.types)) {
    const categories = raw.types
      .filter((item): item is RawCnSongType & { type: string } => typeof item?.type === 'string' && item.type !== '')
      .map((item) => ({
        type: item.type,
        sort: typeof item.sort === 'number' && Number.isFinite(item.sort) ? item.sort : raw.sort ?? raw.id,
      }))
    if (categories.length > 0) return categories
  }

  // 兼容没有 types 字段的旧数据：退回到顶层 type/sort
  return [{ type: raw.type || '未分类', sort: raw.sort ?? raw.id }]
}

function normalizeCnSong(raw: RawCnSong): Song {
  return {
    id: Number(raw.id),
    title: raw.song_name || raw.song_name_jp || `曲目 ${raw.id}`,
    titleJp: raw.song_name_jp || '',
    subtitle: raw.subtitle || '',
    categories: normalizeCnCategories(raw),
    family: typeof raw.family === 'string' ? raw.family : '',
    openDay: raw.open_day || '',
    levels: {
      easy: normalizeLevel(raw.level_1),
      normal: normalizeLevel(raw.level_2),
      hard: normalizeLevel(raw.level_3),
      oni: normalizeLevel(raw.level_4),
      ura: normalizeLevel(raw.level_5),
    },
    source: 'cn',
  }
}

export async function fetchSongs(sourceId: SourceId, signal?: AbortSignal): Promise<Song[]> {
  const source = songSources.find((item) => item.id === sourceId) ?? songSources[0]
  const response = await fetch(source.endpoint, { signal })
  if (!response.ok) throw new Error(`曲目数据请求失败（HTTP ${response.status}）`)

  const payload: unknown = await response.json()
  if (!Array.isArray(payload)) throw new Error('曲目数据格式不正确')

  const songs = (payload as RawCnSong[]).map(normalizeCnSong)

  return songs.filter((song) => Number.isFinite(song.id))
}
