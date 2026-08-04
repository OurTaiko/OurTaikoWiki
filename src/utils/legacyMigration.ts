import type { ImportedScore } from '../types'

/**
 * 旧域名（rating.ourtaiko.org / v2.rating.ourtaiko.org）跳转到
 * https://wiki.ourtaiko.org/migrate#data=... 后，本模块负责解码 URL hash
 * 中携带的旧版 localStorage 数据，并写入新版键名。
 *
 * 旧版键名（taiko-rating-analyzer，main/v2 分支一致）：
 * - sakuraToken    : Sakura 成绩 token
 * - kinokoApiKey   : 菌菌 API key（token）
 * - kinokoPlayerId : 菌菌 player id
 * - taikoScoreData : 成绩（UserScore 对象数组，或更早的数组行格式）
 *
 * 新版键名（our-taiko-wiki）：
 * - our-taiko-wiki:sakura-token
 * - our-taiko-wiki:kinoko-key
 * - our-taiko-wiki:kinoko-player
 * - our-taiko-wiki:scores
 */

const LEGACY_TO_NEW_KEYS: Record<string, string> = {
  sakuraToken: 'our-taiko-wiki:sakura-token',
  kinokoApiKey: 'our-taiko-wiki:kinoko-key',
  kinokoPlayerId: 'our-taiko-wiki:kinoko-player',
}

const LEGACY_SCORES_FIELD = 'taikoScoreData'
const NEW_SCORES_KEY = 'our-taiko-wiki:scores'

type UnknownRecord = Record<string, unknown>

// 旧版 analyzer 中 dondafuru（单一判定）谱面的例外：
// 这 5 首虽然 perfectCount > 0，但仍保留良/可/不可分开计数。
const DONDAFURU_EXCEPTIONS = new Set([
  '775-4',
  '775-5',
  '1032-5',
  '1037-4',
  '1356-4',
])

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rank(value: unknown): number | string {
  return typeof value === 'number' || typeof value === 'string' ? value : ''
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : null
}

// 新版 ImportedScore 独有的字段，用于区分两种对象格式
function isNewFormat(record: UnknownRecord): boolean {
  return 'difficulty' in record || 'highScore' in record || 'ok' in record
}

function fromRecord(record: UnknownRecord): ImportedScore | null {
  const id = numeric(record.id ?? record.song_no)
  const difficulty = numeric(record.level ?? record.difficulty)
  if (!id || difficulty < 1 || difficulty > 5) return null

  if (isNewFormat(record)) {
    // 已经是新版形状（防御性处理，一般不会出现在旧键里）
    return {
      id,
      difficulty,
      highScore: numeric(record.highScore ?? record.high_score ?? record.score),
      scoreRank: rank(record.scoreRank ?? record.best_score_rank ?? record.badge),
      good: numeric(record.good_cnt ?? record.good),
      ok: numeric(record.ok_cnt ?? record.ok),
      bad: numeric(record.ng_cnt ?? record.bad),
      drumroll: numeric(record.pound_cnt ?? record.drumroll ?? record.roll),
      combo: numeric(record.combo_cnt ?? record.combo ?? record.maxCombo),
      plays: numeric(record.stage_cnt ?? record.plays ?? record.playCount),
      clears: numeric(record.clear_cnt ?? record.clears ?? record.clearCount),
      fullCombos: numeric(record.full_combo_cnt ?? record.fullCombos ?? record.fullcomboCount),
      perfects: numeric(record.dondaful_combo_cnt ?? record.perfects ?? record.perfectCount),
      updatedAt: String(record.update_datetime ?? record.highscore_datetime ?? record.updatedAt ?? ''),
    }
  }

  // 旧版 UserScore 对象：great=良(good)判定数、good=可(ok)判定数、bad=不可(bad)判定数
  return {
    id,
    difficulty,
    highScore: numeric(record.score),
    scoreRank: rank(record.scoreRank),
    good: numeric(record.great),
    ok: numeric(record.good),
    bad: numeric(record.bad),
    drumroll: numeric(record.drumroll),
    combo: numeric(record.combo),
    plays: numeric(record.playCount),
    clears: numeric(record.clearCount),
    fullCombos: numeric(record.fullcomboCount),
    perfects: numeric(record.perfectCount),
    updatedAt: String(record.updatedAt ?? ''),
  }
}

