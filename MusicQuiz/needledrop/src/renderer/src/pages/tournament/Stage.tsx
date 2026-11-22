import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { currentMatch, progress, roundName, totalRounds, type Contestant } from '@shared/engine/tournament'
import { usePlayer } from '@/audio/player'
import { useController } from '@/audio/useController'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'
import { Sleeve } from '@/components/Sleeve'
import { btnGhost, Spinner } from '@/components/ui'
import { formatTime } from '@/lib/format'
import { useSettings } from '@/stores/settings'
import { useTournament } from '@/stores/tournament'
import { BracketDrawer } from './BracketDrawer'

type Side = 'a' | 'b'

interface SideProps {
  side: Side
  contestant: Contestant
  playing: boolean
  loading: boolean
  paused: boolean
  fraction: number
  clock: string
  unavailable: boolean
  played: boolean
  outcome: 'won' | 'lost' | null
  locked: boolean
  onTogglePlay: () => void
  onRestart: () => void
  onPick: () => void
  onSkip: () => void
}

function SideCard(p: SideProps) {
  const reduce = useReducedMotion()
  const accent = p.side === 'a' ? 'text-marigold' : 'text-lagoon'
  const fill = p.side === 'a' ? 'bg-marigold' : 'bg-lagoon'
  return (
    <motion.section
      aria-label={`Side ${p.side.toUpperCase()}: ${p.contestant.title}`}
      className="relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center px-8 py-3"
      animate={{ scale: p.outcome === 'won' && !reduce ? 1.03 : 1, opacity: p.outcome === 'lost' ? 0.3 : 1 }}
      transition={{ duration: reduce ? 0 : 0.4 }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 scale-125 bg-cover bg-center opacity-35 blur-3xl"
        style={p.contestant.imageUrl ? { backgroundImage: `url(${JSON.stringify(p.contestant.imageUrl)})` } : undefined}
      />
      <p className={`mb-3 shrink-0 font-display text-lg font-semibold ${accent}`}>Side {p.side.toUpperCase()}</p>
      <Sleeve src={p.contestant.imageUrl} title={p.contestant.title} side={p.side} playing={p.playing} className="w-[clamp(150px,27vh,300px)] shrink-0" />
      <h2 className="mt-6 shrink-0 line-clamp-2 max-w-md text-center font-display text-3xl leading-tight font-semibold text-bone">{p.contestant.title}</h2>
      <p className="mt-1 line-clamp-1 max-w-md shrink-0 text-center text-mist">{p.contestant.subtitle}</p>

      <div className="mt-4 flex w-full max-w-xs shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={p.playing ? `Pause side ${p.side.toUpperCase()}` : `Play side ${p.side.toUpperCase()}`}
          disabled={p.locked}
          onClick={p.onTogglePlay}
          className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-bone transition hover:bg-plum-hi disabled:opacity-40"
        >
          {p.loading ? <Spinner className="size-4" /> : <Icon name={p.playing ? 'pause' : 'play'} className="size-[18px]" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Song progress" aria-valuenow={Math.round(p.fraction * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${fill}`} style={{ width: `${p.fraction * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-mist">{p.clock}</p>
        </div>
        <button
          type="button"
          aria-label={`Replay side ${p.side.toUpperCase()} from the start`}
          disabled={p.locked}
          onClick={p.onRestart}
          className="grid size-9 shrink-0 place-items-center rounded-full text-mist transition hover:text-bone disabled:opacity-40"
        >
          <Icon name="replay" className="size-[18px]" />
        </button>
      </div>

      {p.unavailable ? (
        <div className="mt-4 w-full max-w-xs shrink-0 text-center">
          <p className="mb-2 text-sm text-rose">No preview could be played for this one.</p>
          <button type="button" onClick={p.onSkip} className={btnGhost}>
            <Icon name="skip" className="size-4" /> Skip it, the other song advances
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={p.onPick}
          disabled={p.outcome !== null}
          className={`mt-4 w-full max-w-xs shrink-0 rounded-full ${fill} px-6 py-3 font-semibold text-night transition hover:brightness-110 disabled:opacity-60`}
        >
          Pick this one
        </button>
      )}
    </motion.section>
  )
}

export function Stage() {
  const state = useTournament((s) => s.state)
  const notice = useTournament((s) => s.notice)
  const { choose, skip, leave, dismissNotice } = useTournament.getState()
  const autoplayBoth = useSettings((s) => s.autoplayBoth)
  const reduce = useReducedMotion()

  const controller = useController('tournament')
  const status = usePlayer((s) => s.status)
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)

  const match = state ? currentMatch(state) : null
  const a = state && match?.a ? state.contestants[match.a] : undefined
  const b = state && match?.b ? state.contestants[match.b] : undefined

  const [active, setActive] = useState<Side | null>(null)
  const [unavailable, setUnavailable] = useState({ a: false, b: false })
  const [played, setPlayed] = useState({ a: false, b: false })
  const [decided, setDecided] = useState<Side | null>(null)
  const [bracketOpen, setBracketOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)

  const live = useRef({ a, b, autoplayBoth })
  live.current = { a, b, autoplayBoth }
  const timer = useRef<number | undefined>(undefined)
  const playSideRef = useRef<(side: Side) => void>(() => undefined)

  const playSide = useCallback(
    (side: Side) => {
      const c = live.current[side]
      if (!controller || !c) return
      setActive(side)
      setPlayed((p) => ({ ...p, [side]: true }))
      void controller.play(c.track, {
        onEnded: () => {
          if (side === 'a' && live.current.autoplayBoth) playSideRef.current('b')
        },
        onUnavailable: () => {
          setUnavailable((u) => ({ ...u, [side]: true }))
          if (side === 'a' && live.current.autoplayBoth) playSideRef.current('b')
        }
      })
    },
    [controller]
  )
  playSideRef.current = playSide

  // Every new match: reset local state and, if enabled, play Side A then Side B.
  const matchId = match?.id
  useEffect(() => {
    setUnavailable({ a: false, b: false })
    setPlayed({ a: false, b: false })
    setActive(null)
    setDecided(null)
    if (matchId && controller && live.current.autoplayBoth) playSide('a')
  }, [matchId, controller, playSide])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const togglePlay = (side: Side) => {
    if (!controller) return
    if (active === side && status === 'playing') controller.pause()
    else if (active === side && (status === 'paused' || status === 'ended')) controller.resume()
    else playSide(side)
  }

  const decide = (side: Side) => {
    if (decided || !match) return
    const winnerId = side === 'a' ? match.a : match.b
    if (!winnerId) return
    setDecided(side)
    controller?.stop()
    timer.current = window.setTimeout(() => choose(winnerId), reduce ? 0 : 700)
  }

  const skipSide = (side: Side) => {
    const id = side === 'a' ? match?.a : match?.b
    if (id) skip(id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === '1') playSideRef.current('a')
      else if (e.key === '2') playSideRef.current('b')
      else if (e.key === ' ' && controller) {
        e.preventDefault()
        if (status === 'playing') controller.pause()
        else controller.resume()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controller, status])

  if (!state || !match || !a || !b) return null

  const rounds = totalRounds(state)
  const inRound = (state.rounds[match.round] ?? []).filter((m) => m.decidedBy !== 'bye')
  const doneInRound = inRound.filter((m) => m.winner !== null).length
  const prog = progress(state)

  const sideProps = (side: Side, contestant: Contestant): SideProps => {
    const isActive = active === side
    return {
      side,
      contestant,
      playing: isActive && status === 'playing',
      loading: isActive && status === 'loading',
      paused: isActive && status === 'paused',
      fraction: isActive && duration > 0 ? Math.min(1, position / duration) : 0,
      clock: isActive ? `${formatTime(position)} / ${formatTime(duration || 30)}` : played[side] ? 'Played' : 'Not played yet',
      played: played[side],
      unavailable: unavailable[side],
      outcome: decided === null ? null : decided === side ? 'won' : 'lost',
      locked: decided !== null || !controller,
      onTogglePlay: () => togglePlay(side),
      onRestart: () => playSide(side),
      onPick: () => decide(side),
      onSkip: () => skipSide(side)
    }
  }

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-6 px-10 pt-5 pb-2">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{roundName(match.round, rounds)}</h1>
          <p className="text-sm text-mist">
            Match {doneInRound + 1} of {inRound.length}, {prog.played} of {prog.total} decided overall
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className={btnGhost} onClick={() => setBracketOpen(true)}>
            <Icon name="bracket" className="size-4" /> Bracket
          </button>
          {confirmLeave ? (
            <>
              <button type="button" className={btnGhost} onClick={() => setConfirmLeave(false)}>
                Keep playing
              </button>
              <button type="button" className={`${btnGhost} !border-rose/60 !text-rose`} onClick={leave}>
                Leave and lose progress
              </button>
            </>
          ) : (
            <button type="button" className={btnGhost} onClick={() => setConfirmLeave(true)}>
              Leave
            </button>
          )}
        </div>
      </header>
      <div className="mx-10 h-0.5 shrink-0 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full bg-bone/70 transition-all" style={{ width: `${(prog.played / prog.total) * 100}%` }} />
      </div>

      {notice && (
        <div className="mx-10 mt-3 flex items-center justify-between gap-4 rounded-xl border border-line bg-plum px-4 py-2.5 text-sm text-mist">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={dismissNotice} className="text-mist hover:text-bone">
            <Icon name="close" className="size-4" />
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={match.id}
          className="relative flex min-h-0 flex-1 items-stretch"
          initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: reduce ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.25 }}
        >
          <SideCard {...sideProps('a', a)} />
          <div className="relative flex w-px shrink-0 items-center justify-center bg-line" aria-hidden="true">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-night font-display text-sm text-mist">vs</span>
          </div>
          <SideCard {...sideProps('b', b)} />
        </motion.div>
      </AnimatePresence>

      <p className="shrink-0 pb-3 text-center text-xs text-mist/80">
        <kbd className="rounded border border-line px-1.5">1</kbd> and <kbd className="rounded border border-line px-1.5">2</kbd> play each side,{' '}
        <kbd className="rounded border border-line px-1.5">Space</kbd> pauses
      </p>

      <BracketDrawer state={state} open={bracketOpen} onClose={() => setBracketOpen(false)} />
    </div>
  )
}
