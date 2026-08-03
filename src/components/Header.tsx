import { useState } from 'react'
import { BarChart3, BookOpenText, Database, Drum, Import, Menu, Palette, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { songSources } from '../data/sources'
import { useWiki } from '../context/WikiContext'
import { ImportDialog } from './ImportDialog'

export function Header() {
  const { sourceId, setSourceId, theme, setTheme, scores } = useWiki()
  const [importOpen, setImportOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/songs" className="brand" aria-label="Our Taiko Wiki 首页">
            <span className="brand__seal"><Drum /></span>
            <span><b>OUR TAIKO</b><em>曲目鉴</em></span>
          </Link>

          <nav className={menuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="主导航">
            <NavLink to="/songs" onClick={() => setMenuOpen(false)}><BookOpenText size={17} />全部歌曲</NavLink>
            <NavLink to="/rating" onClick={() => setMenuOpen(false)}><BarChart3 size={17} />Rating</NavLink>
            <button type="button" onClick={() => { setImportOpen(true); setMenuOpen(false) }}>
              <Import size={17} />导入成绩{scores.length > 0 && <span className="nav-count">{scores.length}</span>}
            </button>
          </nav>

          <div className="header-controls">
            <label className="compact-select source-select">
              <Database size={16} />
              <span className="sr-only">歌曲数据源</span>
              <select value={sourceId} onChange={(event) => setSourceId(event.target.value as typeof sourceId)} aria-label="歌曲数据源">
                {songSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
              </select>
            </label>
            <label className="compact-select theme-select">
              <Palette size={16} />
              <span className="sr-only">界面风格</span>
              <select value={theme} onChange={(event) => setTheme(event.target.value as typeof theme)} aria-label="界面风格">
                <option value="archive">和纸档案</option>
                <option value="ffxiv">FF14 风格</option>
              </select>
            </label>
          </div>

          <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="切换导航" aria-expanded={menuOpen}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
