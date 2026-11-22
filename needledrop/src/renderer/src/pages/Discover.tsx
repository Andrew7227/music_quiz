import { useState } from 'react'
import type { Album, Artist, Track } from '@shared/types'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'
import { SearchBox } from '@/components/SearchBox'
import { SearchResults, type SearchKind } from '@/components/SearchResults'
import { TrackRow } from '@/components/TrackRow'
import { btnGhost, Notice, Page, PageHeader, Spinner } from '@/components/ui'
import { useAsyncData, useDebounced } from '@/lib/useAsyncData'
import { formatCount, plural } from '@/lib/format'

type Detail = { kind: 'artist'; artist: Artist } | { kind: 'album'; album: Album }

const TABS: Array<{ id: SearchKind; label: string }> = [
  { id: 'tracks', label: 'Songs' },
  { id: 'artists', label: 'Artists' },
  { id: 'albums', label: 'Albums' }
]

function DetailView({ detail, onBack }: { detail: Detail; onBack: () => void }) {
  const result = useAsyncData<Track[]>(
    () => (detail.kind === 'artist' ? window.api.music.artistTopTracks(detail.artist.id, 30) : window.api.music.albumTracks(detail.album.id).then((d) => d.tracks)),
    [detail]
  )
  const title = detail.kind === 'artist' ? detail.artist.name : detail.album.title
  const image = detail.kind === 'artist' ? detail.artist.imageUrl : detail.album.artworkUrl
  const sub =
    detail.kind === 'artist'
      ? detail.artist.fans !== undefined
        ? `${formatCount(detail.artist.fans)} fans on Deezer`
        : 'Artist'
      : `${detail.album.artist}${detail.album.releaseDate ? `, ${detail.album.releaseDate.slice(0, 4)}` : ''}`

  return (
    <div>
      <button type="button" onClick={onBack} className={`${btnGhost} mb-6`}>
        <Icon name="back" className="size-4" /> Back to results
      </button>
      <div className="mb-6 flex items-center gap-6">
        <Artwork src={image} seed={title} round={detail.kind === 'artist'} alt="" className="size-36 shadow-xl" />
        <div>
          <h2 className="font-display text-4xl font-semibold">{title}</h2>
          <p className="mt-1 text-mist">{sub}</p>
          {result.data && <p className="mt-1 text-sm text-mist">{plural(result.data.length, 'song')}{detail.kind === 'artist' ? ', most popular first' : ''}</p>}
        </div>
      </div>
      {result.loading && (
        <div className="flex items-center gap-3 py-8 text-mist">
          <Spinner /> Loading songs…
        </div>
      )}
      {result.error && <Notice tone="error">{result.error}</Notice>}
      {result.data && (
        <ul>
          {result.data.map((t) => (
            <TrackRow key={t.id} track={t} />
          ))}
        </ul>
      )}
    </div>
  )
}

export function Discover() {
  const [tab, setTab] = useState<SearchKind>('tracks')
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const debounced = useDebounced(query, 350)

  return (
    <Page>
      <PageHeader title="Discover">Look up any song, artist or album and play a 30-second preview.</PageHeader>
      {detail ? (
        <DetailView detail={detail} onBack={() => setDetail(null)} />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchBox value={query} onChange={setQuery} label="Search" placeholder="Search for a song, artist or album" autoFocus />
            </div>
            <div role="tablist" aria-label="Result type" className="flex gap-1 rounded-full border border-line p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full px-4 py-1.5 text-sm transition ${tab === t.id ? 'bg-plum-hi text-bone' : 'text-mist hover:text-bone'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <SearchResults kind={tab} query={debounced} onArtist={(artist) => setDetail({ kind: 'artist', artist })} onAlbum={(album) => setDetail({ kind: 'album', album })} />
        </div>
      )}
    </Page>
  )
}
