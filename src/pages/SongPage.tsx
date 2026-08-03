import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronRight, Database, Disc3, Hash, Layers3, LoaderCircle, Music2, RotateCcw, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DifficultyBadge, difficultyMeta } from '../components/DifficultyBadge'
import { RadarChart, type RadarMetric } from '../components/RadarChart'
import { useWiki } from '../context/WikiContext'
import { loadV1Constants, loadV2Constants } from '../data/constants'
import { difficultyKeys, type DifficultyKey, type V1Difficulty, type V2Difficulty } from '../types'

type ConstantVersion = 'v1' | 'v2'

function firstDifficulty(levels: Record<DifficultyKey, number | string | null>): DifficultyKey {
  if (levels.oni !== null) return 'oni'
  return difficultyKeys.find((key) => levels[key] !== null) || 'oni'
}

function MetricGrid({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return <div className="metric-grid">{items.map((item) => <div className="metric-cell" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div>)}</div>
}

function V1Panel({ data }: { data?: V1Difficulty }) {
  if (!data) return <EmptyConstant version="v1" />
  const metrics: RadarMetric[] = [
    { label: '复合处理', value: data.composite, max: 100 },
    { label: '平均密度', value: data.avgDensity, max: 100 },
    { label: '瞬时密度', value: data.instDensity, max: 100 },
    { label: '流速变化', value: data.separation, max: 100 },
    { label: 'BPM变化', value: data.bpmChange, max: 100 },
    { label: '节奏变化', value: data.hsChange, max: 100 },
  ]
  return (
    <div className="constant-layout">
      <div className="constant-copy">
        <div className="constant-hero"><span>V1 谱面定数</span><strong>{data.constant.toFixed(1)}</strong><small>FUMEN DATABASE</small></div>
        <MetricGrid items={[
          { label: '音符总数', value: data.totalNotes.toLocaleString(), note: 'NOTES' },
          { label: '复合处理', value: data.composite.toFixed(2) },
          { label: '平均密度', value: data.avgDensity.toFixed(2) },
          { label: '瞬时密度', value: data.instDensity.toFixed(2) },
          { label: '流速变化', value: data.separation.toFixed(2) },
          { label: 'BPM变化', value: data.bpmChange.toFixed(2) },
          { label: '节奏变化', value: data.hsChange.toFixed(2) },
        ]} />
        <p className="constant-note">v1 以谱面结构统计定数；雷达图按各指标的 0–100 区间绘制。</p>
      </div>
      <RadarChart title="谱面结构" metrics={metrics} />
    </div>
  )
}

function V2Panel({ data }: { data?: V2Difficulty }) {
  if (!data) return <EmptyConstant version="v2" />
  const metrics: RadarMetric[] = [
    { label: '体力', value: data.stamina, max: 15.5 },
    { label: '手速', value: data.handspeed, max: 15.5 },
    { label: '爆发', value: data.burst, max: 15.5 },
    { label: '复合', value: data.complex, max: 15.5 },
    { label: '节奏', value: data.rhythm, max: 15.5 },
  ]
  return (
    <div className="constant-layout">
      <div className="constant-copy">
        <div className="v2-constants">
          <div><span>75% 定数</span><strong>{data.sub_constant_1.toFixed(2)}</strong></div>
          <div className="is-main"><span>95% 定数</span><strong>{data.main_constant.toFixed(2)}</strong></div>
          <div><span>99% 定数</span><strong>{data.sub_constant_2.toFixed(2)}</strong></div>
        </div>
        <MetricGrid items={[
          { label: '音符总数', value: data.totalNotes.toLocaleString(), note: 'NOTES' },
          { label: '体力', value: data.stamina.toFixed(2) },
          { label: '手速', value: data.handspeed.toFixed(2) },
          { label: '爆发', value: data.burst.toFixed(2) },
          { label: '复合', value: data.complex.toFixed(2) },
          { label: '节奏', value: data.rhythm.toFixed(2) },
        ]} />
        <p className="constant-note">v2 根据不同达成率使用副定数与主定数，并以五个能力维度描述谱面。</p>
      </div>
      <RadarChart title="能力维度" metrics={metrics} />
    </div>
  )
}

function EmptyConstant({ version }: { version: ConstantVersion }) {
  return <div className="empty-constant"><Database /><h3>暂无 {version.toUpperCase()} 定数</h3><p>这个难度还没有进入对应的定数资料库。</p></div>
}

export function SongPage() {
  const { id } = useParams()
  const songId = Number(id)
  const { songs, loading: songsLoading, scores } = useWiki()
  const song = songs.find((item) => item.id === songId)
  const [difficulty, setDifficulty] = useState<DifficultyKey>('oni')
  const [version, setVersion] = useState<ConstantVersion>('v1')
  const [v1, setV1] = useState<Map<number, Awaited<ReturnType<typeof loadV1Constants>> extends Map<number, infer T> ? T : never>>()
  const [v2, setV2] = useState<Awaited<ReturnType<typeof loadV2Constants>>>()
  const [constantError, setConstantError] = useState('')
  const [constantLoading, setConstantLoading] = useState(true)

  useEffect(() => {
    if (song) setDifficulty(firstDifficulty(song.levels))
  }, [song])

  useEffect(() => {
    let active = true
    setConstantLoading(true)
    Promise.all([loadV1Constants(), loadV2Constants()])
      .then(([nextV1, nextV2]) => {
        if (!active) return
        setV1(nextV1)
        setV2(nextV2)
      })
      .catch((reason: unknown) => active && setConstantError(reason instanceof Error ? reason.message : '定数加载失败'))
      .finally(() => active && setConstantLoading(false))
    return () => { active = false }
  }, [])

  const score = useMemo(() => scores.find((item) => item.id === songId && item.difficulty === difficultyMeta[difficulty].index), [scores, songId, difficulty])
  const v1Data = v1?.get(songId)?.constants[difficulty]
  const v2Data = v2?.[String(songId)]?.[difficulty]

  if (songsLoading) return <main className="page-shell detail-loading"><LoaderCircle className="spin" /><p>正在翻阅曲目档案…</p></main>
  if (!song) return (
    <main className="page-shell"><section className="state-card panel"><span className="state-card__mark">404</span><h1>没有找到这首歌</h1><p>它可能尚未收录在当前 CN 数据源中。</p><Link className="primary-button" to="/songs"><ArrowLeft />返回全部歌曲</Link></section></main>
  )

  return (
    <main className="page-shell song-detail-page">
      <nav className="breadcrumbs" aria-label="面包屑"><Link to="/songs">全部歌曲</Link><ChevronRight /><span>{song.title}</span></nav>

      <section className="song-identity panel">
        <div className="record-art" aria-hidden="true"><div className="record-art__disc"><span>{String(song.id).padStart(4, '0')}</span></div><i /></div>
        <div className="song-identity__copy">
          <span className="category-tag">{song.category}</span>
          <h1>{song.title}</h1>
          {song.titleJp && song.titleJp !== song.title && <p className="song-jp">{song.titleJp}</p>}
          {song.subtitle && <p className="song-subtitle">{song.subtitle}</p>}
          <div className="song-facts">
            <span><Hash />ID {song.id}</span>
            <span><CalendarDays />{song.openDay || '上线日期未收录'}</span>
            <span><Music2 />{song.family || 'CN 曲目库'}</span>
          </div>
        </div>
        <Link className="back-link" to="/songs"><ArrowLeft />返回曲库</Link>
      </section>

      <section className="detail-section">
        <div className="section-heading"><div><span className="eyebrow"><Layers3 size={14} /> CHART SELECT</span><h2>选择谱面难度</h2></div><p>星级来自 CN 曲目数据</p></div>
        <div className="difficulty-selector">
          {difficultyKeys.map((key) => <DifficultyBadge key={key} difficulty={key} value={song.levels[key]} active={difficulty === key} onClick={() => setDifficulty(key)} />)}
        </div>
      </section>

      {score && (
        <section className="personal-score panel">
          <div className="personal-score__title"><Trophy /><span>我的最佳成绩</span><strong>{score.highScore.toLocaleString()}</strong></div>
          <div><span>良 <b>{score.good}</b></span><span>可 <b>{score.ok}</b></span><span>不可 <b>{score.bad}</b></span><span>最大连段 <b>{score.combo}</b></span><span>游玩 <b>{score.plays}</b></span></div>
        </section>
      )}

      <section className="constants-section panel">
        <header className="constants-header">
          <div><span className="eyebrow"><Disc3 size={14} /> CONSTANT LAB</span><h2>{difficultyMeta[difficulty].label} · 谱面定数</h2></div>
          <div className="version-tabs" role="tablist" aria-label="定数版本">
            <button role="tab" aria-selected={version === 'v1'} className={version === 'v1' ? 'is-active' : ''} onClick={() => setVersion('v1')}><span>V1</span>结构定数</button>
            <button role="tab" aria-selected={version === 'v2'} className={version === 'v2' ? 'is-active' : ''} onClick={() => setVersion('v2')}><span>V2</span>能力定数</button>
          </div>
        </header>
        {constantLoading ? <div className="constant-loader"><LoaderCircle className="spin" />正在读取定数档案…</div>
          : constantError ? <div className="empty-constant"><RotateCcw /><h3>定数加载失败</h3><p>{constantError}</p></div>
            : version === 'v1' ? <V1Panel data={v1Data} /> : <V2Panel data={v2Data} />}
      </section>
    </main>
  )
}
