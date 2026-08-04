import { useMemo } from 'react'

export interface RadarMetric {
  label: string
  value: number
  max?: number
  min?: number
}

interface RadarChartProps {
  metrics: RadarMetric[]
  title: string
}

function pointAt(index: number, count: number, ratio: number, radius = 112) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / count
  return [160 + Math.cos(angle) * radius * ratio, 160 + Math.sin(angle) * radius * ratio]
}

function pointsFor(metrics: RadarMetric[], ratio: number) {
  return metrics.map((_, index) => pointAt(index, metrics.length, ratio).join(',')).join(' ')
}

function resolveBounds(metrics: RadarMetric[]): { dataMin: number; dataMax: number } {
  const providedMax = metrics.reduce((m, metric) => Math.max(m, metric.max ?? 0), 0)
  const providedMin = metrics.reduce((m, metric) => Math.min(m, metric.min ?? 1000), 1000)
  const values = metrics.map((m) => m.value)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  if (rawMax <= 0 && rawMin >= 0) return { dataMin: 0, dataMax: 1 }
  let dataMin = providedMin < 1000 ? providedMin : Math.floor(rawMin) - 1
  let dataMax = providedMax > 0 ? providedMax : Math.ceil(rawMax)
  return { dataMin, dataMax }
}

function ringId(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 9)
}

export function RadarChart({ metrics, title }: RadarChartProps) {
  const gradId = useMemo(() => ringId('rg'), [])
  const clipId = useMemo(() => ringId('rc'), [])
  const { dataMin, dataMax } = resolveBounds(metrics)
  const range = dataMax - dataMin
  const gridSteps = [0.25, 0.5, 0.75, 1]

  const dataPoints = metrics.map((metric, index) => {
    const ratio = range > 0 ? Math.max(0, Math.min((metric.value - dataMin) / range, 1)) : 0.5
    return pointAt(index, metrics.length, ratio)
  })

  return (
    <figure className="radar-card">
      <figcaption>
        <span className="eyebrow">RADAR PROFILE</span>
        <strong>{title}</strong>
      </figcaption>
      <svg className="radar" viewBox="0 0 320 320" role="img" aria-label={`${title}雷达图`}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--radar-start)" />
            <stop offset="1" stopColor="var(--radar-end)" />
          </linearGradient>
          <clipPath id={clipId}>
            <polygon points={pointsFor(metrics, 1)} />
          </clipPath>
        </defs>
        {/* alternating ring backgrounds */}
        {[...gridSteps].reverse().map((ratio, i) => (
          <polygon
            key={ratio}
            points={pointsFor(metrics, ratio)}
            className={i % 2 === 0 ? 'radar__ring-a' : 'radar__ring-b'}
          />
        ))}
        {gridSteps.map((ratio) => (
          <polygon key={ratio} points={pointsFor(metrics, ratio)} className="radar__grid" />
        ))}
        {metrics.map((metric, index) => {
          const [x, y] = pointAt(index, metrics.length, 1)
          const [labelX, labelY] = pointAt(index, metrics.length, 1.22)
          return (
            <g key={metric.label}>
              <line x1="160" y1="160" x2={x} y2={y} className="radar__axis" />
              <text x={labelX} y={labelY} className="radar__label" textAnchor="middle" dominantBaseline="middle">
                {metric.label}
              </text>
            </g>
          )
        })}
        <polygon points={dataPoints.map((point) => point.join(',')).join(' ')} fill={`url(#${gradId})`} className="radar__data" />
        {dataPoints.map(([x, y], index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / metrics.length
          const labelR = Math.sqrt((x - 160) ** 2 + (y - 160) ** 2) + 16
          const lx = 160 + Math.cos(angle) * labelR
          const ly = 160 + Math.sin(angle) * labelR
          return (
            <g key={metrics[index].label}>
              <circle cx={x} cy={y} r="5" className="radar__point" />
              <text x={lx} y={ly} className="radar__value-label" textAnchor="middle" dominantBaseline="middle">
                {metrics[index].value.toFixed(2)}
              </text>
              <title>{metrics[index].label}: {metrics[index].value.toFixed(2)}</title>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
