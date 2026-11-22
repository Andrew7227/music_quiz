import { player, usePlayer } from '@/audio/player'
import { useSettings } from '@/stores/settings'
import { formatTime } from '@/lib/format'
import { Artwork } from './Artwork'
import { Eq } from './Eq'
import { Icon } from './icons'
import { Spinner } from './ui'

const OWNER_LABEL: Record<string, string> = { tournament: 'Playing in Tournament' }

export function PlayerBar() {
  const { track, status, error, position, duration, owner } = usePlayer()
  const { volume, muted, setVolume, setMuted } = useSettings()
  if (!track) return null

  const locked = owner !== null
  const loading = status === 'loading'
  const playing = status === 'playing'
  const shownVolume = muted ? 0 : volume

  return (
    <footer className="grid h-[76px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(320px,1.6fr)_minmax(0,1fr)] items-center gap-6 border-t border-line bg-plum px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Artwork src={track.artworkUrl} seed={track.title} alt="" className="size-12 shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-bone">{track.title}</p>
          <p className="truncate text-xs text-mist">{error && status === 'error' ? <span className="text-rose">{error}</span> : track.artist}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Replay"
            disabled={locked || loading || status === 'idle'}
            onClick={() => player.replay()}
            className="grid size-8 place-items-center rounded-full text-mist transition hover:text-bone disabled:opacity-30"
          >
            <Icon name="replay" className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label={playing ? 'Pause' : 'Play'}
            disabled={locked || loading}
            onClick={() => player.toggle()}
            className="grid size-10 place-items-center rounded-full bg-bone text-night transition hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {loading ? <Spinner className="size-4 !border-night/30 !border-t-night" /> : <Icon name={playing ? 'pause' : 'play'} className="size-[18px]" />}
          </button>
          <span className="w-6 text-marigold">{playing && <Eq />}</span>
        </div>
        <div className="flex w-full max-w-md items-center gap-2 text-[11px] tabular-nums text-mist">
          <span className="w-8 text-right">{formatTime(position)}</span>
          <input
            type="range"
            aria-label="Song position"
            min={0}
            max={duration || 30}
            step={0.1}
            value={Math.min(position, duration || 30)}
            disabled={locked || loading || status === 'idle'}
            onChange={(e) => player.seek(Number(e.target.value))}
            className="h-1 flex-1"
          />
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {locked && <span className="rounded-full border border-line px-3 py-1 text-xs whitespace-nowrap text-mist">{OWNER_LABEL[owner] ?? 'Game in control'}</span>}
        <button
          type="button"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => setMuted(!muted)}
          className="grid size-8 place-items-center rounded-full text-mist transition hover:text-bone"
        >
          <Icon name={shownVolume === 0 ? 'mute' : 'volume'} className="size-[18px]" />
        </button>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.01}
          value={shownVolume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="h-1 w-28"
        />
      </div>
    </footer>
  )
}
