import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

interface StarRangeSliderProps {
  value: [number, number]
  min?: number
  max?: number
  onChange: (value: [number, number]) => void
}

type DragHandle = 'low' | 'high'

export function StarRangeSlider({ value, min = 1, max = 10, onChange }: StarRangeSliderProps) {
  const [low, high] = value
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ handle: DragHandle | null; startX: number } | null>(null)
  const [dragging, setDragging] = useState<DragHandle | null>(null)

  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  const valueFromClientX = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return min
    const rect = track.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return clamp(min + Math.round(ratio * (max - min)))
  }

  const startDrag = (grabbed: DragHandle) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { handle: low === high ? null : grabbed, startX: event.clientX }
    setDragging(grabbed)
  }

  const moveDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const next = valueFromClientX(event.clientX)

    // 两端重合时无法预知用户想调整哪一端,按首次拖动方向决定
    if (drag.handle === null) {
      drag.handle = event.clientX < drag.startX ? 'low' : 'high'
      setDragging(drag.handle)
    }

    if (drag.handle === 'low') {
      if (next > high) {
        drag.handle = 'high'
        setDragging('high')
        onChange([high, next])
      } else {
        onChange([next, high])
      }
    } else {
      if (next < low) {
        drag.handle = 'low'
        setDragging('low')
        onChange([next, low])
      } else {
        onChange([low, next])
      }
    }
  }

  const endDrag = () => {
    dragRef.current = null
    setDragging(null)
  }

  const adjustWithKeyboard = (handle: DragHandle) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const current = handle === 'low' ? low : high
    let next = current
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = current - 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = current + 1
    else if (event.key === 'PageDown') next = current - 5
    else if (event.key === 'PageUp') next = current + 5
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    else return
    event.preventDefault()
    next = clamp(next)
    if (handle === 'low') onChange(next > high ? [high, next] : [next, high])
    else onChange(next < low ? [next, low] : [low, next])
  }

  const span = max - min
  const lowPercent = ((low - min) / span) * 100
  const highPercent = ((high - min) / span) * 100

  return (
    <div className="star-range" ref={trackRef}>
      <div className="star-range__track" />
      <div
        className="star-range__fill"
        style={{ left: `${lowPercent}%`, right: `${100 - highPercent}%` }}
      />
      <button
        type="button"
        className={`star-range__thumb star-range__thumb--low${dragging === 'low' ? ' is-dragging' : ''}`}
        style={{ left: `${lowPercent}%` }}
        onPointerDown={startDrag('low')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={adjustWithKeyboard('low')}
        role="slider"
        aria-label="最低星级"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={low}
      />
      <button
        type="button"
        className={`star-range__thumb star-range__thumb--high${dragging === 'high' ? ' is-dragging' : ''}`}
        style={{ left: `${highPercent}%` }}
        onPointerDown={startDrag('high')}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={adjustWithKeyboard('high')}
        role="slider"
        aria-label="最高星级"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={high}
      />
      <span className="star-range__value star-range__value--low">{low}★</span>
      <span className="star-range__value star-range__value--high">{high}★</span>
    </div>
  )
}
