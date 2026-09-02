import { useCallback, useEffect, useMemo, useState } from 'react'
import { History, Info, LoaderCircle, RefreshCcw } from 'lucide-react'
import type { AlgoVersion, Song, V1Song, V2SongMap } from '../types'
import type { RatingDimensionKey, RatingEntry, RatingReport } from '../utils/rating'
import { calculateV1Report } from '../utils/rating-v1'
import { calculateV2Report } from '../utils/rating-v2'
import { fetchGistScoreHistory, SCORE_SYNCED_EVENT, type GistScoreHistory, type GistScoreRevision } from '../utils/cloudSync'

const DIFFICULTY_LABELS = ['', '简单', '普通', '困难', '魔王', '里魔王']
const SNAPSHOT_PAGE_SIZE = 10
const CHANGE_PREVIEW_SIZE = 20

interface RatingHistoryProps {
  githubToken: string
  songs: Song[]
  algoVersion: AlgoVersion
  v1: Map<number, V1Song>
  v2: V2SongMap
}

interface RevisionReport {
  revision: GistScoreRevision
  report: RatingReport
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN')
}

function formatDelta(value: number): string {
  if (Math.abs(value) < 0.005) return '±0.00'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function findEntry(report: RatingReport | undefined, id: number, difficulty: number): RatingEntry | undefined {
  return report?.entries.find((entry) => entry.id === id && entry.difficulty === difficulty)
}

function rankedEntries(report: RatingReport | undefined, key: RatingDimensionKey): RatingEntry[] {
  return report?.entries
    .filter((entry) => Number.isFinite(entry.values[key]))
    .sort((a, b) => (b.values[key] ?? 0) - (a.values[key] ?? 0))
    .slice(0, 20) ?? []
}

function b20Contribution(
  report: RatingReport | undefined,
  key: RatingDimensionKey,
  id: number,
  difficulty: number,
): number {
  if (!report) return 0
  const entries = rankedEntries(report, key)
  const index = entries.findIndex((entry) => entry.id === id && entry.difficulty === difficulty)
  if (index < 0) return 0
  const value = entries[index].values[key] ?? 0
  if (report.version === 'v1') {
    const middle = Math.floor(entries.length / 2)
    if (entries.length % 2) return index === middle ? value : 0
    return index === middle - 1 || index === middle ? value / 2 : 0
  }
  const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
  const weightSum = weights.slice(0, entries.length).reduce((sum, weight) => sum + weight, 0)
  return weightSum ? value * weights[index] / weightSum : 0
}

interface SongDimension {
  key: RatingDimensionKey
  label: string
  previousValue: number | undefined
  currentValue: number | undefined
  impact: 'positive' | 'negative' | null
}

function songDimensions(
  report: RatingReport,
  olderReport: RatingReport | undefined,
  id: number,
  difficulty: number,
): SongDimension[] {
  const currentEntry = findEntry(report, id, difficulty)
  const olderEntry = findEntry(olderReport, id, difficulty)
  return report.summary.filter(({ key }) => key !== 'rating').map(({ key, label }) => {
    const currentContribution = b20Contribution(report, key, id, difficulty)
    const previousContribution = b20Contribution(olderReport, key, id, difficulty)
    const delta = currentContribution - previousContribution
    return {
      key,
      label,
      previousValue: olderEntry?.values[key],
      currentValue: currentEntry?.values[key],
      impact: Math.abs(delta) < 0.000005 ? null : delta > 0 ? 'positive' : 'negative',
    }
  })
}

export function RatingHistory({ githubToken, songs, algoVersion, v1, v2 }: RatingHistoryProps) {
  const [histories, setHistories] = useState<GistScoreHistory[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [visibleSnapshots, setVisibleSnapshots] = useState<Record<string, number>>({})
  const [expandedChanges, setExpandedChanges] = useState<Record<string, boolean>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setHistories(await fetchGistScoreHistory(githubToken))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '历史成绩读取失败')
    } finally {
      setLoading(false)
    }
  }, [githubToken])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const refresh = () => void load()
    window.addEventListener(SCORE_SYNCED_EVENT, refresh)
    return () => window.removeEventListener(SCORE_SYNCED_EVENT, refresh)
  }, [load])

  const songNames = useMemo(() => new Map(songs.map((song) => [song.id, song.title])), [songs])
  const timelines = useMemo(() => histories?.map((history) => ({
    filename: history.filename,
    revisions: history.revisions.map((revision): RevisionReport => ({
      revision,
      report: algoVersion === 'v1'
        ? calculateV1Report(revision.scores, songs, v1)
        : calculateV2Report(revision.scores, songs, v2, v1),
    })),
  })) ?? [], [algoVersion, histories, songs, v1, v2])

  if (loading) {
    return <section className="rating-state panel"><LoaderCircle className="spin" /><h2>正在读取云端历史</h2><p>正在回溯每次同步的成绩变化…</p></section>
  }

  if (error) {
    return <section className="rating-state panel"><Info /><h2>历史成绩读取失败</h2><p>{error}</p><button className="primary-button" type="button" onClick={() => void load()}><RefreshCcw size={17} />重试</button></section>
  }

  if (!timelines.length) {
    return <section className="rating-state panel"><History /><h2>还没有历史成绩</h2><p>使用 GitHub Token 同步一次成绩后，这里会显示云端保存的历史档案。</p></section>
  }

  return (
    <section className="rating-history panel">
      <header className="rating-history__header">
        <div><span className="eyebrow"><History size={14} /> SCORE HISTORY</span><h2>历史成绩变化</h2><p>按每次云同步回溯成绩；Rating 使用当前选择的 {algoVersion.toUpperCase()} 算法重新计算。</p></div>
        <button className="secondary-button" type="button" onClick={() => void load()}><RefreshCcw size={16} />刷新</button>
      </header>

      {timelines.map((timeline) => (
        <article className="rating-history__timeline" key={timeline.filename}>
          <div className="rating-history__revisions">
            {timeline.revisions.slice(0, visibleSnapshots[timeline.filename] ?? SNAPSHOT_PAGE_SIZE).map(({ revision, report }, index) => {
              const olderReport = timeline.revisions[index + 1]?.report
              const rating = report.summary.find((item) => item.key === 'rating')?.value ?? 0
              const olderRating = olderReport?.summary.find((item) => item.key === 'rating')?.value
              const ratingDelta = olderRating === undefined ? null : rating - olderRating
              const revisionKey = `${timeline.filename}-${revision.version}-${revision.committedAt}`
              const visibleChanges = expandedChanges[revisionKey] ? revision.changes : revision.changes.slice(0, CHANGE_PREVIEW_SIZE)
              return (
                <details key={`${revision.version}-${revision.committedAt}`} open={index === 0}>
                  <summary>
                    <span><b>{formatDate(revision.committedAt)}</b><small>{index === timeline.revisions.length - 1 ? '初始快照' : `${revision.changes.length} 项成绩变化`}</small></span>
                    <span className="rating-history__rating"><small>RATING</small><b>{rating.toFixed(2)}</b>{ratingDelta !== null && <em className={ratingDelta > 0 ? 'is-positive' : ratingDelta < 0 ? 'is-negative' : ''}>{formatDelta(ratingDelta)}</em>}</span>
                  </summary>
                  <div className="rating-history__detail">
                    <div className="rating-history__metrics">
                      {report.summary.map((item) => {
                        const olderValue = olderReport?.summary.find((older) => older.key === item.key)?.value
                        const delta = olderValue === undefined ? null : item.value - olderValue
                        return <div key={item.key}><span>{item.label}</span><strong>{item.value.toFixed(2)}</strong>{delta !== null && <small className={delta > 0 ? 'is-positive' : delta < 0 ? 'is-negative' : ''}>{formatDelta(delta)}</small>}</div>
                      })}
                    </div>
                    <div className="rating-history__changes">
                      <h3>成绩变化 <small>共 {revision.totalScores} 条成绩</small></h3>
                      {index === timeline.revisions.length - 1 ? <p>这是首个历史快照，后续导入会与此版本比较。</p> : revision.changes.length === 0 ? <p>该版本没有可识别的成绩变化。</p> : visibleChanges.map((change) => {
                        const previousScore = change.previous?.highScore
                        const currentScore = change.current?.highScore
                        const difference = previousScore !== undefined && currentScore !== undefined ? currentScore - previousScore : null
                        const dimensions = songDimensions(report, olderReport, change.id, change.difficulty)
                        return (
                          <div className="rating-history__change" key={`${change.id}-${change.difficulty}`}>
                            <div className="rating-history__change-heading">
                              <span><b>{songNames.get(change.id) || `曲目 #${change.id}`}</b><small>{DIFFICULTY_LABELS[change.difficulty] || `难度 ${change.difficulty}`}</small></span>
                              <span>
                              {change.current === null ? <b className="is-negative">已移除</b> : change.previous === null ? <><small>新增</small><b>{currentScore?.toLocaleString()}</b></> : <><small>{previousScore?.toLocaleString()} →</small><b>{currentScore?.toLocaleString()}</b>{difference !== null && difference !== 0 && <em className={difference > 0 ? 'is-positive' : 'is-negative'}>{difference > 0 ? '+' : ''}{difference.toLocaleString()}</em>}</>}
                              </span>
                            </div>
                            <div className="rating-history__song-dimensions">
                              {dimensions.map((dimension) => (
                                <div key={dimension.key} className={dimension.impact ? `is-${dimension.impact}` : ''} title={dimension.impact ? `对 B20 ${algoVersion === 'v1' ? '中位数' : '加权值'}产生${dimension.impact === 'positive' ? '上升' : '下降'}影响` : '未影响 B20'}>
                                  <span>{dimension.label}</span>
                                  <strong>{dimension.currentValue?.toFixed(2) ?? '—'}</strong>
                                  {dimension.previousValue !== undefined && dimension.currentValue !== undefined && Math.abs(dimension.currentValue - dimension.previousValue) >= 0.005 && <small>{formatDelta(dimension.currentValue - dimension.previousValue)}</small>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                      {revision.changes.length > CHANGE_PREVIEW_SIZE && <button className="rating-history__more-changes" type="button" onClick={() => setExpandedChanges((current) => ({ ...current, [revisionKey]: !current[revisionKey] }))}>
                        {expandedChanges[revisionKey] ? '收起成绩变化' : `再显示 ${revision.changes.length - CHANGE_PREVIEW_SIZE} 项变化`}
                      </button>}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
          {(visibleSnapshots[timeline.filename] ?? SNAPSHOT_PAGE_SIZE) < timeline.revisions.length && <button className="rating-history__load-more" type="button" onClick={() => setVisibleSnapshots((current) => ({ ...current, [timeline.filename]: (current[timeline.filename] ?? SNAPSHOT_PAGE_SIZE) + SNAPSHOT_PAGE_SIZE }))}>
            显示更早的快照（剩余 {timeline.revisions.length - (visibleSnapshots[timeline.filename] ?? SNAPSHOT_PAGE_SIZE)} 个）
          </button>}
        </article>
      ))}
    </section>
  )
}
