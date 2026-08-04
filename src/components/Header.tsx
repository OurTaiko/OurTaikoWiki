import { useState } from 'react'
import { BarChart3, BookOpenText, Drum, Import, Info, Menu, Settings, X } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { useWiki } from '../context/WikiContext'
import { ImportDialog } from './ImportDialog'

export function Header() {
  const { scores } = useWiki()
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
            <NavLink to="/about" onClick={() => setMenuOpen(false)}><Info size={17} />关于</NavLink>
            <NavLink to="/settings" onClick={() => setMenuOpen(false)} className="nav-settings"><Settings size={17} />设置</NavLink>
          </nav>

          <div className="header-controls" />

          <button className="mobile-menu-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-label="切换导航" aria-expanded={menuOpen}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  )
}
