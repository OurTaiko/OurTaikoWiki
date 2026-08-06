import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Database, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { SongCard } from '../components/SongCard'
import { StarRangeSlider } from '../components/StarRangeSlider'
import { difficultyMeta } from '../components/DifficultyBadge'
import { useWiki } from '../context/WikiContext'
import { difficultyKeys, type DifficultyKey, type ImportedScore, type Song } from '../types'

type SortMode = 'id' | 'openDay' | 'category' | DifficultyKey
const PAGE_SIZE = 24

const sortOptions: Array<{ mode: SortMode; label: string }> = [
  { mode: 'id', label: '曲目ID' },
  { mode: 'openDay', label: '上线时间' },
  { mode: 'category', label: '分类顺序' },
  { mode: 'oni', label: '魔王' },
  { mode: 'ura', label: '里魔王' },
  { mode: 'easy', label: '简单' },
  { mode: 'normal', label: '一般' },
  { mode: 'hard', label: '困难' },
]

interface PlayFilter {
  fullCombo: boolean
  perfect: boolean
  clear: boolean
  play: boolean
}

const initialPlayFilter: PlayFilter = { fullCombo: false, perfect: false, clear: false, play: false }

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
    if (mode === 'openDay') {
      result = dateValue(b.openDay) - dateValue(a.openDay) || b.id - a.id
    } else if (mode === 'category') {
      result = categorySortValue(a, category) - categorySortValue(b, category) || a.id - b.id
    } else if (mode === 'id') {
      result = a.id - b.id
    } else {
      result = Number(b.levels[mode] || 0) - Number(a.levels[mode] || 0) || b.id - a.id
    }
    return reverse ? -result : result
  }
}

