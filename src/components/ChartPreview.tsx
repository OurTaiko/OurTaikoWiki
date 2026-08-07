import { useEffect, useMemo, useRef, useState } from 'react'
import { GitBranch, LoaderCircle, MousePointerClick, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import type { HitInfo } from '../../TJARenderer/src/hit-testing'
import { createChartView, type ChartView, type ChartViewOptions } from '../../TJARenderer/src/internal'
import { INSETS } from '../../TJARenderer/src/layout'
import { BranchName, DEFAULT_RENDER_OPTIONS, type NoteLocation, type RenderOptions } from '../../TJARenderer/src/primitives'
import { parseTJA, type ParsedChart } from '../../TJARenderer/src/tja-parser'
import { getGapMeasures, getGapMs, LongNoteHandling } from '../utils/note-gap'

const ESE_MAPPING_URL = 'https://cdn.ourtaiko.org/api/ese_mapping'
const ESE_RAW_BASE = 'https://ghproxy.vanillaaaa.org/https://ese.tjadataba.se/ESE/ESE/raw/branch/master/'

const ZOOM_PRESETS = [8, 12, 16, 24, 32, 48]

const COURSE_LABELS: Record<string, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  oni: 'Oni',
  edit: 'Oni (Ura)',
}

const BRANCH_LABELS: Record<string, string> = {
  normal: 'Normal',
  expert: 'Expert',
  master: 'Master',
}

const BRANCH_KEYS: BranchName[] = [BranchName.Normal, BranchName.Expert, BranchName.Master]

type BranchView = 'all' | BranchName

interface ChartPreviewProps {
  songId: number
  preferredDifficulty?: string
}

function sameLocation(a: NoteLocation, b: NoteLocation): boolean {
  return a.barIndex === b.barIndex && a.charIndex === b.charIndex && (a.branch ?? '') === (b.branch ?? '')
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/%2B/g, '+'))
    .join('/')
}

function formatBpm(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)
}

function format目视速度(bpm: number | undefined, hs: number | undefined): string {
  if (bpm === undefined || hs === undefined || !Number.isFinite(bpm) || !Number.isFinite(hs)) return '—'
  const BPM = formatBpm(bpm)
  const HS = formatBpm(hs)
  const 目视速度 = (bpm * hs) % 1 === 0 ? (bpm * hs).toFixed(1) : (bpm * hs).toFixed(2)
  return `${BPM} × ${HS} = ${目视速度}`
}

const GAP_OPTIONS = { longNoteHandling: LongNoteHandling.Strict, maxMeasures: 1 } as const

function formatGapMeasures(gap: number): string {
  const commonDenominators = [4, 8, 12, 16, 24, 32, 48, 64]
  for (const d of commonDenominators) {
    const val = gap * d
    if (Math.abs(val - Math.round(val)) < 0.001) {
      const num = Math.round(val)
      const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
      const divisor = gcd(num, d)
      return `${num / divisor}/${d / divisor}`
    }
  }
  return gap.toFixed(3)
}

