import type { ImportedScore } from '../types'

type UnknownRecord = Record<string, unknown>

export interface ScoreAccount {
  userid: string
  server: string
}

export interface ScoreImportResult {
  scores: ImportedScore[]
  rawScores: unknown[]
  account: ScoreAccount | null
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : null
}

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeServer(value: unknown): string {
  const server = String(value ?? '').trim().toLowerCase()
  return server === 'wahlap' || server === 'cn' || !server ? 'cn' : server
}

function normalizeScore(item: UnknownRecord): ImportedScore | null {
  const id = numeric(item.song_no ?? item.songNo ?? item.song_id ?? item.songId ?? item.id)
  const difficulty = numeric(item.level ?? item.difficulty ?? item.difficulty_type ?? item.diff)
  if (!id || difficulty < 1 || difficulty > 5) return null

  return {
    id,
    difficulty,
    highScore: numeric(item.high_score ?? item.highScore ?? item.score),
    scoreRank: (item.best_score_rank ?? item.scoreRank ?? item.score_rank ?? item.badge ?? item.rank ?? '') as number | string,
    good: numeric(item.good_cnt ?? item.good ?? item.great ?? item.great_cnt ?? item.great_count),
    ok: numeric(item.ok_cnt ?? item.ok ?? item.good_count ?? item.ok_count),
    bad: numeric(item.ng_cnt ?? item.bad ?? item.miss ?? item.bad_cnt ?? item.ng_count ?? item.miss_count),
    drumroll: numeric(item.pound_cnt ?? item.drumroll ?? item.roll ?? item.roll_cnt),
    combo: numeric(item.combo_cnt ?? item.combo ?? item.maxCombo ?? item.max_combo),
    plays: numeric(item.stage_cnt ?? item.plays ?? item.playCount),
    clears: numeric(item.clear_cnt ?? item.clears ?? item.clearCount),
    fullCombos: numeric(item.full_combo_cnt ?? item.fullCombos ?? item.fullcomboCount),
    perfects: numeric(item.dondaful_combo_cnt ?? item.perfects ?? item.perfectCount),
    updatedAt: String(item.update_datetime ?? item.highscore_datetime ?? item.updatedAt ?? item.updated_at ?? ''),
  }
}

function findRawScores(payload: unknown): unknown[] {
  const root = asRecord(payload)
  const data = asRecord(root?.data)
  const playedRecords = asRecord(data?.playedRecords ?? root?.playedRecords)
  const candidates: unknown[] = [
    playedRecords?.scoreInfo,
    data?.songs,
    data?.scoreInfo,
    data?.records,
    data?.scores,
    root?.songs,
    root?.scoreInfo,
    root?.records,
    root?.scores,
    root?.data,
    payload,
  ]
  return candidates.find(Array.isArray) as unknown[] | undefined ?? []
}

function extractAccount(payload: unknown): ScoreAccount | null {
  const root = asRecord(payload)
  const data = asRecord(root?.data)
  const playedRecords = asRecord(data?.playedRecords ?? root?.playedRecords)
  const profile = asRecord(data?.profile ?? root?.profile)
  const meta = asRecord(data?._meta ?? root?._meta)
  const userid = String(playedRecords?.userid ?? profile?.userid ?? root?.taikoId ?? data?.taikoId ?? '').trim()
  if (!userid) return null
  return { userid, server: normalizeServer(playedRecords?.server ?? meta?.source ?? root?.server ?? data?.server) }
}

export function extractOfficialScores(payload: unknown): ImportedScore[] {
  return findRawScores(payload)
    .map(asRecord)
    .filter((item): item is UnknownRecord => item !== null)
    .map(normalizeScore)
    .filter((item): item is ImportedScore => item !== null)
}

export function extractScoreImport(payload: unknown): ScoreImportResult {
  const rawScores = findRawScores(payload)
  return { rawScores, scores: extractOfficialScores(payload), account: extractAccount(payload) }
}

export function parseManualScoreImport(input: string): ScoreImportResult {
  const cleaned = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const parsed: unknown = JSON.parse(cleaned)
  const result = extractScoreImport(parsed)
  if (result.scores.length) return result

  if (Array.isArray(parsed) && parsed.every(Array.isArray)) {
    const scores = parsed.map((row) => normalizeScore({
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
    return { scores, rawScores: parsed, account: null }
  }

  return result
}

export function parseManualScores(input: string): ImportedScore[] {
  return parseManualScoreImport(input).scores
}

async function readImportResponse(response: Response, service: string): Promise<ScoreImportResult> {
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const error = asRecord(payload)
    const message = error?.message ?? error?.detail ?? error?.error
    throw new Error(typeof message === 'string' ? message : `${service}请求失败（HTTP ${response.status}）`)
  }
  return extractScoreImport(payload)
}

export async function importFromSakura(token: string): Promise<ScoreImportResult> {
  const response = await fetch('https://sakura-bot.cn/api/public-score/by-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  return readImportResponse(response, 'Sakura ')
}

export async function importFromKinoko(apiKey: string, playerId: string): Promise<ScoreImportResult> {
  const query = playerId ? `?player_id=${encodeURIComponent(playerId)}` : ''
  const response = await fetch(`https://kinoko.zorua.cn/api/v1/scores/hiroba${query}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return readImportResponse(response, '菌菌')
}
