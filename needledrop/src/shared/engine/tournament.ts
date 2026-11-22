import type { Track } from '../types'
import { createRng, shuffle } from './rng'

/**
 * Single-elimination bracket engine. Pure and immutable: every transition
 * returns a new state, so it can run in the renderer today and inside a
 * server-authoritative function for multiplayer later.
 */

export type ContestantKind = 'track' | 'artist' | 'album'

export interface Contestant {
  id: string
  kind: ContestantKind
  title: string
  subtitle: string
  imageUrl: string | null
  /** The track played for this contestant (the song itself, or an artist's/album's representative track). */
  track: Track
}

export interface Match {
  id: string
  round: number
  index: number
  a: string | null
  b: string | null
  winner: string | null
  decidedBy: 'pick' | 'bye' | 'forfeit' | null
}

export interface Decision {
  matchId: string
  round: number
  winner: string
  loser: string
  kind: 'pick' | 'forfeit'
  at: number
}

export interface TournamentState {
  seed: string
  inputOrder: string[]
  contestants: Record<string, Contestant>
  rounds: Match[][]
  cursor: { round: number; index: number } | null
  champion: string | null
  log: Decision[]
  createdAt: number
  finishedAt: number | null
}

export interface TournamentStats {
  contestants: number
  matchesTotal: number
  matchesPlayed: number
  forfeits: number
  durationMs: number | null
  wins: Record<string, number>
  /** Contestant ids, best first: champion, runner-up, then by furthest round reached and wins. */
  standings: string[]
}

export const MIN_CONTESTANTS = 2
export const MAX_CONTESTANTS = 64

export function bracketSize(n: number): number {
  let size = 2
  while (size < n) size *= 2
  return size
}

export function roundName(round: number, totalRounds: number): string {
  const remaining = totalRounds - round
  if (remaining === 1) return 'Final'
  if (remaining === 2) return 'Semifinals'
  if (remaining === 3) return 'Quarterfinals'
  return `Round of ${2 ** remaining}`
}

export function createTournament(list: readonly Contestant[], seed: string, now: number = Date.now()): TournamentState {
  if (list.length < MIN_CONTESTANTS) throw new Error(`A tournament needs at least ${MIN_CONTESTANTS} contestants`)
  if (list.length > MAX_CONTESTANTS) throw new Error(`A tournament supports at most ${MAX_CONTESTANTS} contestants`)
  const unique = new Set(list.map((c) => c.id))
  if (unique.size !== list.length) throw new Error('Contestants must be unique')

  const rng = createRng(seed)
  const order = shuffle(
    list.map((c) => c.id),
    rng
  )
  const size = bracketSize(list.length)
  const byes = size - list.length
  const firstRoundCount = size / 2

  // Byes go to distinct first-round matches: size = nextPow2(n) guarantees byes < firstRoundCount.
  const pairs: Array<[string, string | null]> = []
  let cursor = 0
  for (let i = 0; i < firstRoundCount; i++) {
    const a = order[cursor++] as string
    const b = i < byes ? null : (order[cursor++] as string)
    pairs.push([a, b])
  }
  const shuffledPairs = shuffle(pairs, rng)

  const rounds: Match[][] = []
  rounds.push(
    shuffledPairs.map(([a, b], index) => ({
      id: `r0-m${index}`,
      round: 0,
      index,
      a,
      b,
      winner: null,
      decidedBy: null
    }))
  )
  for (let count = firstRoundCount / 2, round = 1; count >= 1; count /= 2, round++) {
    rounds.push(
      Array.from({ length: count }, (_, index) => ({
        id: `r${round}-m${index}`,
        round,
        index,
        a: null,
        b: null,
        winner: null,
        decidedBy: null
      }))
    )
  }

  const state: TournamentState = {
    seed,
    inputOrder: list.map((c) => c.id),
    contestants: Object.fromEntries(list.map((c) => [c.id, c])),
    rounds,
    cursor: null,
    champion: null,
    log: [],
    createdAt: now,
    finishedAt: null
  }

  for (const match of rounds[0] as Match[]) {
    if (match.b === null) {
      match.winner = match.a
      match.decidedBy = 'bye'
      advanceWinner(rounds, match)
    }
  }
  settle(state, now)
  return state
}

function advanceWinner(rounds: Match[][], match: Match): void {
  const next = rounds[match.round + 1]?.[match.index >> 1]
  if (!next || match.winner === null) return
  if (match.index % 2 === 0) next.a = match.winner
  else next.b = match.winner
}

