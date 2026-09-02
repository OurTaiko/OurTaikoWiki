import type { ImportedScore } from '../types'
import { extractOfficialScores, type ScoreAccount } from './scoreImport'

type UnknownRecord = Record<string, unknown>

export const GITHUB_TOKEN_STORAGE_KEY = 'our-taiko-wiki:github-token'
const GIST_ID_STORAGE_KEY = 'our-taiko-wiki:gist-id'
export const SCORE_SYNCED_EVENT = 'our-taiko-wiki:scores-synced'

export interface GistScoreChange {
  id: number
  difficulty: number
  previous: ImportedScore | null
  current: ImportedScore | null
}

export interface GistScoreRevision {
  version: string
  committedAt: string
  scores: ImportedScore[]
  totalScores: number
  changes: GistScoreChange[]
}

export interface GistScoreHistory {
  filename: string
  revisions: GistScoreRevision[]
}

export interface GistSyncResult {
  gistId: string
  filename: string
  changed: boolean
  created: boolean
}

interface GistFile {
  content?: string
  raw_url?: string
  truncated?: boolean
}

interface GistResponse {
  id?: string
  description?: string
  files?: Record<string, GistFile>
}

interface GistCommit {
  version?: string
  committed_at?: string
}

interface GistDiffEntry {
  committedAt: string
  changes: GistScoreChange[]
}

interface GistDiffDocument {
  version: 2
  createdAt: string
  entries: GistDiffEntry[]
}

function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : null
}

function normalizeServer(value: unknown): string {
  const server = String(value ?? '').trim().toLowerCase()
  return server === 'wahlap' || server === 'cn' || !server ? 'cn' : server
}

function normalizeStoredScore(value: unknown): ImportedScore | null {
  return extractOfficialScores([value])[0] ?? null
}

function githubHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

class GitHubRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'GitHubRequestError'
  }
}

async function githubRequest<T>(url: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, headers: { ...githubHeaders(token), ...init.headers } })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = asRecord(payload)?.message
    throw new GitHubRequestError(
      typeof message === 'string' ? `GitHub 云同步：${message}` : `GitHub 云同步请求失败（HTTP ${response.status}）`,
      response.status,
    )
  }
  return payload as T
}

function normalizeGistId(value: string): string {
  const trimmed = value.trim().replace(/\/$/, '')
  return trimmed.split('/').pop() || ''
}

function scoreFilename(account: ScoreAccount): string {
  const server = normalizeServer(account.server).replace(/[^a-z0-9_-]/gi, '') || 'cn'
  const userid = account.userid.replace(/[^a-z0-9_-]/gi, '')
  if (!userid) throw new Error('无法识别玩家 ID，不能同步到云端')
  return `taiko-score-${server}-${userid}.json`
}

function diffFilename(filename: string): string {
  return filename.replace(/\.json$/, '.diff.json')
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = asRecord(value)
  if (record) return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

async function readGistFile(file: GistFile | undefined): Promise<string | null> {
  if (!file) return null
  if (!file.truncated && typeof file.content === 'string') return file.content
  if (!file.raw_url) return typeof file.content === 'string' ? file.content : null
  const response = await fetch(file.raw_url)
  if (!response.ok) throw new Error(`云端文件读取失败（HTTP ${response.status}）`)
  return response.text()
}

async function findOurTaikoWikiGist(token: string): Promise<string> {
  for (let page = 1; ; page += 1) {
    const gists = await githubRequest<GistResponse[]>(`https://api.github.com/gists?per_page=100&page=${page}`, token)
    const match = gists.find((gist) => gist.description?.trim() === 'OurTaikoWiki' && gist.id)
    if (match?.id) return match.id
    if (gists.length < 100) return ''
  }
}

function validHistoryDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const timestamp = Date.parse(value)
  const earliest = Date.UTC(2000, 0, 1)
  const latest = Date.now() + 24 * 60 * 60 * 1000
  return Number.isFinite(timestamp) && timestamp >= earliest && timestamp <= latest
    ? new Date(timestamp).toISOString()
    : fallback
}

function isCurrentDiffDocument(content: string | null): boolean {
  if (content === null) return false
  try {
    const parsed = asRecord(JSON.parse(content))
    return parsed?.version === 2 && validHistoryDate(parsed.createdAt, '') !== ''
  } catch {
    return false
  }
}