export function ChartPreview({ songId, preferredDifficulty }: ChartPreviewProps) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [parsed, setParsed] = useState<Record<string, ParsedChart> | null>(null)
  const [course, setCourse] = useState('')
  const [branchView, setBranchView] = useState<BranchView>('all')
  const [zoom, setZoom] = useState(16)
  const [selected, setSelected] = useState<HitInfo | null>(null)
  const [hovered, setHovered] = useState<HitInfo | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<ChartView | null>(null)
  const chartRef = useRef<ParsedChart | null>(null)
  const hoverCleanupRef = useRef<(() => void) | null>(null)
  const clickCleanupRef = useRef<(() => void) | null>(null)
  const optionsRef = useRef<RenderOptions>({ ...DEFAULT_RENDER_OPTIONS, beatsPerLine: 16, showAllBranches: true, showAttribution: true, tjaSourceName: 'ESE' })
  const selectedRef = useRef<HitInfo | null>(null)
  const hoveredRef = useRef<HitInfo | null>(null)
  const clickHandlerRef = useRef<(hit: HitInfo | null) => void>(() => { })
  const hoverHandlerRef = useRef<(hit: HitInfo | null) => void>(() => { })
  const preferredDifficultyRef = useRef(preferredDifficulty)

  const info = selected ?? hovered

  useEffect(() => {
    let active = true
    setPhase('loading')
    setErrorMessage('')
    setParsed(null)
    setCourse('')
    setSelected(null)
    setHovered(null)

    const preferred = preferredDifficultyRef.current?.toLowerCase() === 'ura' ? 'edit' : preferredDifficultyRef.current?.toLowerCase()

      ; (async () => {
        try {
          const mappingResponse = await fetch(ESE_MAPPING_URL)
          if (!mappingResponse.ok) {
            throw new Error(`谱面映射文件获取失败（HTTP ${mappingResponse.status}）`)
          }
          const mapping: unknown = await mappingResponse.json()
          const relativePath = typeof mapping === 'object' && mapping !== null
            ? (mapping as Record<string, unknown>)[String(songId)]
            : undefined
          if (typeof relativePath !== 'string' || relativePath.trim() === '') {
            throw new Error('这首曲目暂时没有收录在 ESE 谱面库中（映射缺失或路径为空）')
          }

          const path = relativePath.trim().replace(/\\/g, '/')
          const response = await fetch(`${ESE_RAW_BASE}${encodePath(path)}`)
          if (!response.ok) {
            throw new Error(`谱面文件获取失败（HTTP ${response.status}）`)
          }
          const text = await response.text()
          const charts = parseTJA(text.replace(/^\uFEFF/, ''))
          const courses = Object.keys(charts)
          if (courses.length === 0) {
            throw new Error('TJA 文件解析失败：没有找到任何难度谱面')
          }
          if (!active) return

          setParsed(charts)
          setCourse(preferred && charts[preferred] ? preferred : charts.oni ? 'oni' : courses[0])
          setPhase('ready')
        } catch (reason) {
          if (!active) return
          setErrorMessage(reason instanceof Error ? reason.message : '谱面加载失败')
          setPhase('error')
        }
      })()

    return () => {
      active = false
    }
  }, [songId])

  // Sync the preview course with the wiki difficulty selector without refetching.
  useEffect(() => {
    if (!parsed) return
    const preferred = preferredDifficulty?.toLowerCase() === 'ura' ? 'edit' : preferredDifficulty?.toLowerCase()
    if (preferred && parsed[preferred]) setCourse(preferred)
  }, [parsed, preferredDifficulty])

  const rootChart = useMemo(() => {
    if (!parsed || !course) return null
    let root = parsed[course]
    if (!root) return null
    if (root.playerSides) {
      root = root.playerSides.p1 ?? Object.values(root.playerSides)[0] ?? root
    }
    return root
  }, [parsed, course])

  const hasBranches = Boolean(rootChart?.branches)

  const currentChart = useMemo(() => {
    if (!rootChart) return null
    if (branchView === 'all') return rootChart
    return rootChart.branches?.[branchView] ?? rootChart
  }, [rootChart, branchView])

  const gapInfo = useMemo(() => {
    if (!info || !currentChart || info.location.charIndex < 0) return null
    const { barIndex, charIndex } = info.location
    const measures = getGapMeasures(currentChart, barIndex, charIndex, GAP_OPTIONS)
    if (measures === null) return null
    const ms = getGapMs(currentChart, barIndex, charIndex, GAP_OPTIONS)
    return { measures, ms }
  }, [info, currentChart])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !currentChart) return

    const chartChanged = viewRef.current === null || chartRef.current !== currentChart
    if (chartChanged) {
      hoverCleanupRef.current?.()
      clickCleanupRef.current?.()
      hoverCleanupRef.current = null
      clickCleanupRef.current = null
      optionsRef.current.selection = null
      optionsRef.current.hoveredNote = null
      selectedRef.current = null
      hoveredRef.current = null
      setSelected(null)
      setHovered(null)

      const view = createChartView(currentChart, canvas)
      viewRef.current = view
      chartRef.current = currentChart
      hoverCleanupRef.current = view.onNoteHovered((event) => hoverHandlerRef.current(event.hit))
      clickCleanupRef.current = view.onNoteClicked((event) => clickHandlerRef.current(event.hit))
    }

    const options = optionsRef.current
    options.beatsPerLine = zoom
    options.showAllBranches = branchView === 'all' && Boolean(currentChart.branches)
    options.showAttribution = true
    options.tjaSourceName = 'ESE'

    const viewOptions: ChartViewOptions = {
      renderOptions: options,
      dpr: window.devicePixelRatio || 1,
      insets: INSETS,
    }
    const view = viewRef.current
    if (!view) return
    view.invalidateLayout()
    view.render(viewOptions)
  }, [currentChart, zoom, branchView])

  useEffect(() => {
    const handleResize = () => {
      if (!viewRef.current) return
      viewRef.current.invalidateLayout()
      viewRef.current.render({
        renderOptions: optionsRef.current,
        dpr: window.devicePixelRatio || 1,
        insets: INSETS,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      hoverCleanupRef.current?.()
      clickCleanupRef.current?.()
      hoverCleanupRef.current = null
      clickCleanupRef.current = null
    }
  }, [])

  clickHandlerRef.current = (hit: HitInfo | null) => {
    const view = viewRef.current
    if (!view) return
    const options = optionsRef.current

    if (!hit) {
      options.selection = null
      selectedRef.current = null
      setSelected(null)
    } else if (hit.location.charIndex === -1) {
      // Branch line: show its info without creating a note range
      selectedRef.current = hit
      setSelected(hit)
    } else {
      const selection = options.selection
      if (!selection || (selection.start && selection.end)) {
        options.selection = { start: hit.location, end: null }
        selectedRef.current = hit
        setSelected(hit)
      } else if (sameLocation(selection.start, hit.location)) {
        options.selection = null
        selectedRef.current = null
        setSelected(null)
      } else {
        options.selection = { start: selection.start, end: hit.location }
        selectedRef.current = hit
        setSelected(hit)
      }
    }

    view.invalidateLayout()
    view.render({
      renderOptions: options,
      dpr: window.devicePixelRatio || 1,
      insets: INSETS,
    })
  }

  hoverHandlerRef.current = (hit: HitInfo | null) => {
    const canvas = canvasRef.current
    if (canvas) canvas.style.cursor = hit ? 'pointer' : 'default'
    const prev = hoveredRef.current
    const changed =
      (prev?.location.barIndex ?? -1) !== (hit?.location.barIndex ?? -1) ||
      (prev?.location.charIndex ?? -1) !== (hit?.location.charIndex ?? -1) ||
      (prev?.location.branch ?? '') !== (hit?.location.branch ?? '')
    if (changed) {
      hoveredRef.current = hit
      setHovered(hit)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="chart-preview chart-preview--state">
        <LoaderCircle className="spin" />
        <span>正在从 ESE 加载谱面…</span>
      </div>
    )
  }

  if (phase === 'error' || !parsed || !rootChart) {
    return (
      <div className="chart-preview chart-preview--state">
        <RotateCcw />
        <h3>谱面预览不可用</h3>
        <p>{errorMessage || '谱面数据缺失'}</p>
      </div>
    )
  }

  const courses = Object.keys(parsed)

  return (
    <div className="chart-preview">
      <div className="chart-preview__difficulties">
        {courses.map((key) => (
          <button
            type="button"
            key={key}
            className={`chart-preview__course${course === key ? ' is-active' : ''}`}
            onClick={() => {
              setCourse(key)
              setBranchView('all')
            }}
          >
            {COURSE_LABELS[key] ?? key}
            <small>★{parsed[key].level || '?'}</small>
          </button>
        ))}
      </div>

      <div className="chart-preview__toolbar">
        {hasBranches && (
          <div className="chart-preview__group">
            <span className="chart-preview__group-label"><GitBranch size={13} /> 分支</span>
            <div className="chart-preview__branch-buttons">
              <button
                type="button"
                className={branchView === 'all' ? 'is-active' : ''}
                onClick={() => setBranchView('all')}
              >
                全部
              </button>
              {BRANCH_KEYS.map((key) => (
                <button
                  type="button"
                  key={key}
                  className={branchView === key ? 'is-active' : ''}
                  onClick={() => setBranchView(key)}
                >
                  {BRANCH_LABELS[key]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="chart-preview__group">
          <span className="chart-preview__group-label"><MousePointerClick size={13} /> 缩放</span>
          <div className="chart-preview__zoom-buttons">
            <button
              type="button"
              aria-label="缩小"
              disabled={zoom <= ZOOM_PRESETS[0]}
              onClick={() => setZoom((value) => Math.max(ZOOM_PRESETS[0], value - 4))}
            >
              <ZoomOut size={14} />
            </button>
            <span className="chart-preview__zoom-value">{zoom} 拍/行</span>
            <button
              type="button"
              aria-label="放大"
              disabled={zoom >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
              onClick={() => setZoom((value) => Math.min(ZOOM_PRESETS[ZOOM_PRESETS.length - 1], value + 4))}
            >
              <ZoomIn size={14} />
            </button>
            {ZOOM_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset}
                className={zoom === preset ? 'is-active' : ''}
                onClick={() => setZoom(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-preview__canvas-wrap">
        <canvas ref={canvasRef} />
      </div>

      <div className="chart-preview__info">
        <div className="chart-preview__stat chart-preview__stat--wide" title="与上一音符的间隔（严格模式，限制 1 小节内）">
          <span>间隔</span>
          <strong>{gapInfo ? `${formatGapMeasures(gapInfo.measures)} 小节 · ${gapInfo.ms === null ? '—' : `${(gapInfo.ms / 1000).toFixed(3)}s`}` : '—'}</strong>
        </div>
        <div className="chart-preview__stat chart-preview__stat--wide"><span>BPM * HS = 目押速度</span><strong>{info ? format目视速度(info.bpm, info.scroll) : '—'}</strong></div>
        {hasBranches && (
          <div className="chart-preview__stat"><span>分支</span><strong>{info?.location.branch ? BRANCH_LABELS[info.location.branch] ?? info.location.branch : '—'}</strong></div>
        )}
        {hasBranches && (
          <div className="chart-preview__stat chart-preview__stat--wide"><span>分支条件</span><strong>{info?.branchStartParams ? `${info.branchStartParams.type} · N &lt; ${info.branchStartParams.p1} · E &lt; ${info.branchStartParams.p2}` : '—'}</strong></div>
        )}
      </div>
    </div>
  )
}
