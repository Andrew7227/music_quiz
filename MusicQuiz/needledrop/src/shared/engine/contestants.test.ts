import { describe, expect, it, vi } from 'vitest'
import type { Album, Artist, Track } from '../types'
import { buildContestants, mapLimit, type SetupInput } from './contestants'
import { createRng } from './rng'

const track = (n: number, playable = true): Track => ({
  id: `t${n}`,
  title: `Song ${n}`,
  artist: `Artist ${n % 3}`,
  album: 'A',
  artworkUrl: null,
  releaseDate: null,
  durationMs: 1000,
  providerIds: {},
  sources: [{ provider: 'deezer', kind: 'preview', url: playable ? `https://p/${n}.mp3` : null, fetchedAt: 0 }]
})
const artist = (n: number): Artist => ({ id: `deezer:${n}`, name: `Artist ${n}`, imageUrl: null, providerIds: {} })
const album = (n: number): Album => ({ id: `deezer:${n}`, title: `Album ${n}`, artist: 'X', artworkUrl: null, releaseDate: null, providerIds: {} })
const base: SetupInput = { kind: 'songs', size: 'all', songs: [], artists: [], albums: [] }

const music = (over: Partial<Parameters<typeof buildContestants>[1]> = {}) => ({
  artistTopTracks: vi.fn(async (id: string) => Array.from({ length: 5 }, (_, i) => track(Number(id.split(':')[1]) * 100 + i))),
  albumTracks: vi.fn(async (id: string) => ({ album: album(1), tracks: [track(Number(id.split(':')[1]) * 10), track(Number(id.split(':')[1]) * 10 + 1)] })),
  chartTracks: vi.fn(async () => Array.from({ length: 40 }, (_, i) => track(i))),
  representativeTrack: vi.fn(async (t: { id: string }) => (t.id === 'deezer:3' ? null : track(Number(t.id.split(':')[1])))),
  ...over
})

describe('buildContestants', () => {
  it('uses all picked songs, dropping duplicates and songs without a preview', async () => {
    const songs = [track(1), track(2), track(2), track(3, false), track(4)]
    const res = await buildContestants({ ...base, songs }, music(), createRng('a'))
    expect(res.contestants.map((c) => c.id).sort()).toEqual(['t1', 't2', 't4'])
    expect(res.notice).toMatch(/no preview/)
  })

  it('samples down to the requested size from a large pool', async () => {
    const res = await buildContestants({ ...base, kind: 'chart', size: 16 }, music(), createRng('b'))
    expect(res.contestants).toHaveLength(16)
    expect(new Set(res.contestants.map((c) => c.id)).size).toBe(16)
  })

  it('shrinks the bracket and says so when the pool is smaller than requested', async () => {
    const res = await buildContestants({ ...base, kind: 'artist-hits', size: 32, artists: [artist(1), artist(2)] }, music(), createRng('c'))
    expect(res.contestants).toHaveLength(10)
    expect(res.notice).toMatch(/Only 10/)
  })

  it('collects every track of the picked albums', async () => {
    const res = await buildContestants({ ...base, kind: 'album-tracks', albums: [album(1), album(2)] }, music(), createRng('d'))
    expect(res.contestants).toHaveLength(4)
  })

  it('builds artist head-to-head contestants and leaves out artists with nothing playable', async () => {
    const res = await buildContestants({ ...base, kind: 'artists', artists: [artist(1), artist(2), artist(3)] }, music(), createRng('e'))
    expect(res.contestants.map((c) => c.kind)).toEqual(['artist', 'artist'])
    expect(res.contestants[0]!.subtitle).toContain('Plays')
    expect(res.notice).toMatch(/left out/)
  })

  it('caps at 64 contestants', async () => {
    const songs = Array.from({ length: 100 }, (_, i) => track(i))
    expect((await buildContestants({ ...base, songs }, music(), createRng('f'))).contestants).toHaveLength(64)
  })

  it('refuses to build a bracket from fewer than two playable songs', async () => {
    await expect(buildContestants({ ...base, songs: [track(1), track(2, false)] }, music(), createRng('g'))).rejects.toThrow(/Not enough/)
  })

  it('reports progress', async () => {
    const onProgress = vi.fn()
    await buildContestants({ ...base, kind: 'artist-hits', artists: [artist(1), artist(2)] }, music(), createRng('h'), onProgress)
    expect(onProgress).toHaveBeenCalledWith('Collecting hits (2 of 2)')
  })
})

describe('mapLimit', () => {
  it('keeps order and respects the concurrency limit', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      peak = Math.max(peak, ++running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12])
    expect(peak).toBeLessThanOrEqual(2)
  })
})
