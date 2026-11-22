import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { createRng, sample, shuffle } from './rng'
import {
  bracketSize,
  createTournament,
  currentMatch,
  forfeit,
  pick,
  progress,
  reshuffle,
  restart,
  roundName,
  stats,
  type Contestant,
  type TournamentState
} from './tournament'

function contestant(i: number): Contestant {
  const track: Track = {
    id: `trk_${i}`,
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    album: 'Album',
    artworkUrl: null,
    releaseDate: null,
    durationMs: 30000,
    providerIds: {},
    sources: []
  }
  return { id: `c${i}`, kind: 'track', title: track.title, subtitle: track.artist, imageUrl: null, track }
}

const make = (n: number) => Array.from({ length: n }, (_, i) => contestant(i))

/** Plays a whole tournament; the contestant with the lowest number always wins. */
function playOut(state: TournamentState, chooser: (a: string, b: string) => string = (a, b) => (a < b ? a : b)): TournamentState {
  let s = state
  let guard = 0
  while (currentMatch(s)) {
    const m = currentMatch(s)!
    s = pick(s, chooser(m.a!, m.b!), 1000 + guard)
    if (++guard > 1000) throw new Error('runaway')
  }
  return s
}

describe('rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = Array.from({ length: 5 }, createRng('x'))
    const b = Array.from({ length: 5 }, createRng('x'))
    const c = Array.from({ length: 5 }, createRng('y'))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
  })

  it('shuffle keeps all items and sample respects n', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(items, createRng('s')).sort()).toEqual(items)
    expect(sample(items, 3, createRng('s'))).toHaveLength(3)
    expect(sample(items, 99, createRng('s'))).toHaveLength(8)
  })
})

describe('bracket helpers', () => {
  it('rounds up to a power of two', () => {
    expect([2, 3, 4, 5, 8, 9, 16, 33, 64].map(bracketSize)).toEqual([2, 4, 4, 8, 8, 16, 16, 64, 64])
  })

  it('names rounds from the final backwards', () => {
    expect(roundName(0, 1)).toBe('Final')
    expect(roundName(2, 3)).toBe('Final')
    expect(roundName(1, 3)).toBe('Semifinals')
    expect(roundName(0, 3)).toBe('Quarterfinals')
    expect(roundName(0, 5)).toBe('Round of 32')
  })
})

describe('createTournament', () => {
  it('rejects bad input', () => {
    expect(() => createTournament(make(1), 's')).toThrow()
    expect(() => createTournament(make(65), 's')).toThrow()
    expect(() => createTournament([contestant(1), contestant(1)], 's')).toThrow()
  })

  it.each([2, 3, 4, 5, 7, 8, 9, 15, 16, 17, 31, 32, 33, 50, 63, 64])('plays %i contestants to exactly one champion', (n) => {
    const start = createTournament(make(n), `seed-${n}`, 0)
    expect(progress(start).total).toBe(n - 1)
    const end = playOut(start)
    expect(end.champion).toBe('c0')
    expect(end.cursor).toBeNull()
    expect(end.log).toHaveLength(n - 1)
    expect(end.finishedAt).not.toBeNull()
  })

  it('never pairs a contestant against themselves and uses each contestant once per round', () => {
    for (const n of [5, 12, 33, 64]) {
      const s = createTournament(make(n), `u-${n}`)
      const firstRound = s.rounds[0]!.flatMap((m) => [m.a, m.b]).filter((x): x is string => x !== null)
      expect(new Set(firstRound).size).toBe(n)
      for (const m of s.rounds[0]!) expect(m.a).not.toBe(m.b)
    }
  })

  it('gives byes to distinct matches and resolves them immediately', () => {
    const s = createTournament(make(5), 'byes') // bracket of 8 → 3 byes over 4 matches
    const byeMatches = s.rounds[0]!.filter((m) => m.decidedBy === 'bye')
    expect(byeMatches).toHaveLength(3)
    expect(s.rounds[0]!.filter((m) => m.b === null)).toHaveLength(3)
    expect(s.log).toHaveLength(0)
    expect(currentMatch(s)).not.toBeNull()
  })

  it('is deterministic for a seed and restart replays the same bracket', () => {
    const a = createTournament(make(16), 'same', 0)
    const b = createTournament(make(16), 'same', 0)
    expect(a.rounds).toEqual(b.rounds)
    const played = playOut(a)
    expect(restart(played, 0).rounds).toEqual(a.rounds)
    expect(reshuffle(played, 'different', 0).rounds).not.toEqual(a.rounds)
  })

  it('shows a different bracket for different seeds', () => {
    const a = createTournament(make(32), 'one').rounds[0]!.map((m) => m.a)
    const b = createTournament(make(32), 'two').rounds[0]!.map((m) => m.a)
    expect(a).not.toEqual(b)
  })
})

describe('transitions', () => {
  it('does not mutate the previous state', () => {
    const s0 = createTournament(make(8), 'imm')
    const frozen = JSON.stringify(s0)
    const m = currentMatch(s0)!
    pick(s0, m.a!)
    expect(JSON.stringify(s0)).toBe(frozen)
  })

  it('advances winners into the right next-round slot', () => {
    let s = createTournament(make(4), 'slots')
    const first = currentMatch(s)!
    s = pick(s, first.a!)
    const final = s.rounds[1]![0]!
    expect(final.a).toBe(first.a)
    const second = currentMatch(s)!
    s = pick(s, second.b!)
    expect(s.rounds[1]![0]!.b).toBe(second.b)
    expect(currentMatch(s)!.round).toBe(1)
  })

  it('rejects invalid picks and picks after the end', () => {
    const s = createTournament(make(2), 'bad')
    expect(() => pick(s, 'nope')).toThrow()
    const done = pick(s, currentMatch(s)!.a!)
    expect(() => pick(done, 'c0')).toThrow()
  })

  it('forfeit advances the opponent and is counted separately', () => {
    let s = createTournament(make(4), 'ff')
    const m = currentMatch(s)!
    s = forfeit(s, m.a!)
    expect(s.rounds[m.round]![m.index]!.winner).toBe(m.b)
    expect(s.log[0]!.kind).toBe('forfeit')
    s = playOut(s)
    expect(stats(s).forfeits).toBe(1)
  })
})

describe('stats', () => {
  it('ranks champion first, runner-up second and counts wins', () => {
    const end = playOut(createTournament(make(8), 'stats', 0))
    const st = stats(end)
    expect(st.standings[0]).toBe('c0')
    expect(st.standings).toHaveLength(8)
    expect(new Set(st.standings).size).toBe(8)
    expect(st.matchesPlayed).toBe(7)
    expect(st.wins['c0']).toBe(3)
    const final = end.rounds[2]![0]!
    const runnerUp = final.a === 'c0' ? final.b : final.a
    expect(st.standings[1]).toBe(runnerUp)
    expect(st.durationMs).toBeGreaterThanOrEqual(0)
  })
})
