import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Album, Artist, Track } from '@shared/types'
import type { SetupKind } from '@shared/engine/contestants'
import { randomSeed } from '@shared/engine/rng'
import { createTournament, forfeit, pick, reshuffle, restart, stats, type Contestant, type TournamentState } from '@shared/engine/tournament'
import { useHistory } from './history'

export type Screen = 'setup' | 'stage' | 'results'

export interface Draft {
  kind: SetupKind
  size: number | 'all'
  songs: Track[]
  artists: Artist[]
  albums: Album[]
}

interface TournamentStore {
  screen: Screen
  state: TournamentState | null
  notice: string | null
  draft: Draft
  setDraft: (patch: Partial<Draft>) => void
  start: (contestants: Contestant[], notice?: string | null) => void
  choose: (contestantId: string) => void
  skip: (contestantId: string) => void
  dismissNotice: () => void
  playAgainSame: () => void
  playAgainShuffled: () => void
  leave: () => void
}

const EMPTY_DRAFT: Draft = { kind: 'songs', size: 'all', songs: [], artists: [], albums: [] }

function recordFinished(s: TournamentState): void {
  if (!s.champion) return
  const st = stats(s)
  const face = (id: string) => {
    const c = s.contestants[id] as Contestant
    return { title: c.title, subtitle: c.subtitle, imageUrl: c.imageUrl }
  }
  const runnerUp = st.standings[1]
  useHistory.getState().add({
    id: `${s.seed}-${s.createdAt}`,
    finishedAt: s.finishedAt ?? Date.now(),
    contestants: st.contestants,
    kind: (s.contestants[s.champion] as Contestant).kind,
    champion: face(s.champion),
    runnerUp: runnerUp ? face(runnerUp) : null,
    durationMs: st.durationMs
  })
}

function advance(next: TournamentState): Pick<TournamentStore, 'state' | 'screen'> {
  if (next.champion) recordFinished(next)
  return { state: next, screen: next.champion ? 'results' : 'stage' }
}

export const useTournament = create<TournamentStore>()(
  persist(
    (set, get) => ({
      screen: 'setup',
      state: null,
      notice: null,
      draft: EMPTY_DRAFT,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      start: (contestants, notice = null) => set({ state: createTournament(contestants, randomSeed()), screen: 'stage', notice }),
      choose: (id) => {
        const { state } = get()
        if (state) set(advance(pick(state, id)))
      },
      skip: (id) => {
        const { state } = get()
        if (state) set(advance(forfeit(state, id)))
      },
      dismissNotice: () => set({ notice: null }),
      playAgainSame: () => {
        const { state } = get()
        if (state) set({ state: restart(state), screen: 'stage', notice: null })
      },
      playAgainShuffled: () => {
        const { state } = get()
        if (state) set({ state: reshuffle(state, randomSeed()), screen: 'stage', notice: null })
      },
      leave: () => set({ state: null, screen: 'setup', notice: null })
    }),
    {
      name: 'needledrop.tournament.v1',
      partialize: (s) => ({ screen: s.screen, state: s.state, draft: s.draft }),
      merge: (persisted, current) => {
        const p = persisted as Partial<TournamentStore> | undefined
        const usable = p?.state && p.screen && p.screen !== 'setup'
        return { ...current, ...p, screen: usable ? (p.screen as Screen) : 'setup', state: usable ? (p.state as TournamentState) : null }
      }
    }
  )
)
