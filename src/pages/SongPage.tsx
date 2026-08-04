import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, ChevronRight, Database, Disc3, Gauge, Hash, Layers3, LoaderCircle, Music2, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ChartPreview } from '../components/ChartPreview'
import { DifficultyBadge, difficultyMeta } from '../components/DifficultyBadge'
import { RadarChart, type RadarMetric } from '../components/RadarChart'
import { useWiki } from '../context/WikiContext'
import { loadV1Constants, loadV2Constants } from '../data/constants'
import { difficultyKeys, type DifficultyKey, type V1Difficulty, type V2Difficulty, type V2DifficultyKey } from '../types'
import { ratingDimensionLabels, type RatingEntry, type RatingVersion } from '../utils/rating'
import { calculateV1SongRating } from '../utils/rating-v1'
import { calculateV2SongRating } from '../utils/rating-v2'

function firstDifficulty(levels: Record<DifficultyKey, number | string | null>): DifficultyKey {
  if (levels.oni !== null) return 'oni'
  return difficultyKeys.find((key) => levels[key] !== null) || 'oni'
}

function v2DifficultyKey(key: DifficultyKey): V2DifficultyKey | undefined {
  if (key === 'hard' || key === 'oni') return key
  if (key === 'ura') return 'edit'
  return undefined
}

