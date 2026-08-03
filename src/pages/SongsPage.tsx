import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Database, RefreshCw, Search, SlidersHorizontal, Sparkles } from 'lucide-react'
import { SongCard } from '../components/SongCard'
import { useWiki } from '../context/WikiContext'
import type { Song } from '../types'

type SortMode = 'source' | 'title' | 'oni-desc' | 'newest'
const PAGE_SIZE = 24

function dateValue(value: string) {
  if (!value) return 0
  const [month, day, year] = value.split('/').map(Number)
  return year && month && day ? new Date(year, month - 1, day).getTime() : new Date(value).getTime() || 0
}

function compareSongs(mode: SortMode) {
  return (a: Song, b: Song) => {
    if (mode === 'title') return a.title.localeCompare(b.title, 'zh-CN')
    if (mode === 'oni-desc') return Number(b.levels.oni || 0) - Number(a.levels.oni || 0) || b.sort - a.sort
    if (mode === 'newest') return dateValue(b.openDay) - dateValue(a.openDay) || b.sort - a.sort
    return b.sort - a.sort
  }
}

export function SongsPage() {
  const { songs, loading, error, reload } = useWiki()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [category, setCategory] = useState('全部')
  const [sort, setSort] = useState<SortMode>('source')
  const [page, setPage] = useState(1)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    songs.forEach((song) => counts.set(song.category, (counts.get(song.category) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [songs])

  const filteredSongs = useMemo(() => songs
    .filter((song) => category === '全部' || song.category === category)
    .filter((song) => {
      if (!deferredQuery) return true
      return [song.title, song.titleJp, song.subtitle, String(song.id)]
        .some((value) => value.toLocaleLowerCase().includes(deferredQuery))
    })
    .sort(compareSongs(sort)), [songs, category, deferredQuery, sort])

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const visibleSongs = filteredSongs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [category, deferredQuery, sort])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  return (
    <main className="page-shell songs-page">
      <section className="hero">
        <div className="hero__copy">
          <span className="eyebrow"><Sparkles size={14} /> OUR TAIKO WIKI</span>
          <h1>每一首鼓点，<br /><i>都值得被记下。</i></h1>
          <p>浏览国服曲目、星级与谱面定数。每首歌都有独立资料页，并可对照 v1 与 v2 两套分析数据。</p>
        </div>
        <div className="hero__stat" aria-label={`收录 ${songs.length} 首曲目`}>
          <span>当前收录</span>
          <strong>{loading ? '—' : songs.length.toLocaleString()}</strong>
          <small>CN SONGS</small>
          <div className="hero__stamp">曲<br />目<br />鉴</div>
        </div>
      </section>

      <section className="catalog-toolbar panel" aria-label="歌曲筛选">
        <div className="search-box">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名、日文名或曲目 ID…" aria-label="搜索歌曲" />
          {query && <button type="button" onClick={() => setQuery('')}>清除</button>}
        </div>
        <div className="toolbar-row">
          <div className="category-scroll" aria-label="歌曲分类">
            <button className={category === '全部' ? 'is-active' : ''} onClick={() => setCategory('全部')}>全部 <span>{songs.length}</span></button>
            {categories.map(([name, count]) => (
              <button key={name} className={category === name ? 'is-active' : ''} onClick={() => setCategory(name)}>{name.replace(/音乐$/, '')} <span>{count}</span></button>
            ))}
          </div>
          <label className="sort-select"><SlidersHorizontal size={16} /><span>排序</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="source">资料库顺序</option>
              <option value="newest">最近上线</option>
              <option value="oni-desc">魔王星级</option>
              <option value="title">曲名 A—Z</option>
            </select>
          </label>
        </div>
      </section>

      <div className="catalog-meta">
        <span><Database size={15} />CN 国服曲目</span>
        {!loading && !error && <b>找到 {filteredSongs.length} 首</b>}
      </div>

      {loading && (
        <div className="song-grid" aria-label="正在加载歌曲">
          {Array.from({ length: 8 }, (_, index) => <div className="song-card skeleton" key={index} />)}
        </div>
      )}

      {error && (
        <section className="state-card panel">
          <span className="state-card__mark">!</span>
          <h2>曲目资料暂时没有抵达</h2>
          <p>{error}</p>
          <button className="primary-button" onClick={reload}><RefreshCw size={17} />重新加载</button>
        </section>
      )}

      {!loading && !error && visibleSongs.length > 0 && (
        <div className="song-grid">
          {visibleSongs.map((song, index) => <SongCard key={song.id} song={song} index={index} />)}
        </div>
      )}

      {!loading && !error && visibleSongs.length === 0 && (
        <section className="state-card panel"><span className="state-card__mark">?</span><h2>没有找到这首歌</h2><p>换个关键词或分类再试试。</p></section>
      )}

      {!loading && !error && totalPages > 1 && (
        <nav className="pagination" aria-label="歌曲分页">
          <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="上一页"><ChevronLeft /></button>
          <span><b>{page}</b> / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} aria-label="下一页"><ChevronRight /></button>
        </nav>
      )}
    </main>
  )
}
