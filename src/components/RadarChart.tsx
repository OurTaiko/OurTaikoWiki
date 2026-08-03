import { useId } from 'react'

export interface RadarMetric {
  label: string
  value: number
  max: number
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

export function RadarChart({ metrics, title }: RadarChartProps) {
  const gradientId = useId().replace(/:/g, '')
  const dataPoints = metrics.map((metric, index) => {
    const ratio = Math.max(0, Math.min(metric.value / metric.max, 1))
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
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--radar-start)" />
            <stop offset="1" stopColor="var(--radar-end)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
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
        <polygon points={dataPoints.map((point) => point.join(',')).join(' ')} fill={`url(#${gradientId})`} className="radar__data" />
        {dataPoints.map(([x, y], index) => (
          <g key={metrics[index].label}>
            <circle cx={x} cy={y} r="5" className="radar__point" />
            <title>{metrics[index].label}: {metrics[index].value.toFixed(2)}</title>
          </g>
        ))}
      </svg>
      <div className="radar-values">
        {metrics.map((metric) => (
          <span key={metric.label}><i />{metric.label} <b>{metric.value.toFixed(2)}</b></span>
        ))}
      </div>
    </figure>
  )
}