function MetricGrid({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return <div className="metric-grid">{items.map((item) => <div className="metric-cell" key={item.label}><span>{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div>)}</div>
}

function V1ConstantPanel({ data }: { data?: V1Difficulty }) {
  if (!data) return <EmptyConstant version="v1" />
  const metrics: RadarMetric[] = [
    { label: '复合处理', value: data.composite, min: 0 },
    { label: '平均密度', value: data.avgDensity },
    { label: '瞬时密度', value: data.instDensity },
    { label: '流速变化', value: data.separation },
    { label: 'BPM变化', value: data.bpmChange },
    { label: '节奏变化', value: data.hsChange },
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
      </div>
      <RadarChart title="FumenDB定数" metrics={metrics} />
    </div>
  )
}

function V2ConstantPanel({ data }: { data?: V2Difficulty }) {
  if (!data) return <EmptyConstant version="v2" />
  const metrics: RadarMetric[] = [
    { label: '体力', value: data.stamina, min: 0 },
    { label: '手速', value: data.handspeed },
    { label: '爆发', value: data.burst },
    { label: '节奏', value: data.rhythm },
    { label: '复合', value: data.complex },
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
      </div>
      <RadarChart title="咕咕定数" metrics={metrics} />
    </div>
  )
}

function EmptyConstant({ version }: { version: 'v1' | 'v2' }) {
  return <div className="empty-constant"><Database /><h3>暂无 {version.toUpperCase()} 定数</h3><p>这个难度还没有进入对应的定数资料库。</p></div>
}

interface SingleRatingCardProps {
  version: RatingVersion
  entry: RatingEntry | null
  hasScore: boolean
  hasConstants: boolean
}

function SingleRatingCard({ version, entry, hasScore, hasConstants }: SingleRatingCardProps) {
  const isV1 = version === 'v1'
  const dimensions = ratingDimensionLabels[version].slice(1)

  return (
    <article className={`single-rating-card panel is-${version}`}>
      <header>
        <div><span>{version.toUpperCase()}</span><div><small>{isV1 ? 'V1 Algorithm' : 'V2 Algorithm'}</small><h3>{isV1 ? 'V1算法' : 'V2算法'}</h3></div></div>
        <Gauge aria-hidden="true" />
      </header>
      {!hasScore ? (
        <div className="single-rating-card__empty"><strong>尚未导入这个谱面的成绩</strong><p>导入最佳成绩后即可计算单曲 Rating。</p></div>
      ) : !hasConstants ? (
        <div className="single-rating-card__empty"><strong>暂无 {version.toUpperCase()} 定数</strong><p>这个谱面暂时无法使用该版本计算。</p></div>
      ) : !entry ? (
        <div className="single-rating-card__empty"><strong>成绩不在计算区间</strong><p>{isV1 ? 'v1 需要综合良率达到 75%。' : '请检查成绩判定数与总音符数。'}</p></div>
      ) : (
        <>
          <div className="single-rating-card__score">
            <div><span>SINGLE RATING</span><strong>{entry.values.rating.toFixed(2)}</strong></div>
            <div><span>综合良率</span><b>{(entry.accuracy * 100).toFixed(2)}%</b><small>良 {entry.great} · 可 {entry.good} · 不可 {entry.bad}</small></div>
          </div>
          <div className="single-rating-card__dimensions">
            {dimensions.map(([key, label]) => (
              <div key={key}><span>{label}</span><strong>{entry.values[key]?.toFixed(2) ?? '—'}</strong></div>
            ))}
          </div>
        </>
      )}
    </article>
  )
}

export function SongPage() {
  const { id } = useParams()
  const songId = Number(id)
  const { songs, loading: songsLoading, scores, algoVersion } = useWiki()
  const song = songs.find((item) => item.id === songId)
  const [difficulty, setDifficulty] = useState<DifficultyKey>('oni')
  const [coverError, setCoverError] = useState(false)
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
  const v2Key = v2DifficultyKey(difficulty)
  const v2Data = v2Key ? v2?.[String(songId)]?.[v2Key] : undefined
  const v1Rating = useMemo(() => score && v1Data
    ? calculateV1SongRating(v1Data, score, song?.title || `曲目 ${songId}`, difficulty)
    : null, [score, v1Data, song?.title, songId, difficulty])
  const v2Rating = useMemo(() => score && v2Data
    ? calculateV2SongRating(v2Data, score, song?.title || `曲目 ${songId}`, difficulty)
    : null, [score, v2Data, song?.title, songId, difficulty])

  const isV1 = algoVersion === 'v1'

  if (songsLoading) return <main className="page-shell detail-loading"><LoaderCircle className="spin" /><p>正在翻阅曲目档案…</p></main>
  if (!song) return (
    <main className="page-shell"><section className="state-card panel"><span className="state-card__mark">404</span><h1>没有找到这首歌</h1><p>它可能尚未收录在当前 CN 数据源中。</p><Link className="primary-button" to="/songs"><ArrowLeft />返回全部歌曲</Link></section></main>
  )

  return (
    <main className="page-shell song-detail-page">
      <nav className="breadcrumbs" aria-label="面包屑"><Link to="/songs">全部歌曲</Link><ChevronRight /><span>{song.title}</span></nav>

      <section className="song-identity panel">
        <div className="record-art" aria-hidden="true">
          {coverError ? (
            <><div className="record-art__disc"><span>{String(song.id).padStart(4, '0')}</span></div><i /></>
          ) : (
            <img
              className="record-art__cover"
              src={`https://viewer.sakura-bot.cn/api/content/covers/${song.id}`}
              alt=""
              onError={() => setCoverError(true)}
            />
          )}
        </div>
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

      <section className="detail-section">
        <div className="section-heading">
          <div><span className="eyebrow"><Music2 size={14} /> CHART PREVIEW</span><h2>谱面预览</h2></div>
          <p>来自 ESE 谱面库 · tja-renderer 交互渲染</p>
        </div>
        <ChartPreview songId={song.id} preferredDifficulty={difficulty} />
      </section>

      {score && (
        <section className="personal-score panel">
          <div className="personal-score__title"><Trophy /><span>我的最佳成绩</span><strong>{score.highScore.toLocaleString()}</strong></div>
          <div><span>良 <b>{score.good}</b></span><span>可 <b>{score.ok}</b></span><span>不可 <b>{score.bad}</b></span><span>最大连段 <b>{score.combo}</b></span><span>游玩 <b>{score.plays}</b></span></div>
        </section>
      )}

      <section className="song-rating-section">
        <div className="section-heading">
          <div><span className="eyebrow"><Sparkles size={14} /> SINGLE RATING</span><h2>单曲 Rating 详情</h2></div>
        </div>
        {constantLoading ? (
          <div className="song-rating-loading panel"><LoaderCircle className="spin" />正在计算单曲 Rating…</div>
        ) : constantError ? (
          <div className="song-rating-loading panel"><RotateCcw /><span>{constantError}</span></div>
        ) : (
          <SingleRatingCard
            version={algoVersion}
            entry={isV1 ? v1Rating : v2Rating}
            hasScore={Boolean(score)}
            hasConstants={isV1 ? Boolean(v1Data) : Boolean(v2Data)}
          />
        )}
      </section>

      <section className="constants-section panel">
        <header className="constants-header">
          <div><span className="eyebrow"><Disc3 size={14} /> CONSTANT LAB</span><h2>{difficultyMeta[difficulty].label} · 谱面定数</h2></div>
          <span className="constants-algo-badge">{isV1 ? 'FumenDB定数' : '咕咕定数'}</span>
        </header>
        {constantLoading ? <div className="constant-loader"><LoaderCircle className="spin" />正在读取定数档案…</div>
          : constantError ? <div className="empty-constant"><RotateCcw /><h3>定数加载失败</h3><p>{constantError}</p></div>
            : isV1 ? <V1ConstantPanel data={v1Data} /> : <V2ConstantPanel data={v2Data} />}
      </section>
    </main>
  )
}
