import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Database, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { SongCard } from '../components/SongCard'
import { useWiki } from '../context/WikiContext'
import type { Song } from '../types'

type SortMode = 'id' | 'openDay' | 'oni' | 'title' | 'category'
const PAGE_SIZE = 24

function dateValue(value: string) {
  if (!value) return 0
  const [month, day, year] = value.split('/').map(Number)
  return year && month && day ? new Date(year, month - 1, day).getTime() : new Date(value).getTime() || 0
}

function categorySortValue(song: Song, category: string): number {
  return song.categories.find((item) => item.type === category)?.sort ?? Number.MAX_SAFE_INTEGER
}

function compareSongs(mode: SortMode, reverse: boolean, category: string) {
  return (a: Song, b: Song) => {
    let result = 0
    if (mode === 'title') {
      result = a.title.localeCompare(b.title, 'zh-CN') || a.id - b.id
    } else if (mode === 'oni') {
      result = Number(b.levels.oni || 0) - Number(a.levels.oni || 0) || b.id - a.id
    } else if (mode === 'openDay') {
      result = dateValue(b.openDay) - dateValue(a.openDay) || b.id - a.id
    } else if (mode === 'category') {
      result = categorySortValue(a, category) - categorySortValue(b, category) || a.id - b.id
    } else {
      result = a.id - b.id
    }
    return reverse ? -result : result
  }
}

export function SongsPage() {
  const { songs, loading, error, reload } = useWiki()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [category, setCategory] = useState('全部')
  const [sort, setSort] = useState<SortMode>('id')
  const [reverse, setReverse] = useState(false)
  const [page, setPage] = useState(1)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    songs.forEach((song) => {
      for (const { type } of song.categories) {
        counts.set(type, (counts.get(type) || 0) + 1)
      }
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [songs])

  const filteredSongs = useMemo(() => songs
    .filter((song) => category === '全部' || song.categories.some((item) => item.type === category))
    .filter((song) => {
      if (!deferredQuery) return true
      return [song.title, song.titleJp, song.subtitle, String(song.id)]
        .some((value) => value.toLocaleLowerCase().includes(deferredQuery))
    })
    .sort(compareSongs(sort, reverse, category)), [songs, category, deferredQuery, sort, reverse])

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const visibleSongs = filteredSongs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [category, deferredQuery, sort, reverse])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  return (
    <main className="page-shell songs-page">
      <section className="catalog-toolbar panel" aria-label="歌曲筛选">
        <div className="search-box">
          <Search />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索中文名、日文名或曲目 ID…" aria-label="搜索歌曲" />
          {query && <button type="button" onClick={() => setQuery('')}>清除</button>}
        </div>
        <div className="toolbar-row">
          <div className="category-scroll" aria-label="歌曲分类">
            <button
              className={category === '全部' ? 'is-active' : ''}
              onClick={() => {
                setCategory('全部')
                setSort((value) => value === 'category' ? 'id' : value)
              }}
            >全部 <span>{songs.length}</span></button>
            {categories.map(([name, count]) => (
              <button key={name} className={category === name ? 'is-active' : ''} onClick={() => setCategory(name)}>{name.replace(/音乐$/, '')} <span>{count}</span></button>
            ))}
          </div>
          <label className="sort-select"><SlidersHorizontal size={16} /><span>排序</span>
            <select value={sort} onChange={(event) => {
              setSort(event.target.value as SortMode)
              setReverse(false)
            }}>
              <option value="id">曲目 ID</option>
              <option value="openDay">上线时间</option>
              <option value="oni">魔王星级</option>
              <option value="title">曲名</option>
              <option value="category" disabled={category === '全部'}>分类顺序</option>
            </select>
            <button
              type="button"
              className={`sort-direction${reverse ? ' is-reversed' : ''}`}
              onClick={() => setReverse((value) => !value)}
              aria-label="切换排序方向"
            >
              {reverse ? <ArrowUp /> : <ArrowDown />}
            </button>
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