export function SongsPage() {
  const { songs, scores, loading, error, reload } = useWiki()
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase())
  const [category, setCategory] = useState('全部')
  const [sort, setSort] = useState<SortMode>('id')
  const [reverse, setReverse] = useState(false)
  const [page, setPage] = useState(1)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [selectedDifficulties, setSelectedDifficulties] = useState<ReadonlySet<DifficultyKey>>(
    () => new Set(difficultyKeys),
  )
  const [starRange, setStarRange] = useState<[number, number]>([1, 10])
  const [playFilters, setPlayFilters] = useState<PlayFilter>(initialPlayFilter)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    songs.forEach((song) => {
      for (const { type } of song.categories) {
        counts.set(type, (counts.get(type) || 0) + 1)
      }
    })
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [songs])

  const filteredSongs = useMemo(() => {
    const scoreIndex = new Map<string, ImportedScore>()
    for (const score of scores) scoreIndex.set(`${score.id}-${score.difficulty}`, score)

    const matchesAdvanced = (song: Song): boolean => difficultyKeys.some((key) => {
      const level = song.levels[key]
      if (level === null || !selectedDifficulties.has(key)) return false
      const stars = Number(level)
      if (!Number.isFinite(stars) || stars < starRange[0] || stars > starRange[1]) return false
      const score = scoreIndex.get(`${song.id}-${difficultyMeta[key].index}`)
      if (playFilters.fullCombo && (!score || score.fullCombos < 1)) return false
      if (playFilters.perfect && (!score || score.perfects < 1)) return false
      if (playFilters.clear && (!score || score.clears < 1)) return false
      if (playFilters.play && (!score || score.plays < 1)) return false
      return true
    })

    return songs
      .filter((song) => category === '全部' || song.categories.some((item) => item.type === category))
      .filter((song) => {
        if (!deferredQuery) return true
        return [song.title, song.titleJp, song.subtitle, String(song.id)]
          .some((value) => value.toLocaleLowerCase().includes(deferredQuery))
      })
      .filter(matchesAdvanced)
      .sort(compareSongs(sort, reverse, category))
  }, [songs, category, deferredQuery, sort, reverse, scores, selectedDifficulties, starRange, playFilters])

  const advancedActiveCount =
    (difficultyKeys.length - selectedDifficulties.size) +
    (starRange[0] > 1 || starRange[1] < 10 ? 1 : 0) +
    Number(playFilters.fullCombo) + Number(playFilters.perfect) +
    Number(playFilters.clear) + Number(playFilters.play)

  const toggleDifficulty = (key: DifficultyKey) => {
    setSelectedDifficulties((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE))
  const visibleSongs = filteredSongs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [category, deferredQuery, sort, reverse, selectedDifficulties, starRange, playFilters])

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
        </div>
        <div className="toolbar-row toolbar-row--sort">
          <div className="sort-chips" role="group" aria-label="排序方式">
            <span className="sort-chips__label"><SlidersHorizontal size={16} />排序</span>
            {sortOptions.map(({ mode, label }) => {
              const categoryDisabled = mode === 'category' && category === '全部'
              return (
                <button
                  key={mode}
                  type="button"
                  className={`sort-chip${sort === mode ? ' is-active' : ''}`}
                  onClick={() => {
                    if (categoryDisabled) return
                    setSort(mode)
                    setReverse(false)
                  }}
                  disabled={categoryDisabled}
                  aria-pressed={sort === mode}
                >
                  {label}
                </button>
              )
            })}
            <button
              type="button"
              className={`sort-direction${reverse ? ' is-reversed' : ''}`}
              onClick={() => setReverse((value) => !value)}
              aria-label="切换排序方向"
            >
              {reverse ? <ArrowUp /> : <ArrowDown />}
            </button>
          </div>
          <button
            type="button"
            className={`advanced-toggle${advancedOpen ? ' is-open' : ''}`}
            onClick={() => setAdvancedOpen((value) => !value)}
            aria-expanded={advancedOpen}
            aria-controls="advanced-search"
          >
            <SlidersHorizontal size={15} />
            <span>使用高级搜索</span>
            {advancedActiveCount > 0 && <b className="advanced-toggle__count">{advancedActiveCount}</b>}
            <ChevronDown size={15} className={`advanced-toggle__chevron${advancedOpen ? ' is-rotated' : ''}`} />
          </button>
        </div>
        {advancedOpen && (
          <div id="advanced-search" className="advanced-search">
            <div className="advanced-search__group">
              <span className="advanced-search__label">难度</span>
              <div className="advanced-search__row difficulty-filter">
                {difficultyKeys.map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`difficulty-chip difficulty-${key}${selectedDifficulties.has(key) ? ' is-active' : ''}`}
                    onClick={() => toggleDifficulty(key)}
                    aria-pressed={selectedDifficulties.has(key)}
                  >
                    <span className="difficulty-chip__mark">{difficultyMeta[key].short}</span>
                    <span className="difficulty-chip__label">{difficultyMeta[key].label}</span>
                  </button>
                ))}
                <span className="difficulty-filter__actions">
                  <button type="button" onClick={() => setSelectedDifficulties(new Set(difficultyKeys))}>全选</button>
                  <button type="button" onClick={() => setSelectedDifficulties(new Set())}>清空</button>
                </span>
              </div>
            </div>
            <div className="advanced-search__group">
              <span className="advanced-search__label">星级</span>
              <div className="advanced-search__row star-filter">
                <StarRangeSlider value={starRange} onChange={setStarRange} />
              </div>
            </div>
            <div className="advanced-search__group">
              <span className="advanced-search__label">游玩状态</span>
              <div className="advanced-search__row play-filter">
                {(
                  [
                    ['fullCombo', '已全连'],
                    ['perfect', '全良'],
                    ['clear', '过关'],
                    ['play', '游玩'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="play-check">
                    <input
                      type="checkbox"
                      checked={playFilters[key]}
                      onChange={(event) => setPlayFilters((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
                <span className="play-filter__hint">勾选的状态需全部满足</span>
              </div>
            </div>
          </div>
        )}
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
