import { useState, type ReactNode } from 'react'
import type { Album, Artist, Track } from '@shared/types'
import { useAsyncData } from '@/lib/useAsyncData'
import { formatCount } from '@/lib/format'
import { Artwork } from './Artwork'
import { Icon } from './icons'
import { btnGhost, Empty, Notice, Spinner } from './ui'
import { TrackRow } from './TrackRow'

export type SearchKind = 'tracks' | 'artists' | 'albums'

interface Props {
  kind: SearchKind
  /** Already debounced. */
  query: string
  trackAction?: (track: Track) => ReactNode
  onArtist?: (artist: Artist) => void
  onAlbum?: (album: Album) => void
  isSelected?: (id: string) => boolean
}

export const MIN_QUERY = 2

function SelectBadge() {
  return (
    <span className="absolute top-2 right-2 z-10 grid size-6 place-items-center rounded-full bg-marigold text-night">
      <Icon name="check" className="size-4" />
    </span>
  )
}

export function SearchResults({ kind, query, trackAction, onArtist, onAlbum, isSelected }: Props) {
  const [attempt, setAttempt] = useState(0)
  const q = query.trim()
  const active = q.length >= MIN_QUERY

  const result = useAsyncData<Track[] | Artist[] | Album[]>(
    active
      ? () => (kind === 'tracks' ? window.api.music.searchTracks(q, 30) : kind === 'artists' ? window.api.music.searchArtists(q, 24) : window.api.music.searchAlbums(q, 24))
      : null,
    [kind, q, attempt]
  )

  if (!active) return <Empty title="Search for something you love">Type at least two letters to look up songs, artists or albums.</Empty>
  if (result.loading && !result.data) {
    return (
      <div className="flex items-center gap-3 py-10 text-mist">
        <Spinner /> Searching…
      </div>
    )
  }
  if (result.error) {
    return (
      <div className="space-y-3">
        <Notice tone="error">{result.error}</Notice>
        <button type="button" className={btnGhost} onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    )
  }
  const items = result.data ?? []
  if (items.length === 0) return <Empty title={`Nothing found for “${q}”`}>Check the spelling or try a shorter search.</Empty>

  const dim = result.loading ? 'opacity-60 transition-opacity' : ''

  if (kind === 'tracks') {
    return (
      <ul className={dim}>
        {(items as Track[]).map((t) => (
          <TrackRow key={t.id} track={t} right={trackAction?.(t)} />
        ))}
      </ul>
    )
  }

  return (
    <ul className={`grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 ${dim}`}>
      {kind === 'artists' &&
        (items as Artist[]).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onArtist?.(a)} className="group relative block w-full rounded-2xl p-3 text-center transition hover:bg-plum-hi/60" aria-pressed={isSelected?.(a.id)}>
              {isSelected?.(a.id) && <SelectBadge />}
              <Artwork src={a.imageUrl} seed={a.name} round alt="" className="mx-auto size-32 shadow-lg" />
              <p className="mt-3 truncate text-sm font-medium text-bone">{a.name}</p>
              <p className="truncate text-xs text-mist">{a.fans !== undefined ? `${formatCount(a.fans)} fans on Deezer` : 'Artist'}</p>
            </button>
          </li>
        ))}
      {kind === 'albums' &&
        (items as Album[]).map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onAlbum?.(a)} className="group relative block w-full rounded-2xl p-3 text-left transition hover:bg-plum-hi/60" aria-pressed={isSelected?.(a.id)}>
              {isSelected?.(a.id) && <SelectBadge />}
              <Artwork src={a.artworkUrl} seed={a.title} alt="" className="aspect-square w-full shadow-lg" />
              <p className="mt-3 truncate text-sm font-medium text-bone">{a.title}</p>
              <p className="truncate text-xs text-mist">
                {a.artist}
                {a.releaseDate ? `, ${a.releaseDate.slice(0, 4)}` : ''}
              </p>
            </button>
          </li>
        ))}
    </ul>
  )
}