function fromLegacyRow(row: unknown[]): ImportedScore | null {
  const id = numeric(row[0])
  const difficulty = numeric(row[1])
  if (!id || difficulty < 1 || difficulty > 5) return null

  // 数组行：r4=良(good)、r5=可(ok)、r6=不可(bad)
  let good = numeric(row[4])
  let ok = numeric(row[5])
  let bad = numeric(row[6])
  const perfects = numeric(row[12])
  if (perfects > 0 && !DONDAFURU_EXCEPTIONS.has(`${id}-${difficulty}`)) {
    good = good + ok + bad
    ok = 0
    bad = 0
  }

  return {
    id,
    difficulty,
    highScore: numeric(row[2]),
    scoreRank: rank(row[3]),
    good,
    ok,
    bad,
    drumroll: numeric(row[7]),
    combo: numeric(row[8]),
    plays: numeric(row[9]),
    clears: numeric(row[10]),
    fullCombos: numeric(row[11]),
    perfects,
    updatedAt: String(row[13] ?? ''),
  }
}

function toImportedScore(value: unknown): ImportedScore | null {
  if (Array.isArray(value)) return fromLegacyRow(value)
  const record = asRecord(value)
  return record ? fromRecord(record) : null
}

function readNewScores(): ImportedScore[] {
  try {
    const raw = localStorage.getItem(NEW_SCORES_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as ImportedScore[] : []
  } catch {
    return []
  }
}

// 旧版 taikoScoreData 转成新版 ImportedScore 并合并进 our-taiko-wiki:scores。
// 同 id+difficulty 时保留新版已有成绩；返回新增条数。
function mergeLegacyScores(raw: unknown): number {
  if (typeof raw !== 'string' || !raw) return 0

  let legacy: unknown
  try {
    legacy = JSON.parse(raw)
  } catch {
    return 0
  }
  if (!Array.isArray(legacy) || legacy.length === 0) return 0

  const converted = legacy
    .map(toImportedScore)
    .filter((score): score is ImportedScore => score !== null)
  if (converted.length === 0) return 0

  const merged = new Map(readNewScores().map((score) => [`${score.id}-${score.difficulty}`, score]))
  let added = 0
  for (const score of converted) {
    const key = `${score.id}-${score.difficulty}`
    if (!merged.has(key)) {
      merged.set(key, score)
      added += 1
    }
  }

  if (added > 0) {
    localStorage.setItem(NEW_SCORES_KEY, JSON.stringify([...merged.values()]))
  }
  return added
}

/**
 * 应用 URL 中携带的旧版数据：写入 Sakura / 菌菌凭据，并合并成绩。
 * 返回迁移结果；重复执行是幂等的，不会覆盖新版已有成绩。
 */
export function applyMigratedData(data: unknown): { scoresMigrated: number; tokensMigrated: string[] } {
  if (!data || typeof data !== 'object') {
    return { scoresMigrated: 0, tokensMigrated: [] }
  }

  const record = data as UnknownRecord
  const tokensMigrated: string[] = []
  for (const [legacyKey, newKey] of Object.entries(LEGACY_TO_NEW_KEYS)) {
    const value = record[legacyKey]
    if (typeof value === 'string' && value) {
      localStorage.setItem(newKey, value)
      tokensMigrated.push(newKey)
    }
  }

  const scoresMigrated = mergeLegacyScores(record[LEGACY_SCORES_FIELD])
  if (scoresMigrated > 0 || tokensMigrated.length > 0) {
    console.info(
      `[migration] 已写入 ${tokensMigrated.length} 个凭据、${scoresMigrated} 条成绩`,
    )
  }
  return { scoresMigrated, tokensMigrated }
}