function settle(state: TournamentState, now: number): void {
  for (const round of state.rounds) {
    for (const match of round) {
      if (match.a !== null && match.b !== null && match.winner === null) {
        state.cursor = { round: match.round, index: match.index }
        return
      }
    }
  }
  state.cursor = null
  const final = state.rounds[state.rounds.length - 1]?.[0]
  if (final?.winner) {
    state.champion = final.winner
    state.finishedAt = state.finishedAt ?? now
  }
}

export function totalRounds(state: TournamentState): number {
  return state.rounds.length
}

export function currentMatch(state: TournamentState): Match | null {
  if (!state.cursor) return null
  return state.rounds[state.cursor.round]?.[state.cursor.index] ?? null
}

function cloneState(state: TournamentState): TournamentState {
  return { ...state, rounds: state.rounds.map((r) => r.map((m) => ({ ...m }))), log: state.log.slice() }
}

function decide(state: TournamentState, winnerId: string, kind: 'pick' | 'forfeit', now: number): TournamentState {
  const current = currentMatch(state)
  if (!current) throw new Error('The tournament is already finished')
  if (winnerId !== current.a && winnerId !== current.b) throw new Error('Winner is not part of the current match')
  const loser = winnerId === current.a ? current.b : current.a
  if (loser === null) throw new Error('Match has no opponent')

  const next = cloneState(state)
  const match = next.rounds[current.round]?.[current.index] as Match
  match.winner = winnerId
  match.decidedBy = kind
  next.log.push({ matchId: match.id, round: match.round, winner: winnerId, loser, kind, at: now })
  advanceWinner(next.rounds, match)
  settle(next, now)
  return next
}

export function pick(state: TournamentState, winnerId: string, now: number = Date.now()): TournamentState {
  return decide(state, winnerId, 'pick', now)
}

/** The opponent advances because this contestant cannot be played (for example, no audio). */
export function forfeit(state: TournamentState, unavailableId: string, now: number = Date.now()): TournamentState {
  const current = currentMatch(state)
  if (!current) throw new Error('The tournament is already finished')
  if (unavailableId !== current.a && unavailableId !== current.b) throw new Error('Contestant is not part of the current match')
  const winner = unavailableId === current.a ? current.b : current.a
  if (winner === null) throw new Error('Match has no opponent')
  return decide(state, winner, 'forfeit', now)
}

export function progress(state: TournamentState): { played: number; total: number } {
  return { played: state.log.length, total: Object.keys(state.contestants).length - 1 }
}

/** Same contestants and seed: replays the identical bracket. */
export function restart(state: TournamentState, now: number = Date.now()): TournamentState {
  return createTournament(
    state.inputOrder.map((id) => state.contestants[id] as Contestant),
    state.seed,
    now
  )
}

/** Same contestants, new random bracket. */
export function reshuffle(state: TournamentState, seed: string, now: number = Date.now()): TournamentState {
  return createTournament(
    state.inputOrder.map((id) => state.contestants[id] as Contestant),
    seed,
    now
  )
}

export function stats(state: TournamentState): TournamentStats {
  const wins: Record<string, number> = {}
  for (const d of state.log) wins[d.winner] = (wins[d.winner] ?? 0) + 1

  const reached: Record<string, number> = {}
  for (const round of state.rounds) {
    for (const m of round) {
      for (const id of [m.a, m.b]) {
        if (id !== null) reached[id] = Math.max(reached[id] ?? 0, m.round)
      }
    }
  }
  const orderIndex = new Map(state.inputOrder.map((id, i) => [id, i]))
  const standings = state.inputOrder.slice().sort((x, y) => {
    if (x === state.champion) return -1
    if (y === state.champion) return 1
    return (
      (reached[y] ?? 0) - (reached[x] ?? 0) ||
      (wins[y] ?? 0) - (wins[x] ?? 0) ||
      (orderIndex.get(x) ?? 0) - (orderIndex.get(y) ?? 0)
    )
  })

  return {
    contestants: state.inputOrder.length,
    matchesTotal: state.inputOrder.length - 1,
    matchesPlayed: state.log.length,
    forfeits: state.log.filter((d) => d.kind === 'forfeit').length,
    durationMs: state.finishedAt === null ? null : state.finishedAt - state.createdAt,
    wins,
    standings
  }
}
