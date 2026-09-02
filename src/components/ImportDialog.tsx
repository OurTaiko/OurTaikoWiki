import { useEffect, useState, type FormEvent } from 'react'
import { Bot, CheckCircle2, FileJson, Github, KeyRound, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useWiki } from '../context/WikiContext'
import {
  GITHUB_TOKEN_STORAGE_KEY,
  SCORE_SYNCED_EVENT,
  syncScoresToGist,
} from '../utils/cloudSync'
import {
  importFromKinoko,
  importFromSakura,
  parseManualScoreImport,
  type ScoreImportResult,
} from '../utils/scoreImport'

type ImportTab = 'kinoko' | 'sakura' | 'manual'

interface ImportDialogProps {
  open: boolean
  onClose: () => void
}

const tabs: { id: ImportTab; label: string; icon: typeof KeyRound }[] = [
  { id: 'kinoko', label: '菌菌', icon: KeyRound },
  { id: 'sakura', label: 'Sakura', icon: Bot },
  { id: 'manual', label: 'JSON', icon: FileJson },
]

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const { scores, saveScores } = useWiki()
  const [tab, setTab] = useState<ImportTab>('kinoko')
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('our-taiko-wiki:kinoko-key') || '')
  const [playerId, setPlayerId] = useState(() => localStorage.getItem('our-taiko-wiki:kinoko-player') || '')
  const [token, setToken] = useState(() => localStorage.getItem('our-taiko-wiki:sakura-token') || '')
  const [manual, setManual] = useState('')
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem(GITHUB_TOKEN_STORAGE_KEY) || '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      let imported: ScoreImportResult
      if (tab === 'kinoko') {
        if (!apiKey.trim()) throw new Error('请输入菌菌 API 密钥')
        if (playerId && !/^\d+$/.test(playerId)) throw new Error('玩家 ID 只能包含数字')
        localStorage.setItem('our-taiko-wiki:kinoko-key', apiKey.trim())
        localStorage.setItem('our-taiko-wiki:kinoko-player', playerId.trim())
        imported = await importFromKinoko(apiKey.trim(), playerId.trim())
      } else if (tab === 'sakura') {
        if (!token.trim()) throw new Error('请输入 Sakura Token')
        localStorage.setItem('our-taiko-wiki:sakura-token', token.trim())
        imported = await importFromSakura(token.trim())
      } else {
        if (!manual.trim()) throw new Error('请粘贴 JSON 成绩数据')
        imported = parseManualScoreImport(manual)
      }

      if (!imported.scores.length) throw new Error('未识别到有效成绩，请检查数据格式或同步状态')
      saveScores([...scores, ...imported.scores])

      const nextGithubToken = githubToken.trim()
      if (!nextGithubToken) {
        setMessage({ kind: 'success', text: `已导入 ${imported.scores.length} 条谱面成绩` })
        return
      }
      localStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, nextGithubToken)
      if (!imported.account) {
        setMessage({ kind: 'error', text: `已导入 ${imported.scores.length} 条成绩，但 JSON 中没有账号信息，无法同步到云端` })
        return
      }
      try {
        const synced = await syncScoresToGist(nextGithubToken, imported.account, imported.rawScores)
        window.dispatchEvent(new Event(SCORE_SYNCED_EVENT))
        const syncText = synced.created ? '已创建账号备份' : synced.changed ? '已新增历史版本' : '与云端相同，无需上传'
        setMessage({ kind: 'success', text: `已导入 ${imported.scores.length} 条谱面成绩；${syncText}` })
      } catch (reason) {
        const detail = reason instanceof Error ? reason.message : '同步失败'
        setMessage({ kind: 'error', text: `成绩已保存到本机，但云同步失败：${detail}` })
      }
    } catch (reason) {
      setMessage({ kind: 'error', text: reason instanceof Error ? reason.message : '导入失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="import-dialog panel" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <header className="dialog-header">
          <div>
            <span className="eyebrow">PLAYER ARCHIVE</span>
            <h2 id="import-title">导入我的成绩</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭导入窗口"><X /></button>
        </header>

        <div className="tab-list" role="tablist" aria-label="导入方式">
          {tabs.map((item) => {
            const Icon = item.icon
            return (
              <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => { setTab(item.id); setMessage(null) }}>
                <Icon size={17} />{item.label}
              </button>
            )
          })}
        </div>

        <form onSubmit={submit} className="import-form">
          {tab === 'kinoko' && (
            <>
              <p className="form-intro">从菌菌控制台的鼓众广场格式接口同步成绩。API 密钥只保存在当前浏览器。</p>
              <label>API 密钥<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="tk_xxx..." autoFocus /></label>
              <label>玩家 ID <small>可选</small><input inputMode="numeric" value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="未填写时使用密钥默认账号" /></label>
            </>
          )}
          {tab === 'sakura' && (
            <>
              <p className="form-intro">私聊 Sakura Bot 获取“网页成绩 token”，然后粘贴到这里。</p>
              <label>Sakura Token<input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="请输入私有 Token" autoFocus /></label>
            </>
          )}
          {tab === 'manual' && (
            <>
              <p className="form-intro">兼容官方字段数组及 taiko-best 使用的旧版二维数组格式。</p>
              <label>成绩 JSON<textarea rows={8} value={manual} onChange={(event) => setManual(event.target.value)} placeholder='[{"song_no": 1, "level": 4, ...}]' autoFocus /></label>
            </>
          )}

          <label className="github-token-field"><span><Github size={15} /> GitHub Token <small>可选</small></span><input type="password" value={githubToken} onChange={(event) => setGithubToken(event.target.value)} placeholder="github_pat_…（需 Gists 读写权限）" autoComplete="off" /></label>
          <div className="privacy-note"><ShieldCheck size={17} /><span>未填写 GitHub Token 时成绩只保存到本机；填写后会同步到你的私有云端档案，不会上传到 Wiki 服务器。</span></div>
          {message && <div className={`form-message is-${message.kind}`} role="status">{message.kind === 'success' && <CheckCircle2 size={18} />}{message.text}</div>}
          <button className="primary-button import-submit" type="submit" disabled={loading}>
            {loading ? <><LoaderCircle className="spin" size={18} />正在读取…</> : '开始导入'}
          </button>
        </form>
      </section>
    </div>
  )
}
