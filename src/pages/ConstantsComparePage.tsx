import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowRight, Database, GitCompareArrows, LoaderCircle, Search } from 'lucide-react'
import { useWiki } from '../context/WikiContext'
import { loadV2Constants, loadV2ConstantsFrom, V2_CONSTANTS_URL } from '../data/constants'
import type { V2Difficulty, V2DifficultyKey, V2SongMap } from '../types'

const STORAGE_KEY = 'our-taiko-wiki:test-constants-url'
const ROW_HEIGHT = 48
const OVERSCAN = 8

const DIFFICULTIES: Array<{ key: V2DifficultyKey; label: string }> = [
  { key: 'hard', label: '困难' },
  { key: 'oni', label: '鬼' },
  { key: 'edit', label: '里' },
]

const FIELDS: Array<{ key: keyof V2Difficulty; label: string; integer?: boolean }> = [
  { key: 'sub_constant_1', label: '子定数1' },
  { key: 'main_constant', label: '主定数' },
  { key: 'sub_constant_2', label: '子定数2' },
  { key: 'stamina', label: '体力' },
  { key: 'handspeed', label: '手速' },
  { key: 'burst', label: '爆发' },
  { key: 'complex', label: '复合' },
  { key: 'rhythm', label: '节奏' },
  { key: 'totalNotes', label: '音符数', integer: true },
]

const COLUMN_COUNT = 2 + FIELDS.length

interface CompareRow {
  id: string
  title: string
  difficulty: V2DifficultyKey
  a?: V2Difficulty
  b?: V2Difficulty
}

function formatValue(value: number | undefined, integer?: boolean): string {
  if (value === undefined) return '—'
  return integer ? String(value) : value.toFixed(2)
}

function valuesDiffer(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return a !== b
  return Math.abs(a - b) > 1e-9
}

function rowDiffCount(row: CompareRow): number {
  return FIELDS.reduce((count, field) => count + (valuesDiffer(row.a?.[field.key], row.b?.[field.key]) ? 1 : 0), 0)
}

function isV2SongMap(value: unknown): value is V2SongMap {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return Object.values(value).every((song) => {
    if (typeof song !== 'object' || song === null || Array.isArray(song)) return false
    return Object.values(song as Record<string, unknown>).every((diff) => {
      if (typeof diff !== 'object' || diff === null) return false
      const record = diff as Record<string, unknown>
      return FIELDS.every(({ key }) => typeof record[key] === 'number')
    })
  })
}

function buildRows(a: V2SongMap, b: V2SongMap, titleById: Map<string, string>): CompareRow[] {
  const ids = new Set([...Object.keys(a), ...Object.keys(b)])
  const rows: CompareRow[] = []
  for (const id of ids) {
    const aSong = a[id]
    const bSong = b[id]
    for (const { key: difficulty } of DIFFICULTIES) {
      const aDifficulty = aSong?.[difficulty]
      const bDifficulty = bSong?.[difficulty]
      if (!aDifficulty && !bDifficulty) continue
      rows.push({
        id,
        title: titleById.get(id) ?? `曲目 ${id}`,
        difficulty,
        a: aDifficulty,
        b: bDifficulty,
      })
    }
  }
  return rows.sort((x, y) => Number(x.id) - Number(y.id))
}

function countRows(map: V2SongMap): number {
  return Object.values(map).reduce(
    (count, song) => count + DIFFICULTIES.filter(({ key }) => song[key]).length,
    0,
  )
}

