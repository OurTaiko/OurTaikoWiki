import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, BarChart3, Calculator, Import, Info, LoaderCircle, Medal, ShieldCheck, Sparkles } from 'lucide-react'
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
  type RatingVersion,
} from '../utils/rating'
import { calculateV1Report } from '../utils/rating-v1'
import { calculateV2Report } from '../utils/rating-v2'

const DIFFICULTY_LABELS = ['简单', '普通', '困难', '魔王', '里谱面']

const VERSION_COPY: Record<RatingVersion, { eyebrow: string; title: string; description: string; formula: string }> = {
  v1: {
    eyebrow: 'STRUCTURE MODEL',
    title: 'V1 · 结构定数',
    description: '沿用经典 Rating 报告，以谱面结构定数、达成率和 Top 20 成绩描绘综合能力。',
    formula: '良率 = (良 + 可 ÷ 2) ÷ 总音符数',
  },
  v2: {
    eyebrow: 'ABILITY MODEL',
    title: 'V2 · 能力定数',
    description: '按不同达成率使用分段定数，并将表现拆分为体力、手速、爆发、精度、节奏与复合。',
    formula: '使用综合良率，并在高水平区间启用 Top 20 补偿',
  },
}

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
  const { scores, songs } = useWiki()
  const [version, setVersion] = useState<RatingVersion>('v1')
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
  }, [version])

  const report = useMemo(() => {
    if (!v1 || !v2) return undefined
    return version === 'v1'
      ? calculateV1Report(scores, songs, v1)
      : calculateV2Report(scores, songs, v2)
  }, [version, scores, songs, v1, v2])

  const radarMetrics = useMemo<RadarMetric[]>(() => report?.summary
    .filter((item) => item.key !== 'rating')
    .map((item) => ({ label: item.label, value: item.value, max: 15.5 })) || [], [report])

  const copy = VERSION_COPY[version]
  const currentSummary = report?.summary.find((item) => item.key === dimension)

  return (
    <main className="page-shell rating-page">
      <section className="rating-hero">
        <div className="rating-hero__copy">
          <span className="eyebrow"><Sparkles size={14} /> PLAYER RATING</span>
          <h1>把每一次敲击，<br /><i>汇成你的能力轮廓。</i></h1>
          <p>从已导入的最佳成绩中计算综合 Rating 与六项能力。可在 v1 与 v2 算法间切换，成绩始终只保存在当前浏览器。</p>
          <div className="rating-hero__actions">
            <button className="primary-button" type="button" onClick={() => setImportOpen(true)}><Import size={17} />{scores.length ? '更新成绩' : '导入成绩'}</button>
            <span><ShieldCheck size={16} />已读取 {scores.length} 条本地成绩</span>
          </div>
        </div>
        <div className="rating-version-switch panel" role="tablist" aria-label="Rating 算法版本">
          <span className="rating-version-switch__label">ALGORITHM</span>
          {(['v1', 'v2'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={version === item} className={version === item ? 'is-active' : ''} onClick={() => setVersion(item)}>
              <b>{item.toUpperCase()}</b><span>{item === 'v1' ? '结构定数' : '能力定数'}</span>
            </button>
          ))}
          <i aria-hidden="true" />
        </div>
      </section>

      <section className="rating-algorithm-note panel">
        <div><span className="eyebrow">{copy.eyebrow}</span><h2>{copy.title}</h2><p>{copy.description}</p></div>
        <div className="rating-formula"><Calculator /><span>本页计算口径</span><strong>{copy.formula}</strong></div>
      </section>

      {loading && <section className="rating-state panel"><LoaderCircle className="spin" /><h2>正在整理 Rating 档案</h2><p>正在读取 v1 与 v2 定数数据库…</p></section>}
      {!loading && error && <section className="rating-state panel"><Info /><h2>暂时无法计算 Rating</h2><p>{error}</p></section>}
      {!loading && !error && !scores.length && (
        <section className="rating-state panel">
          <span className="rating-state__mark">零</span><h2>先导入一份成绩档案</h2>
          <p>支持菌菇、Sakura 和 JSON。导入后这里会自动生成你的 Rating 报告。</p>
          <button className="primary-button" type="button" onClick={() => setImportOpen(true)}><Import size={17} />导入成绩</button>
        </section>
      )}
      {!loading && !error && scores.length > 0 && report && report.entries.length === 0 && (
        <section className="rating-state panel">
          <span className="rating-state__mark">?</span><h2>没有可用于 {version.toUpperCase()} 的成绩</h2>
          <p>当前成绩未匹配到定数，或综合良率未达到算法的最低计算区间。你可以切换算法或重新导入最新成绩。</p>
        </section>
      )}

      {!loading && !error && report && report.entries.length > 0 && (
        <>
          <section className="rating-overview">
            <div className="rating-overview__main panel">
              <header><div><span className="eyebrow"><BarChart3 size={14} /> OVERVIEW</span><h2>综合能力</h2></div><span>{report.entries.length} 首有效成绩</span></header>
              <div className="rating-scoreboard">
                <div className="rating-total"><span>RATING</span><strong>{report.summary[0].value.toFixed(2)}</strong><small>{report.summary[0].compensated ? 'TOP 20 BONUS APPLIED' : `${version.toUpperCase()} REPORT`}</small></div>
                <div className="rating-dimensions">
                  {report.summary.slice(1).map((item) => (
                    <button key={item.key} type="button" onClick={() => setDimension(item.key)} className={dimension === item.key ? 'is-active' : ''}>
                      <span>{item.label}{item.compensated && <i title="高水平补偿已生效">+</i>}</span><strong>{item.value.toFixed(2)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <RadarChart title={`${version.toUpperCase()} 能力轮廓`} metrics={radarMetrics} />
          </section>

          <nav className="rating-dimension-nav" aria-label="Rating 维度">
            {ratingDimensionLabels[version].map(([key, label]) => (
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
