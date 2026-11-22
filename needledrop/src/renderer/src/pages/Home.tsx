import { useState } from 'react'
import { buildContestants } from '@shared/engine/contestants'
import { createRng, randomSeed } from '@shared/engine/rng'
import { currentMatch, progress, roundName, totalRounds } from '@shared/engine/tournament'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'
import { btnGhost, btnPrimary, Notice, Page, Spinner } from '@/components/ui'
import { formatDay, plural } from '@/lib/format'
import { useNav } from '@/lib/nav'
import { useHistory } from '@/stores/history'
import { useTournament } from '@/stores/tournament'

export function Home() {
  const go = useNav((s) => s.go)
  const records = useHistory((s) => s.records)
  const active = useTournament((s) => (s.screen === 'stage' ? s.state : null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const quickStart = async () => {
    setBusy(true)
    setError(null)
    try {
      const { contestants, notice } = await buildContestants(
        { kind: 'chart', size: 16, songs: [], artists: [], albums: [] },
        window.api.music,
        createRng(randomSeed())
      )
      useTournament.getState().start(contestants, notice)
      go('tournament')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the charts.')
    } finally {
      setBusy(false)
    }
  }

  const match = active ? currentMatch(active) : null
  const prog = active ? progress(active) : null

  return (
    <Page>
      <section className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-14 pt-6">
        <div>
          <h1 className="font-display text-6xl leading-[1.02] font-semibold tracking-tight">Which song wins?</h1>
          <p className="mt-5 max-w-md text-lg text-mist">
            Put songs, artists or albums head to head. Listen to a 30-second preview of each, pick one, and keep going until a single winner is left.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className={btnPrimary} onClick={() => go('tournament')}>
              <Icon name="trophy" className="size-4" /> Start a tournament
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void quickStart()}>
              {busy ? <Spinner /> : <Icon name="play" className="size-4" />} Quick 16 from today’s charts
            </button>
          </div>
          {error && (
            <div className="mt-4 max-w-md">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {active && match && prog && (
            <div className="rounded-2xl border border-marigold/50 bg-plum p-5">
              <p className="font-display text-lg">Tournament in progress</p>
              <p className="mt-1 text-sm text-mist">
                {roundName(match.round, totalRounds(active))}, {prog.played} of {prog.total} matches decided.
              </p>
              <button type="button" className={`${btnPrimary} mt-4`} onClick={() => go('tournament')}>
                Continue
              </button>
            </div>
          )}

          <div>
            <h2 className="font-display text-2xl font-semibold">Your champions</h2>
            {records.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-line px-5 py-8 text-sm text-mist">Finish a tournament and the winner will show up here.</p>
            ) : (
              <ul className="mt-3 space-y-1">
                {records.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-center gap-4 rounded-xl px-2 py-2 hover:bg-plum-hi/60">
                    <Artwork src={r.champion.imageUrl} seed={r.champion.title} className="size-14 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.champion.title}</p>
                      <p className="truncate text-xs text-mist">
                        {r.champion.subtitle}. Won a bracket of {r.contestants}
                        {r.runnerUp ? `, ahead of ${r.runnerUp.title}` : ''}.
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-mist">{formatDay(r.finishedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {records.length > 5 && <p className="mt-2 text-xs text-mist">{plural(records.length - 5, 'older tournament')} not shown.</p>}
          </div>
        </div>
      </section>
    </Page>
  )
}
