import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { roundName, stats, totalRounds, type Contestant } from '@shared/engine/tournament'
import { usePlayer } from '@/audio/player'
import { useController } from '@/audio/useController'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'
import { Sleeve } from '@/components/Sleeve'
import { btnGhost, btnPrimary } from '@/components/ui'
import { formatElapsed, plural } from '@/lib/format'
import { useSettings } from '@/stores/settings'
import { useTournament } from '@/stores/tournament'
import { BracketDrawer } from './BracketDrawer'

export function Results() {
  const state = useTournament((s) => s.state)
  const { playAgainSame, playAgainShuffled, leave } = useTournament.getState()
  const reduce = useReducedMotion()
  const controller = useController('tournament')
  const status = usePlayer((s) => s.status)
  const [bracketOpen, setBracketOpen] = useState(false)
  const champion = state?.champion ? (state.contestants[state.champion] as Contestant) : null

  useEffect(() => {
    if (controller && champion && useSettings.getState().autoplayBoth) void controller.play(champion.track)
  }, [controller, champion])

  if (!state || !champion) return null

  const st = stats(state)
  const podium = st.standings.slice(1, 4).map((id) => state.contestants[id] as Contestant)
  const lastRound = roundName(totalRounds(state) - 1, totalRounds(state))
  const playing = status === 'playing'
  const noun = champion.kind === 'track' ? 'song' : champion.kind

  return (
    <div className="relative isolate h-full overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 scale-125 bg-cover bg-center opacity-30 blur-3xl"
        style={champion.imageUrl ? { backgroundImage: `url(${JSON.stringify(champion.imageUrl)})` } : undefined}
      />
      <div className="flex h-full items-center justify-center overflow-y-auto px-10 py-8">
      <div className="grid w-full max-w-5xl grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-center gap-12">
        <motion.div initial={{ scale: reduce ? 1 : 0.85, opacity: reduce ? 1 : 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: reduce ? 0 : 0.6, ease: [0.22, 0.9, 0.28, 1] }}>
          <button
            type="button"
            aria-label={playing ? `Pause ${champion.title}` : `Play ${champion.title}`}
            onClick={() => (playing ? controller?.pause() : status === 'idle' ? void controller?.play(champion.track) : controller?.resume())}
            className="block w-full"
          >
            {/* 74% leaves room for the record that slides out to the right. */}
            <Sleeve src={champion.imageUrl} title={champion.title} side="a" playing={playing} className="w-[74%]" />
          </button>
        </motion.div>

        <div className="min-w-0">
          <p className="font-display text-xl text-marigold">Champion</p>
          <h1 className="mt-2 line-clamp-3 font-display text-5xl leading-[1.05] font-semibold tracking-tight">{champion.title}</h1>
          <p className="mt-2 text-lg text-mist">{champion.subtitle}</p>
          <p className="mt-6 max-w-md text-sm text-mist">
            Won the {lastRound.toLowerCase()} of a {st.contestants}-{noun} bracket. You decided {st.matchesPlayed - st.forfeits} of {st.matchesTotal} matches
            {st.durationMs !== null ? ` in ${formatElapsed(st.durationMs)}` : ''}.
            {st.forfeits > 0 && ` ${plural(st.forfeits, 'match', 'matches')} ${st.forfeits === 1 ? 'was' : 'were'} skipped because a song had no audio.`}
          </p>

          {podium.length > 0 && (
            <ol className="mt-6 max-w-md space-y-1">
              {podium.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                  <span className="w-5 text-center font-display text-lg text-mist">{i + 2}</span>
                  <Artwork src={c.imageUrl} seed={c.title} className="size-10 shrink-0" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block truncate text-xs text-mist">{c.subtitle}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className={btnPrimary} onClick={playAgainShuffled}>
              Shuffle and play again
            </button>
            <button type="button" className={btnGhost} onClick={playAgainSame}>
              Replay the same bracket
            </button>
            <button type="button" className={btnGhost} onClick={() => setBracketOpen(true)}>
              <Icon name="bracket" className="size-4" /> Full bracket
            </button>
            <button type="button" className={btnGhost} onClick={leave}>
              New tournament
            </button>
          </div>
        </div>
      </div>
      </div>
      <BracketDrawer state={state} open={bracketOpen} onClose={() => setBracketOpen(false)} />
    </div>
  )
}
