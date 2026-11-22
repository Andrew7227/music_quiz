import type { ReactNode } from 'react'
import { hasPreview, type Track } from '@shared/types'
import { player, usePlayer } from '@/audio/player'
import { formatDuration } from '@/lib/format'
import { Artwork } from './Artwork'
import { Eq } from './Eq'
import { Icon } from './icons'
import { Spinner } from './ui'

interface Props {
  track: Track
  right?: ReactNode
}

export function TrackRow({ track, right }: Props) {
  const status = usePlayer((s) => (s.track?.id === track.id ? s.status : null))
  const locked = usePlayer((s) => s.owner !== null)
  const playing = status === 'playing'
  const loading = status === 'loading'

  const toggle = () => {
    if (playing) player.pause()
    else if (status === 'paused') player.resume()
    else void player.play(track)
  }

  return (
    <li className="grid grid-cols-[2.25rem_2.75rem_minmax(0,1.4fr)_minmax(0,1fr)_3rem_auto] items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-plum-hi/60">
      <button
        type="button"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
        disabled={locked}
        onClick={toggle}
        className="grid size-9 place-items-center rounded-full border border-line text-bone transition hover:border-marigold hover:text-marigold disabled:opacity-40"
      >
        {loading ? <Spinner className="size-3.5" /> : <Icon name={playing ? 'pause' : 'play'} className="size-4" />}
      </button>
      <Artwork src={track.artworkUrl} seed={track.title} className="size-11" />
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-bone">
          <span className="truncate">{track.title}</span>
          {playing && <Eq className="text-marigold" />}
        </p>
        <p className="truncate text-xs text-mist">
          {track.artist}
          {!hasPreview(track) && <span className="ml-2 text-rose/90">No preview</span>}
        </p>
      </div>
      <p className="truncate text-xs text-mist">{track.album}</p>
      <p className="text-right text-xs tabular-nums text-mist">{formatDuration(track.durationMs)}</p>
      <div className="flex justify-end">{right}</div>
    </li>
  )
}