export function ConstantsComparePage() {
  const { songs } = useWiki()
  const [baseline, setBaseline] = useState<V2SongMap | null>(null)
  const [baselineLoading, setBaselineLoading] = useState(true)
  const [baselineError, setBaselineError] = useState('')

  const [targetUrl, setTargetUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || '')
  const [target, setTarget] = useState<V2SongMap | null>(null)
  const [targetLoading, setTargetLoading] = useState(false)
  const [targetError, setTargetError] = useState('')

  const [difficultyFilter, setDifficultyFilter] = useState<'all' | V2DifficultyKey>('all')
  const [onlyDiff, setOnlyDiff] = useState(false)
  const [search, setSearch] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)

  useEffect(() => {
    let active = true
    loadV2Constants()
      .then((data) => {
        if (active) setBaseline(data)
      })
      .catch((reason: unknown) => {
        if (active) setBaselineError(reason instanceof Error ? reason.message : '当前 v2 定数加载失败')
      })
      .finally(() => {
        if (active) setBaselineLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const titleById = useMemo(() => new Map(songs.map((song) => [String(song.id), song.title])), [songs])

  const summary = useMemo(() => {
    if (!baseline || !target) return null
    const rows = buildRows(baseline, target, titleById)
    const diffRows = rows.filter((row) => rowDiffCount(row) > 0)
    const fieldCounts = Object.fromEntries(FIELDS.map((field) => [field.key, 0])) as Record<keyof V2Difficulty, number>
    for (const row of diffRows) {
      for (const field of FIELDS) {
        if (valuesDiffer(row.a?.[field.key], row.b?.[field.key])) fieldCounts[field.key] += 1
      }
    }
    const missingInB = rows.filter((row) => row.a && !row.b).length
    const missingInA = rows.filter((row) => !row.a && row.b).length
    const songIdsA = new Set(Object.keys(baseline))
    const songIdsB = new Set(Object.keys(target))
    return {
      rows,
      diffRows,
      fieldCounts,
      missingInA,
      missingInB,
      songsOnlyA: [...songIdsA].filter((id) => !songIdsB.has(id)).length,
      songsOnlyB: [...songIdsB].filter((id) => !songIdsA.has(id)).length,
    }
  }, [baseline, target, titleById])

  const filteredRows = useMemo(() => {
    if (!summary) return []
    const query = search.trim().toLowerCase()
    return summary.rows.filter((row) => {
      if (difficultyFilter !== 'all' && row.difficulty !== difficultyFilter) return false
      if (onlyDiff && rowDiffCount(row) === 0) return false
      if (query && !row.title.toLowerCase().includes(query) && !row.id.includes(query)) return false
      return true
    })
  }, [summary, difficultyFilter, onlyDiff, search])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    setScrollTop(0)
  }, [difficultyFilter, onlyDiff, search, summary])

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setViewportHeight(el.clientHeight)
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [summary])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const visibleRows = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
    const end = Math.min(filteredRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
    return {
      rows: filteredRows.slice(start, end),
      topSpacer: start * ROW_HEIGHT,
      bottomSpacer: (filteredRows.length - end) * ROW_HEIGHT,
    }
  }, [filteredRows, scrollTop, viewportHeight])

  function handleScroll() {
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      const el = scrollRef.current
      if (el) setScrollTop(el.scrollTop)
    })
  }

  async function handleCompare(event: FormEvent) {
    event.preventDefault()
    const url = targetUrl.trim()
    if (!url || targetLoading) return
    setTarget(null)
    setTargetError('')
    setTargetLoading(true)
    try {
      const data = await loadV2ConstantsFrom(url)
      if (!isV2SongMap(data)) {
        throw new Error('返回内容不是 gugu_constants 同结构（按曲目 id 映射 hard/oni/edit 难度对象）')
      }
      setTarget(data)
      localStorage.setItem(STORAGE_KEY, url)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '加载失败'
      setTargetError(`${message}。请确认地址可访问，且 API 允许跨域（CORS）访问。`)
    } finally {
      setTargetLoading(false)
    }
  }

  return (
    <main className="page-shell compare-page">
      <section className="compare-hero">
        <span className="eyebrow"><GitCompareArrows size={14} /> CONSTANT COMPARE · TEST</span>
        <h1>定数对比</h1>
        <p>左侧为当前 v2 定数基线，右侧填写任意同结构 API，逐曲逐项查看差异。</p>
      </section>

      <section className="compare-panel panel">
        <div className="compare-source">
          <header>
            <span className="compare-source__badge is-baseline">A · 基线</span>
            <strong>当前 v2 定数</strong>
          </header>
          <code>{V2_CONSTANTS_URL}</code>
          {baselineLoading ? (
            <div className="compare-source__status"><LoaderCircle className="spin" />正在加载基线定数…</div>
          ) : baselineError ? (
            <div className="compare-source__status is-error"><AlertTriangle size={14} />{baselineError}</div>
          ) : baseline ? (
            <div className="compare-source__stats">
              <span><i>{Object.keys(baseline).length}</i>曲目</span>
              <span><i>{countRows(baseline)}</i>难度定数</span>
            </div>
          ) : null}
        </div>

        <div className="compare-panel__arrow" aria-hidden="true"><ArrowRight /></div>

        <div className="compare-source is-target">
          <header>
            <span className="compare-source__badge">B · 对比</span>
            <strong>其他 API</strong>
          </header>
          <form className="compare-form" onSubmit={handleCompare}>
            <input
              type="url"
              value={targetUrl}
              onChange={(event) => setTargetUrl(event.target.value)}
              placeholder="https://cdn.ourtaiko.org/api/…"
              spellCheck={false}
              autoComplete="off"
            />
            <button className="primary-button" type="submit" disabled={!targetUrl.trim() || targetLoading}>
              {targetLoading ? <LoaderCircle className="spin" /> : <GitCompareArrows size={16} />}
              {targetLoading ? '加载中…' : '开始对比'}
            </button>
          </form>
          {targetError && <div className="compare-source__status is-error"><AlertTriangle size={14} />{targetError}</div>}
          {target && (
            <div className="compare-source__stats">
              <span><i>{Object.keys(target).length}</i>曲目</span>
              <span><i>{countRows(target)}</i>难度定数</span>
            </div>
          )}
        </div>
      </section>

      {summary && (
        <>
          <section className="compare-summary panel">
            <div className="compare-summary__cards">
              <div><span>A 曲目</span><strong>{Object.keys(baseline as V2SongMap).length}</strong></div>
              <div><span>B 曲目</span><strong>{Object.keys(target as V2SongMap).length}</strong></div>
              <div><span>有差异行</span><strong className="is-accent">{summary.diffRows.length}</strong></div>
              <div><span>仅 A 有（行）</span><strong>{summary.missingInB}</strong></div>
              <div><span>仅 B 有（行）</span><strong>{summary.missingInA}</strong></div>
              <div><span>仅 A 有（曲目）</span><strong>{summary.songsOnlyA}</strong></div>
              <div><span>仅 B 有（曲目）</span><strong>{summary.songsOnlyB}</strong></div>
            </div>
            <div className="compare-field-stats">
              {FIELDS.map((field) => (
                <span key={field.key} className={summary.fieldCounts[field.key] > 0 ? 'is-diff' : ''}>
                  {field.label} <b>{summary.fieldCounts[field.key]}</b>
                </span>
              ))}
            </div>
          </section>

          <section className="compare-toolbar panel">
            <div className="compare-difficulty-chips" role="group" aria-label="难度筛选">
              <button type="button" className={difficultyFilter === 'all' ? 'is-active' : ''} onClick={() => setDifficultyFilter('all')}>全部</button>
              {DIFFICULTIES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={difficultyFilter === key ? 'is-active' : ''}
                  onClick={() => setDifficultyFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="compare-only-diff">
              <input type="checkbox" checked={onlyDiff} onChange={(event) => setOnlyDiff(event.target.checked)} />
              仅显示有差异
            </label>
            <div className="compare-search">
              <Search size={14} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索曲名或 ID"
              />
            </div>
          </section>

          <section className="compare-table-wrap panel">
            <div className="compare-table-meta">
              <span>共 {summary.rows.length} 行 · 显示 {filteredRows.length} 行</span>
              <span className="compare-legend">高亮 = 数值不一致（<i>—</i> 表示该源无此难度）</span>
            </div>
            <div className="compare-table-scroll" ref={scrollRef} onScroll={handleScroll}>
              <table className="compare-table">
                <colgroup>
                  <col style={{ width: 240 }} />
                  <col style={{ width: 56 }} />
                  {FIELDS.map((field) => <col key={field.key} style={{ width: 132 }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th>曲目</th>
                    <th>难度</th>
                    {FIELDS.map((field) => (
                      <th key={field.key}>
                        <span>{field.label}</span>
                        <small>A → B</small>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.topSpacer > 0 && (
                    <tr className="compare-spacer" aria-hidden="true" style={{ height: visibleRows.topSpacer }}>
                      <td colSpan={COLUMN_COUNT} />
                    </tr>
                  )}
                  {visibleRows.rows.map((row) => {
                    const isMissingA = row.a && !row.b
                    const isMissingB = !row.a && row.b
                    const rowClass = isMissingA ? 'is-missing-a' : isMissingB ? 'is-missing-b' : ''
                    return (
                      <tr key={`${row.id}-${row.difficulty}`} className={rowClass}>
                        <td className="compare-title">
                          <strong>{row.title}</strong>
                          <small>曲目 {row.id}</small>
                        </td>
                        <td>
                          <span className="compare-difficulty">{DIFFICULTIES.find((item) => item.key === row.difficulty)?.label}</span>
                        </td>
                        {FIELDS.map((field) => {
                          const a = row.a?.[field.key]
                          const b = row.b?.[field.key]
                          const isDiff = valuesDiffer(a, b)
                          return (
                            <td
                              key={field.key}
                              className={isDiff ? 'is-diff' : ''}
                              title={`${field.label}：${formatValue(a, field.integer)} → ${formatValue(b, field.integer)}`}
                            >
                              <span className="compare-value">{formatValue(a, field.integer)}</span>
                              <i className="compare-arrow">→</i>
                              <span className="compare-value">{formatValue(b, field.integer)}</span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {visibleRows.bottomSpacer > 0 && (
                    <tr className="compare-spacer" aria-hidden="true" style={{ height: visibleRows.bottomSpacer }}>
                      <td colSpan={COLUMN_COUNT} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredRows.length === 0 && (
              <div className="compare-empty">
                <Database />
                <p>{onlyDiff ? '没有符合条件的差异行。' : '没有符合条件的曲目。'}</p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
