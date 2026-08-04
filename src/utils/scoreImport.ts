import type { ImportedScore } from '../types'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : null
}

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeScore(item: UnknownRecord): ImportedScore | null {
  const id = numeric(item.song_no ?? item.songNo ?? item.id)
  const difficulty = numeric(item.level ?? item.difficulty)
  if (!id || difficulty < 1 || difficulty > 5) return null

  return {
    id,
    difficulty,
    highScore: numeric(item.high_score ?? item.highScore ?? item.score),
    scoreRank: (item.best_score_rank ?? item.scoreRank ?? item.badge ?? '') as number | string,
    good: numeric(item.good_cnt ?? item.good),
    ok: numeric(item.ok_cnt ?? item.ok),
    bad: numeric(item.ng_cnt ?? item.bad),
    drumroll: numeric(item.pound_cnt ?? item.drumroll ?? item.roll),
    combo: numeric(item.combo_cnt ?? item.combo ?? item.maxCombo),
    plays: numeric(item.stage_cnt ?? item.plays ?? item.playCount),
    clears: numeric(item.clear_cnt ?? item.clears ?? item.clearCount),
    fullCombos: numeric(item.full_combo_cnt ?? item.fullCombos ?? item.fullcomboCount),
    perfects: numeric(item.dondaful_combo_cnt ?? item.perfects ?? item.perfectCount),
    updatedAt: String(item.update_datetime ?? item.highscore_datetime ?? item.updatedAt ?? ''),
  }
}

export function extractOfficialScores(payload: unknown): ImportedScore[] {
  const root = asRecord(payload)
  const data = asRecord(root?.data)
  const playedRecords = asRecord(data?.playedRecords ?? root?.playedRecords)
  const candidates: unknown[] = [
    playedRecords?.scoreInfo,
    data?.songs,
    data?.scoreInfo,
    root?.songs,
    root?.scoreInfo,
    root?.data,
    payload,
  ]

  const source = candidates.find(Array.isArray)
  if (!Array.isArray(source)) return []
  return source
    .map(asRecord)
    .filter((item): item is UnknownRecord => item !== null)
    .map(normalizeScore)
    .filter((item): item is ImportedScore => item !== null)
}

export function parseManualScores(input: string): ImportedScore[] {
  const parsed: unknown = JSON.parse(input)
  const scores = extractOfficialScores(parsed)
  if (scores.length) return scores

  if (Array.isArray(parsed) && parsed.every(Array.isArray)) {
    return parsed.map((row) => normalizeScore({
      song_no: row[0],
      level: row[1],
      high_score: row[2],
      best_score_rank: row[3],
      good_cnt: row[4],
      ok_cnt: row[5],
      ng_cnt: row[6],
      pound_cnt: row[7],
      combo_cnt: row[8],
      stage_cnt: row[9],
      clear_cnt: row[10],
      full_combo_cnt: row[11],
      dondaful_combo_cnt: row[12],
      update_datetime: row[13],
    })).filter((item): item is ImportedScore => item !== null)
  }

  return []
}

export async function importFromSakura(token: string): Promise<ImportedScore[]> {
  const response = await fetch('https://sakura-bot.cn/api/public-score/by-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = asRecord(payload)?.message
    throw new Error(typeof message === 'string' ? message : `Sakura 请求失败（HTTP ${response.status}）`)
  }
  return extractOfficialScores(payload)
}

export async function importFromKinoko(apiKey: string, playerId: string): Promise<ImportedScore[]> {
  const query = playerId ? `?player_id=${encodeURIComponent(playerId)}` : ''
  const response = await fetch(`https://kinoko.zorua.cn/api/v1/scores/hiroba${query}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = asRecord(payload)
    const message = error?.message ?? error?.detail ?? error?.error
    throw new Error(typeof message === 'string' ? message : `菌菌请求失败（HTTP ${response.status}）`)
  }
  return extractOfficialScores(payload)
}
