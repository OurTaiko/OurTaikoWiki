import type { CSSProperties } from 'react'
import { ArrowUpRight, CalendarDays, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWiki } from '../context/WikiContext'
import { difficultyKeys, type Song } from '../types'
import { DifficultyBadge } from './DifficultyBadge'

export function SongCard({ song, index }: { song: Song; index: number }) {
  const { scores } = useWiki()
  const bestScore = scores
    .filter((score) => score.id === song.id)
    .sort((a, b) => b.highScore - a.highScore)[0]

  return (
    <article className="song-card" style={{ '--card-index': Math.min(index, 12) } as CSSProperties}>
      <Link to={`/songs/${song.id}`} className="song-card__link" aria-label={`查看 ${song.title} 详情`}>
        <div className="song-card__index">NO. {String(song.id).padStart(4, '0')}</div>
        <div className="song-card__heading">
          <div className="song-category-list">
            {song.categories.length > 0
              ? song.categories.map((category) => (
                <span className="category-tag" key={`${category.type}-${category.sort}`}>{category.type.replace(/音乐$/, '')}</span>
              ))
              : <span className="category-tag">未分类</span>}
          </div>
          <ArrowUpRight className="song-card__arrow" />
        </div>
        <h2>{song.title}</h2>
        {song.subtitle && (
          <p>{song.subtitle}</p>
        )}
        <div className="song-card__levels">
          {difficultyKeys.map((difficulty) => <DifficultyBadge key={difficulty} difficulty={difficulty} value={song.levels[difficulty]} />)}
        </div>
        <footer>
          <span><CalendarDays size={14} />{song.openDay || '日期未收录'}</span>
          {bestScore && <span className="personal-best"><Trophy size={14} />{bestScore.highScore.toLocaleString()}</span>}
        </footer>
      </Link>
    </article>
  )
}
