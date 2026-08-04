import { Calculator, Database, Monitor } from 'lucide-react'
import { songSources } from '../data/sources'
import { useWiki } from '../context/WikiContext'
import type { AlgoVersion, SourceId } from '../types'

const ALGO_OPTIONS: { id: AlgoVersion; label: string; desc: string }[] = [
  {
    id: 'v1',
    label: 'V1 · FumenDB定数 + 咕咕算法 v1',
    desc: '使用 FumenDB 定数，结合咕咕算法 v1 计算单曲与综合 Rating。',
  },
  {
    id: 'v2',
    label: 'V2 · 咕咕定数 + 咕咕算法 v2',
    desc: '使用咕咕定数 v1，结合咕咕算法 v2，按达成率分段计算并拆分为六项能力。',
  },
]

export function SettingsPage() {
  const { theme, setTheme, sourceId, setSourceId, algoVersion, setAlgoVersion } = useWiki()

  return (
    <main className="page-shell settings-page">
      <section className="settings-hero">
        <span className="eyebrow">SETTINGS</span>
        <h1>应用设置</h1>
        <p>所有偏好仅保存在当前浏览器中。</p>
      </section>

      <section className="settings-section panel">
        <header className="settings-section__header">
          <Monitor size={20} />
          <div>
            <h2>界面风格</h2>
            <p>切换页面配色与视觉主题</p>
          </div>
        </header>
        <div className="settings-options">
          <label className={`settings-option-card${theme === 'archive' ? ' is-active' : ''}`}>
            <input type="radio" name="theme" value="archive" checked={theme === 'archive'} onChange={() => setTheme('archive')} />
            <strong>和紙档案</strong>
            <span>浅色暖调 · 原生日式质感</span>
          </label>
          <label className={`settings-option-card${theme === 'ffxiv' ? ' is-active' : ''}`}>
            <input type="radio" name="theme" value="ffxiv" checked={theme === 'ffxiv'} onChange={() => setTheme('ffxiv')} />
            <strong>FF14 风格</strong>
            <span>深色金属质感 · 最终幻想 XIV 主题</span>
          </label>
        </div>
      </section>

      <section className="settings-section panel">
        <header className="settings-section__header">
          <Database size={20} />
          <div>
            <h2>曲库来源</h2>
            <p>选择歌曲数据的获取渠道</p>
          </div>
        </header>
        <div className="settings-options">
          {songSources.map((source) => (
            <label key={source.id} className={`settings-option-card${sourceId === source.id ? ' is-active' : ''}`}>
              <input type="radio" name="source" value={source.id} checked={sourceId === source.id} onChange={() => setSourceId(source.id as SourceId)} />
              <strong>{source.label}</strong>
              <span>{source.description}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="settings-section panel">
        <header className="settings-section__header">
          <Calculator size={20} />
          <div>
            <h2>Rating 算法</h2>
            <p>选择单曲与综合 Rating 的计算版本</p>
          </div>
        </header>
        <div className="settings-options">
          {ALGO_OPTIONS.map((option) => (
            <label key={option.id} className={`settings-option-card${algoVersion === option.id ? ' is-active' : ''}`}>
              <input type="radio" name="algo" value={option.id} checked={algoVersion === option.id} onChange={() => setAlgoVersion(option.id)} />
              <strong>{option.label}</strong>
              <span>{option.desc}</span>
            </label>
          ))}
        </div>
      </section>
    </main>
  )
}
