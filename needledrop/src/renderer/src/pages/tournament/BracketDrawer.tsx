import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { currentMatch, roundName, totalRounds, type Match, type TournamentState } from '@shared/engine/tournament'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'

interface Props {
  state: TournamentState
  open: boolean
  onClose: () => void
}

function Row({ id, match, state }: { id: string | null; match: Match; state: TournamentState }) {
  if (id === null) {
    return <div className="px-2 py-1.5 text-xs text-mist/50">{match.decidedBy === 'bye' ? 'Bye' : 'To be decided'}</div>
  }
  const c = state.contestants[id]
  const won = match.winner === id
  const lost = match.winner !== null && !won
  return (
    <div className={`flex items-center gap-2 border-l-2 px-2 py-1.5 text-xs ${won ? 'border-marigold text-bone' : 'border-transparent'} ${lost ? 'text-mist/50' : 'text-bone'}`}>
      <Artwork src={c?.imageUrl} seed={c?.title ?? id} className="size-6 shrink-0" />
      <span className={`truncate ${won ? 'font-semibold' : ''}`}>{c?.title ?? id}</span>
    </div>
  )
}

function BracketTab({ state }: { state: TournamentState }) {
  const rounds = totalRounds(state)
  const current = currentMatch(state)
  return (
    <div className="flex min-h-full gap-6 p-6">
      {state.rounds.map((round, r) => (
        <div key={r} className="flex w-52 shrink-0 flex-col">
          <h3 className="mb-3 text-sm font-semibold text-mist">{roundName(r, rounds)}</h3>
          <div className="flex flex-1 flex-col justify-around gap-3">
            {round.map((m) => {
              const isCurrent = current?.id === m.id
              return (
                <div key={m.id} className={`overflow-hidden rounded-lg border bg-plum ${isCurrent ? 'border-marigold' : 'border-line'}`}>
                  <Row id={m.a} match={m} state={state} />
                  <div className="h-px bg-line" />
                  <Row id={m.b} match={m} state={state} />
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function HistoryTab({ state }: { state: TournamentState }) {
  const rounds = totalRounds(state)
  if (state.log.length === 0) return <p className="p-6 text-sm text-mist">No matches decided yet.</p>
  return (
    <ol className="space-y-2 p-6">
      {state.log
        .slice()
        .reverse()
        .map((d) => (
          <li key={d.matchId} className="rounded-lg border border-line bg-plum px-4 py-3 text-sm">
            <span className="text-mist">{roundName(d.round, rounds)}: </span>
            <span className="font-semibold text-bone">{state.contestants[d.winner]?.title}</span>
            <span className="text-mist"> beat </span>
            <span className="text-bone">{state.contestants[d.loser]?.title}</span>
            {d.kind === 'forfeit' && <span className="ml-2 text-rose">skipped, no audio</span>}
          </li>
        ))}
    </ol>
  )
}

export function BracketDrawer({ state, open, onClose }: Props) {
  const [tab, setTab] = useState<'bracket' | 'history'>('bracket')
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Portal to <body> so the drawer sits above the player bar, not just above the page.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-night/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Bracket and match history"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(980px,92vw)] flex-col border-l border-line bg-night pt-9"
            initial={{ x: reduce ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: reduce ? 0 : '100%' }}
            transition={{ duration: reduce ? 0 : 0.28, ease: [0.22, 0.9, 0.28, 1] }}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-3">
              <div role="tablist" className="flex gap-1">
                {(['bracket', 'history'] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    type="button"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`rounded-full px-4 py-1.5 text-sm transition ${tab === t ? 'bg-plum-hi text-bone' : 'text-mist hover:text-bone'}`}
                  >
                    {t === 'bracket' ? 'Bracket' : 'Match history'}
                  </button>
                ))}
              </div>
              <button type="button" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-mist transition hover:bg-plum-hi hover:text-bone">
                <Icon name="close" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">{tab === 'bracket' ? <BracketTab state={state} /> : <HistoryTab state={state} />}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
