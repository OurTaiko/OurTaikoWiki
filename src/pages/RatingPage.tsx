import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, Import, Info, LoaderCircle, Medal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ImportDialog } from '../components/ImportDialog'
import { RadarChart, type RadarMetric } from '../components/RadarChart'
import { useWiki } from '../context/WikiContext'
import { loadV1Constants, loadV2Constants } from '../data/constants'
import type { V1Song, V2SongMap } from '../types'
import {
  ratingDimensionLabels,
  type RatingDimensionKey,
  type RatingReport,
} from '../utils/rating'
import { calculateV1Report } from '../utils/rating-v1'
import { calculateV2Report } from '../utils/rating-v2'

const DIFFICULTY_LABELS = ['简单', '普通', '困难', '魔王', '里魔王']

function ResultTable({ report, dimension }: { report: RatingReport; dimension: RatingDimensionKey }) {
  const label = report.summary.find((item) => item.key === dimension)?.label || 'Rating'
  const entries = [...report.entries]
    .filter((entry) => Number.isFinite(entry.values[dimension]))
    .sort((a, b) => (b.values[dimension] || 0) - (a.values[dimension] || 0))
    .slice(0, 20)

  return (
    <section className="rating-ranking panel">
      <header className="rating-ranking__header">
        <div>
          <span className="eyebrow"><Medal size={14} /> TOP 20</span>
          <h2>{label} · 代表成绩</h2>
        </div>
        <p>按当前维度从高到低排列</p>
      </header>
      <div className="rating-table-wrap">
        <table className="rating-table">
          <thead>
            <tr><th>#</th><th>曲目</th><th>难度</th><th>综合良率</th><th>{label}</th><th>判定</th><th aria-label="查看曲目" /></tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={`${entry.id}-${entry.difficulty}`}>
                <td><span className={`rank-number rank-${index + 1}`}>{String(index + 1).padStart(2, '0')}</span></td>
                <td><Link to={`/songs/${entry.id}`}><strong>{entry.title}</strong><small>ID {entry.id}</small></Link></td>
                <td><span className={`rating-difficulty difficulty-${entry.difficultyKey}`}>{DIFFICULTY_LABELS[entry.difficulty - 1]}</span></td>
                <td className="rating-mono">{(entry.accuracy * 100).toFixed(2)}%</td>
                <td className="rating-value">{entry.values[dimension]?.toFixed(2)}</td>
                <td className="rating-judgements"><span>良 {entry.great}</span><span>可 {entry.good}</span><span>不可 {entry.bad}</span></td>
                <td><Link className="rating-row-link" to={`/songs/${entry.id}`} aria-label={`查看 ${entry.title}`}><ArrowUpRight /></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function RatingPage() {
  const { scores, songs, algoVersion } = useWiki()
  const [dimension, setDimension] = useState<RatingDimensionKey>('rating')
  const [v1, setV1] = useState<Map<number, V1Song>>()
  const [v2, setV2] = useState<V2SongMap>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([loadV1Constants(), loadV2Constants()])
      .then(([nextV1, nextV2]) => {
        if (!active) return
        setV1(nextV1)
        setV2(nextV2)
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Rating 定数加载失败')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    setDimension('rating')
  }, [algoVersion])

  const report = useMemo(() => {
    if (!v1 || !v2) return undefined
    return algoVersion === 'v1'
      ? calculateV1Report(scores, songs, v1)
      : calculateV2Report(scores, songs, v2)
  }, [algoVersion, scores, songs, v1, v2])

  const radarMetrics = useMemo<RadarMetric[]>(() => report?.summary
    .filter((item) => item.key !== 'rating')
    .map((item) => ({ label: item.label, value: item.value })) || [], [report])

  const currentSummary = report?.summary.find((item) => item.key === dimension)

  return (
    <main className="page-shell rating-page">
      {loading && <section className="rating-state panel"><LoaderCircle className="spin" /><h2>正在整理 Rating 档案</h2><p>正在读取 v1 与 v2 定数数据库…</p></section>}
      {!loading && error && <section className="rating-state panel"><Info /><h2>暂时无法计算 Rating</h2><p>{error}</p></section>}
      {!loading && !error && !scores.length && (
        <section className="rating-state panel">
          <span className="rating-state__mark">零</span><h2>先导入一份成绩档案</h2>
          <p>支持菌菌、Sakura 和 JSON。导入后这里会自动生成你的 Rating 报告。</p>
          <button className="primary-button" type="button" onClick={() => setImportOpen(true)}><Import size={17} />导入成绩</button>
        </section>
      )}
      {!loading && !error && scores.length > 0 && report && report.entries.length === 0 && (
        <section className="rating-state panel">
          <span className="rating-state__mark">?</span><h2>没有可用于 {algoVersion.toUpperCase()} 的成绩</h2>
          <p>当前成绩未匹配到定数，或综合良率未达到算法的最低计算区间。你可以切换算法或重新导入最新成绩。</p>
        </section>
      )}

      {!loading && !error && report && report.entries.length > 0 && (
        <>
          <section className="rating-overview">
            <div className="rating-overview__main panel">
              <header><div><span className="eyebrow"><BarChart3 size={14} /> OVERVIEW</span><h2>综合能力</h2></div><span>{report.entries.length} 首有效成绩</span></header>
              <div className="rating-scoreboard">
                <div className="rating-total"><span>RATING</span><strong>{report.summary[0].value.toFixed(2)}</strong><small>{report.summary[0].compensated ? 'TOP 20 BONUS APPLIED' : `${algoVersion.toUpperCase()} REPORT`}</small></div>
                <div className="rating-dimensions">
                  {report.summary.slice(1).map((item) => (
                    <button key={item.key} type="button" onClick={() => setDimension(item.key)} className={dimension === item.key ? 'is-active' : ''}>
                      <span>{item.label}{item.compensated && <i title="高水平补偿已生效">+</i>}</span><strong>{item.value.toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <RadarChart title={`${algoVersion.toUpperCase()} 能力轮廓`} metrics={radarMetrics} />
          </section>

          <nav className="rating-dimension-nav" aria-label="Rating 维度">
            {ratingDimensionLabels[algoVersion].map(([key, label]) => (
              <button key={key} type="button" className={dimension === key ? 'is-active' : ''} onClick={() => setDimension(key)}>
                <span>{label}</span><b>{report.summary.find((item) => item.key === key)?.value.toFixed(2)}</b>
              </button>
            ))}
          </nav>

          {currentSummary?.compensated && <p className="rating-compensation-note"><Info size={14} />当前维度已达到高水平补偿区间，显示值包含 Top 20 稳定性补偿。</p>}
          <ResultTable report={report} dimension={dimension} />
        </>
      )}
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </main>
  )
}
