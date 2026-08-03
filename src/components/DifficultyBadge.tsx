import type { DifficultyKey } from '../types'

export const difficultyMeta: Record<DifficultyKey, { label: string; short: string; index: number }> = {
  easy: { label: '简单', short: '梅', index: 1 },
  normal: { label: '普通', short: '竹', index: 2 },
  hard: { label: '困难', short: '松', index: 3 },
  oni: { label: '魔王', short: '鬼', index: 4 },
  ura: { label: '里谱面', short: '里', index: 5 },
}

interface DifficultyBadgeProps {
  difficulty: DifficultyKey
  value: number | string | null
  active?: boolean
  onClick?: () => void
}

export function DifficultyBadge({ difficulty, value, active, onClick }: DifficultyBadgeProps) {
  const meta = difficultyMeta[difficulty]
  const className = `difficulty-badge difficulty-${difficulty}${active ? ' is-active' : ''}${value === null ? ' is-empty' : ''}`
  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick} disabled={value === null} aria-pressed={active}>
        <span className="difficulty-badge__mark">{meta.short}</span>
        <span className="difficulty-badge__value">{value ?? '—'}</span>
        <span className="sr-only">{meta.label}</span>
      </button>
    )
  }
  return (
    <div className={className} title={`${meta.label} ${value ?? '无谱面'}`}>
      <span className="difficulty-badge__mark">{meta.short}</span>
      <span className="difficulty-badge__value">{value ?? '—'}</span>
    </div>
  )
}
