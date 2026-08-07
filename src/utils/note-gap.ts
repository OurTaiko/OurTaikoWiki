import { NoteType, RENDERABLE_NOTES } from '../../TJARenderer/src/primitives'
import { getEffectiveBpm, type ParsedChart } from '../../TJARenderer/src/tja-parser'

const LONG_NOTE_TYPES = [NoteType.Drumroll, NoteType.DrumrollBig, NoteType.Balloon, NoteType.Kusudama, NoteType.End]

/**
 * How to handle long notes (drumrolls, balloons, kusudama) when measuring gaps.
 * - End: stop at the End marker of a long note (default)
 * - Start: skip End markers, stop at the long note start (Drumroll/Balloon/etc.)
 * - Skip: skip the entire long note, find the previous judgeable note
 * - Strict: return null if a long note is encountered before a judgeable note
 */
export enum LongNoteHandling {
  End = 'end',
  Start = 'start',
  Skip = 'skip',
  Strict = 'strict',
}

export interface GapOptions {
  /** How to handle long notes when measuring gaps. Defaults to LongNoteHandling.End. */
  longNoteHandling?: LongNoteHandling
  /** Maximum gap in measures before returning null. Defaults to no limit. */
  maxMeasures?: number
}

interface BarSegment {
  fraction: number
  bpm: number
}

/**
 * Walk backwards from (currentBarIdx, currentCharIdx) to the previous renderable note,
 * collecting per-bar segments with their measure fractions and BPMs.
 * Returns null if no previous note is found (or options filter it out).
 */
function getGapSegments(
  chart: ParsedChart,
  currentBarIdx: number,
  currentCharIdx: number,
  options: GapOptions = {},
): BarSegment[] | null {
  const { longNoteHandling = LongNoteHandling.End, maxMeasures } = options
  const currentBar = chart.bars[currentBarIdx]
  const currentTotal = currentBar.length
  const currentParams = chart.barParams?.[currentBarIdx]
  if (!currentParams) return null
  const currentRatio = currentParams.measureRatio
  const currentBpm = getEffectiveBpm(currentParams, currentCharIdx)

  // Check within current bar
  for (let i = currentCharIdx - 1; i >= 0; i--) {
    if (RENDERABLE_NOTES.includes(currentBar[i])) {
      if (LONG_NOTE_TYPES.includes(currentBar[i])) {
        if (longNoteHandling === LongNoteHandling.Strict) return null
        if (longNoteHandling === LongNoteHandling.Skip) continue
        if (longNoteHandling === LongNoteHandling.Start && currentBar[i] === NoteType.End) continue
      }
      const fraction = ((currentCharIdx - i) / currentTotal) * currentRatio
      return [{ fraction, bpm: getEffectiveBpm(currentParams, i) }]
    }
  }

  // Accumulate across previous bars
  const segments: BarSegment[] = [{ fraction: (currentCharIdx / currentTotal) * currentRatio, bpm: currentBpm }]
  let totalMeasures = segments[0].fraction

  for (let b = currentBarIdx - 1; b >= 0; b--) {
    const prevBar = chart.bars[b]
    const prevParams = chart.barParams?.[b]
    const prevRatio = prevParams?.measureRatio ?? 1.0
    if (!prevParams) return null
    const prevBpm = getEffectiveBpm(prevParams, prevBar?.length ?? 0)

    if (!prevBar || prevBar.length === 0) {
      if (maxMeasures !== undefined && totalMeasures + prevRatio > maxMeasures + 0.001) return null
      segments.push({ fraction: prevRatio, bpm: prevBpm })
      totalMeasures += prevRatio
      continue
    }

    const prevTotal = prevBar.length

    for (let i = prevTotal - 1; i >= 0; i--) {
      if (RENDERABLE_NOTES.includes(prevBar[i])) {
        if (LONG_NOTE_TYPES.includes(prevBar[i])) {
          if (longNoteHandling === LongNoteHandling.Strict) return null
          if (longNoteHandling === LongNoteHandling.Skip) continue
          if (longNoteHandling === LongNoteHandling.Start && prevBar[i] === NoteType.End) continue
        }
        const distInPrev = ((prevTotal - i) / prevTotal) * prevRatio
        const candidateTotal = totalMeasures + distInPrev
        if (maxMeasures !== undefined && candidateTotal > maxMeasures + 0.0001) return null
        segments.push({ fraction: distInPrev, bpm: getEffectiveBpm(prevParams, i) })
        return segments
      }
    }

    if (maxMeasures !== undefined && totalMeasures + prevRatio > maxMeasures) return null
    segments.push({ fraction: prevRatio, bpm: prevBpm })
    totalMeasures += prevRatio
  }

  return null
}

/** Get gap to previous renderable note in measure fractions. */
export function getGapMeasures(
  chart: ParsedChart,
  barIdx: number,
  charIdx: number,
  options: GapOptions = {},
): number | null {
  const segments = getGapSegments(chart, barIdx, charIdx, options)
  if (!segments) return null
  let total = 0
  for (const seg of segments) {
    total += seg.fraction
  }
  return total
}

/** Get gap to previous renderable note in milliseconds, using per-bar BPM. */
export function getGapMs(chart: ParsedChart, barIdx: number, charIdx: number, options: GapOptions = {}): number | null {
  const segments = getGapSegments(chart, barIdx, charIdx, options)
  if (!segments) return null
  let totalMs = 0
  for (const seg of segments) {
    totalMs += (seg.fraction * 240000) / seg.bpm
  }
  return totalMs
}