function parseDiffDocument(content: string | null, createdAt: string): GistDiffDocument {
  if (content === null) return { version: 2, createdAt, entries: [] }
  try {
    const parsed = asRecord(JSON.parse(content))
    const entries = Array.isArray(parsed?.entries) ? parsed.entries.flatMap((value) => {
      const entry = asRecord(value)
      if (!entry || typeof entry.committedAt !== 'string' || !Array.isArray(entry.changes)) return []
      const changes = entry.changes.flatMap((candidate) => {
        const change = asRecord(candidate)
        if (!change) return []
        const previous = normalizeStoredScore(change.previous)
        const current = normalizeStoredScore(change.current)
        const score = current ?? previous
        return score ? [{ id: score.id, difficulty: score.difficulty, previous, current }] : []
      })
      return [{ committedAt: validHistoryDate(entry.committedAt, createdAt), changes }]
    }) : []
    return {
      version: 2,
      createdAt: validHistoryDate(parsed?.createdAt, createdAt),
      entries,
    }
  } catch {
    throw new Error('云端历史文件格式无效')
  }
}

async function fetchGistCommits(gistId: string, token: string): Promise<GistCommit[]> {
  const commits: GistCommit[] = []
  for (let page = 1; ; page += 1) {
    const batch = await githubRequest<GistCommit[]>(
      `https://api.github.com/gists/${encodeURIComponent(gistId)}/commits?per_page=100&page=${page}`,
      token,
    )
    commits.push(...batch)
    if (batch.length < 100) return commits
  }
}

async function buildDiffFromScoreHistory(
  gistId: string,
  filename: string,
  token: string,
  fallbackDate: string,
): Promise<GistDiffDocument> {
  const commits = (await fetchGistCommits(gistId, token)).reverse()
  const snapshots = (await Promise.all(commits.map(async (commit) => {
    if (!commit.version) return null
    const revision = await githubRequest<GistResponse>(
      `https://api.github.com/gists/${encodeURIComponent(gistId)}/${encodeURIComponent(commit.version)}`,
      token,
    )
    const content = await readGistFile(revision.files?.[filename])
    if (content === null) return null
    try {
      return {
        committedAt: validHistoryDate(commit.committed_at, fallbackDate),
        scores: extractOfficialScores(JSON.parse(content)),
      }
    } catch {
      return null
    }
  }))).filter((snapshot): snapshot is { committedAt: string; scores: ImportedScore[] } => snapshot !== null)

  if (!snapshots.length) return { version: 2, createdAt: fallbackDate, entries: [] }
  const distinct = snapshots.filter((snapshot, index) => index === 0
    || canonicalJson(snapshot.scores) !== canonicalJson(snapshots[index - 1].scores))
  const entries = distinct.slice(1).map((snapshot, index) => ({
    committedAt: snapshot.committedAt,
    changes: compareScores(distinct[index].scores, snapshot.scores),
  }))
  return { version: 2, createdAt: distinct[0].committedAt, entries }
}

async function createScoreGist(
  token: string,
  filename: string,
  content: string,
  historyFilename: string,
  createdAt: string,
): Promise<string> {
  const history: GistDiffDocument = { version: 2, createdAt, entries: [] }
  const created = await githubRequest<GistResponse>('https://api.github.com/gists', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'OurTaikoWiki',
      public: false,
      files: {
        [filename]: { content },
        [historyFilename]: { content: `${JSON.stringify(history, null, 2)}\n` },
      },
    }),
  })
  if (!created.id) throw new Error('GitHub 未返回云端档案 ID')
  return created.id
}

