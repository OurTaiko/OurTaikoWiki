import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchSongs } from '../data/sources'
import type { AlgoVersion, ImportedScore, Song, SourceId, ThemeId } from '../types'

interface WikiContextValue {
  sourceId: SourceId
  setSourceId: (sourceId: SourceId) => void
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  algoVersion: AlgoVersion
  setAlgoVersion: (version: AlgoVersion) => void
  songs: Song[]
  loading: boolean
  error: string
  reload: () => void
  scores: ImportedScore[]
  previousScores: ImportedScore[]
  saveScores: (scores: ImportedScore[]) => void
}

const WikiContext = createContext<WikiContextValue | null>(null)
const SCORES_KEY = 'our-taiko-wiki:scores'
const PREVIOUS_SCORES_KEY = 'our-taiko-wiki:previous-scores'
const songCache = new Map<SourceId, Song[]>()
const songRequestCache = new Map<SourceId, Promise<Song[]>>()

function requestSongs(sourceId: SourceId, forceReload: boolean) {
  if (forceReload) songRequestCache.delete(sourceId)

  const cachedRequest = songRequestCache.get(sourceId)
  if (cachedRequest) return cachedRequest

  const request = fetchSongs(sourceId)
  songRequestCache.set(sourceId, request)
  return request
}

function readStoredScores(key: string): ImportedScore[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed as ImportedScore[] : []
  } catch {
    return []
  }
}

export function WikiProvider({ children }: { children: ReactNode }) {
  const [sourceId, setSourceIdState] = useState<SourceId>('cn')
  const [theme, setThemeState] = useState<ThemeId>(() =>
    localStorage.getItem('our-taiko-wiki:theme') === 'ffxiv' ? 'ffxiv' : 'archive',
  )
  const [algoVersion, setAlgoVersionState] = useState<AlgoVersion>(() =>
    localStorage.getItem('our-taiko-wiki:algo') === 'v1' ? 'v1' : 'v2',
  )
  const [songs, setSongs] = useState<Song[]>(() => songCache.get(sourceId) || [])
  const [loading, setLoading] = useState(!songCache.has(sourceId))
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [scores, setScores] = useState<ImportedScore[]>(() => readStoredScores(SCORES_KEY))
  const [previousScores, setPreviousScores] = useState<ImportedScore[]>(() =>
    readStoredScores(PREVIOUS_SCORES_KEY),
  )

  useEffect(() => {
    document.body.dataset.theme = theme
    localStorage.setItem('our-taiko-wiki:theme', theme)
  }, [theme])

  useEffect(() => {
    const cached = songCache.get(sourceId)
    if (cached && reloadKey === 0) {
      setSongs(cached)
      setLoading(false)
      setError('')
      return
    }

    let active = true
    setLoading(true)
    setError('')
    requestSongs(sourceId, reloadKey > 0)
      .then((nextSongs) => {
        if (!active) return
        songCache.set(sourceId, nextSongs)
        setSongs(nextSongs)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : '曲目数据加载失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [sourceId, reloadKey])

  const value = useMemo<WikiContextValue>(() => ({
    sourceId,
    setSourceId: (nextSource) => {
      localStorage.setItem('our-taiko-wiki:source', nextSource)
      setSourceIdState(nextSource)
    },
    theme,
    setTheme: setThemeState,
    algoVersion,
    setAlgoVersion: (nextAlgo) => {
      localStorage.setItem('our-taiko-wiki:algo', nextAlgo)
      setAlgoVersionState(nextAlgo)
    },
    songs,
    loading,
    error,
    reload: () => setReloadKey((key) => key + 1),
    scores,
    previousScores,
    saveScores: (nextScores) => {
      // 导入前留存一份“上次导入”快照，供 Rating 页对比增减幅
      localStorage.setItem(PREVIOUS_SCORES_KEY, JSON.stringify(scores))
      setPreviousScores(scores)

      const unique = new Map(nextScores.map((score) => [`${score.id}-${score.difficulty}`, score]))
      const merged = [...unique.values()]
      localStorage.setItem(SCORES_KEY, JSON.stringify(merged))
      setScores(merged)
    },
  }), [sourceId, theme, algoVersion, songs, loading, error, scores, previousScores])

  return <WikiContext.Provider value={value}>{children}</WikiContext.Provider>
}

export function useWiki() {
  const value = useContext(WikiContext)
  if (!value) throw new Error('useWiki must be used inside WikiProvider')
  return value
}