export async function syncScoresToGist(
  token: string,
  account: ScoreAccount,
  rawScores: unknown[],
  configuredGistId = localStorage.getItem(GIST_ID_STORAGE_KEY) || '',
): Promise<GistSyncResult> {
  const githubToken = token.trim()
  if (!githubToken) throw new Error('请填写 GitHub Token')
  const filename = scoreFilename(account)
  const historyFilename = diffFilename(filename)
  const content = `${JSON.stringify(rawScores, null, 2)}\n`
  const nextScores = extractOfficialScores(rawScores)
  const now = new Date().toISOString()
  let gistId = normalizeGistId(configuredGistId)

  if (!gistId) gistId = await findOurTaikoWikiGist(githubToken)

  if (!gistId) {
    gistId = await createScoreGist(githubToken, filename, content, historyFilename, now)
    localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken)
    localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
    return { gistId, filename, changed: true, created: true }
  }

  let gist: GistResponse
  try {
    gist = await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, githubToken)
  } catch (reason) {
    if (!(reason instanceof GitHubRequestError) || reason.status !== 404) throw reason
    const recoveredGistId = await findOurTaikoWikiGist(githubToken)
    if (recoveredGistId) {
      if (recoveredGistId === gistId) throw reason
      gistId = recoveredGistId
      gist = await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, githubToken)
      localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
    } else {
      gistId = await createScoreGist(githubToken, filename, content, historyFilename, now)
      localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken)
      localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
      return { gistId, filename, changed: true, created: true }
    }
  }

  const previousContent = await readGistFile(gist.files?.[filename])
  const historyContent = await readGistFile(gist.files?.[historyFilename])
  let previousScores: ImportedScore[] = []
  if (previousContent !== null) {
    try {
      previousScores = extractOfficialScores(JSON.parse(previousContent))
    } catch {
      throw new Error('云端当前成绩文件格式无效')
    }
  }
  const changes = compareScores(previousScores, nextScores)
  const needsHistoryMigration = previousContent !== null && !isCurrentDiffDocument(historyContent)
  const history = needsHistoryMigration
    ? await buildDiffFromScoreHistory(gistId, filename, githubToken, now)
    : parseDiffDocument(historyContent, now)
  if (previousContent !== null && historyContent !== null && changes.length === 0 && !needsHistoryMigration) {
    localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken)
    localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
    return { gistId, filename, changed: false, created: false }
  }
  if (previousContent !== null && changes.length > 0) history.entries.push({ committedAt: now, changes })

  if (changes.length === 0 && needsHistoryMigration) {
    await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, githubToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: { [historyFilename]: { content: `${JSON.stringify(history, null, 2)}\n` } } }),
    })
    localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken)
    localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
    return { gistId, filename, changed: false, created: false }
  }

  await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, githubToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: {
      [filename]: { content },
      [historyFilename]: { content: `${JSON.stringify(history, null, 2)}\n` },
    } }),
  })
  localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, githubToken)
  localStorage.setItem(GIST_ID_STORAGE_KEY, gistId)
  return { gistId, filename, changed: true, created: previousContent === null }
}

function compareScores(previous: ImportedScore[], current: ImportedScore[]): GistScoreChange[] {
  const previousMap = new Map(previous.map((score) => [`${score.id}-${score.difficulty}`, score]))
  const currentMap = new Map(current.map((score) => [`${score.id}-${score.difficulty}`, score]))
  const keys = new Set([...previousMap.keys(), ...currentMap.keys()])
  return [...keys].flatMap((key) => {
    const before = previousMap.get(key) ?? null
    const after = currentMap.get(key) ?? null
    if (before && after && canonicalJson(before) === canonicalJson(after)) return []
    const score = after ?? before
    return score ? [{ id: score.id, difficulty: score.difficulty, previous: before, current: after }] : []
  })
}

function undoChanges(scores: ImportedScore[], changes: GistScoreChange[]): ImportedScore[] {
  const scoreMap = new Map(scores.map((score) => [`${score.id}-${score.difficulty}`, score]))
  for (const change of changes) {
    const key = `${change.id}-${change.difficulty}`
    if (change.previous === null) scoreMap.delete(key)
    else scoreMap.set(key, change.previous)
  }
  return [...scoreMap.values()]
}

export async function fetchGistScoreHistory(token: string): Promise<GistScoreHistory[]> {
  const gistId = normalizeGistId(localStorage.getItem(GIST_ID_STORAGE_KEY) || '')
  if (!gistId) return []
  const gist = await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, token)
  const scoreFiles = Object.entries(gist.files || {})
    .filter(([filename]) => /^taiko-score-[a-z0-9_-]+-[a-z0-9_-]+\.json$/i.test(filename))
  const histories = await Promise.all(scoreFiles.map(async ([filename, file]) => {
    const [currentContent, historyContent] = await Promise.all([
      readGistFile(file),
      readGistFile(gist.files?.[diffFilename(filename)]),
    ])
    if (currentContent === null) return null
    const currentScores = extractOfficialScores(JSON.parse(currentContent))
    const fallbackDate = new Date().toISOString()
    const needsMigration = !isCurrentDiffDocument(historyContent)
    const history = needsMigration
      ? await buildDiffFromScoreHistory(gistId, filename, token, fallbackDate)
      : parseDiffDocument(historyContent, fallbackDate)
    if (needsMigration) {
      await githubRequest<GistResponse>(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, token, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: {
          [diffFilename(filename)]: { content: `${JSON.stringify(history, null, 2)}\n` },
        } }),
      })
    }
    let scores = currentScores
    const revisions: GistScoreRevision[] = []
    for (let index = history.entries.length - 1; index >= 0; index -= 1) {
      const entry = history.entries[index]
      revisions.push({
        version: `diff-${index + 1}`,
        committedAt: entry.committedAt,
        scores,
        totalScores: scores.length,
        changes: entry.changes,
      })
      scores = undoChanges(scores, entry.changes)
    }
    revisions.push({
      version: 'initial',
      committedAt: history.createdAt,
      scores,
      totalScores: scores.length,
      changes: [],
    })
    return { filename, revisions }
  }))
  return histories.filter((history): history is GistScoreHistory => history !== null)
}
