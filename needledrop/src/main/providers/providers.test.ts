import { describe, expect, it, vi } from 'vitest'
import { createJsonFetcher, SlidingWindowLimiter } from './http'
import { DeezerProvider, mapDeezerTrack } from './deezer'
import { ItunesProvider, mapItunesTrack } from './itunes'
import { ProviderError } from './types'

// Fixtures follow the documented response shapes of each API. They exercise our mapping
// code; they cannot prove the live APIs still match (see e2e + manual checks in the README).
const dzTrack = {
  id: 3135556,
  title: 'Harder, Better, Faster, Stronger',
  duration: 224,
  rank: 876543,
  explicit_lyrics: false,
  preview: 'https://cdnt-preview.dzcdn.net/api/1/1/a/b/c/3135556.mp3',
  artist: { id: 27, name: 'Daft Punk' },
  album: { id: 302127, title: 'Discovery', cover_big: 'https://cdn-images.dzcdn.net/images/cover/x/500x500-000000-80-0-0.jpg', release_date: '2001-03-07' }
}

const jsonFetcher = (payload: unknown) => async () => payload

describe('Deezer mapping', () => {
  it('maps a track with ids, artwork, duration and preview source', () => {
    const t = mapDeezerTrack(dzTrack, undefined, 123)!
    expect(t).toMatchObject({
      title: 'Harder, Better, Faster, Stronger',
      artist: 'Daft Punk',
      album: 'Discovery',
      artistId: 'deezer:27',
      albumId: 'deezer:302127',
      durationMs: 224000,
      releaseDate: '2001-03-07',
      deezerRank: 876543,
      providerIds: { deezer: '3135556' }
    })
    expect(t.id).toMatch(/^trk_/)
    expect(t.artworkUrl).toContain('500x500')
    expect(t.sources).toEqual([{ provider: 'deezer', kind: 'preview', url: dzTrack.preview, fetchedAt: 123 }])
  })

  it('records a missing preview as url null instead of pretending audio exists', () => {
    const t = mapDeezerTrack({ ...dzTrack, preview: '' })!
    expect(t.sources[0]!.url).toBeNull()
  })

  it('drops unusable entries and bogus release dates', () => {
    expect(mapDeezerTrack({ id: 1, title: 'x' })).toBeNull()
    expect(mapDeezerTrack({ ...dzTrack, release_date: '0000-00-00', album: { id: 1, title: 'A' } })!.releaseDate).toBeNull()
  })
})

describe('DeezerProvider', () => {
  it('searches tracks', async () => {
    const p = new DeezerProvider('https://x', jsonFetcher({ data: [dzTrack, { id: 9 }] }))
    const res = await p.searchTracks('daft punk', 5)
    expect(res).toHaveLength(1)
  })

  it('requests the expected URL', async () => {
    const http = vi.fn(async () => ({ data: [] }))
    await new DeezerProvider('https://x', http).searchTracks('a&b c', 7)
    expect(http).toHaveBeenCalledWith('https://x/search/track?q=a%26b%20c&limit=7')
  })

  it('maps quota and not-found errors', async () => {
    const quota = new DeezerProvider('https://x', jsonFetcher({ error: { code: 4, message: 'Quota limit exceeded' } }))
    await expect(quota.searchTracks('a', 5)).rejects.toMatchObject({ code: 'rate_limited' })
    const missing = new DeezerProvider('https://x', jsonFetcher({ error: { code: 800, message: 'no data' } }))
    expect(await missing.getTrack('1')).toBeNull()
  })

  it('lends album data to album tracks', async () => {
    const album = {
      id: 302127,
      title: 'Discovery',
      cover_big: 'https://img/cover.jpg',
      release_date: '2001-03-07',
      nb_tracks: 2,
      artist: { id: 27, name: 'Daft Punk' },
      tracks: { data: [{ id: 1, title: 'One More Time', duration: 320, rank: 5, preview: 'https://p/1.mp3' }, { id: 2, title: 'Aerodynamic', duration: 212, rank: 3, preview: '' }] }
    }
    const { album: a, tracks } = await new DeezerProvider('https://x', jsonFetcher(album)).getAlbum('302127')
    expect(a.title).toBe('Discovery')
    expect(tracks).toHaveLength(2)
    expect(tracks[0]).toMatchObject({ artist: 'Daft Punk', album: 'Discovery', artworkUrl: 'https://img/cover.jpg' })
    expect(tracks[1]!.sources[0]!.url).toBeNull()
  })
})

describe('iTunes mapping', () => {
  const raw = {
    wrapperType: 'track',
    kind: 'song',
    trackId: 697195787,
    artistId: 5468295,
    collectionId: 697195461,
    trackName: 'Get Lucky (feat. Pharrell Williams)',
    artistName: 'Daft Punk',
    collectionName: 'Random Access Memories',
    previewUrl: 'https://audio-ssl.itunes.apple.com/p.m4a',
    artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/Music/a/100x100bb.jpg',
    trackTimeMillis: 369000,
    releaseDate: '2013-04-19T07:00:00Z',
    trackExplicitness: 'notExplicit'
  }

  it('maps fields and upgrades artwork size', () => {
    const t = mapItunesTrack(raw, 5)!
    expect(t.artworkUrl).toContain('600x600bb')
    expect(t).toMatchObject({ releaseDate: '2013-04-19', durationMs: 369000, providerIds: { itunes: '697195787' }, explicit: false })
    expect(t.sources[0]).toEqual({ provider: 'itunes', kind: 'preview', url: raw.previewUrl, fetchedAt: 5 })
  })

  it('gives the same internal id as Deezer when only the feat. suffix differs', () => {
    const dz = mapDeezerTrack({ ...dzTrack, title: 'Get Lucky', artist: { id: 27, name: 'Daft Punk' } })!
    expect(mapItunesTrack(raw)!.id).toBe(dz.id)
  })

  it('sends the storefront country', async () => {
    const http = vi.fn(async () => ({ results: [raw] }))
    const p = new ItunesProvider('https://i', http)
    p.country = 'UA'
    await p.searchTracks('get lucky', 3)
    expect(http).toHaveBeenCalledWith('https://i/search?term=get%20lucky&media=music&entity=song&limit=3&country=UA')
  })

  it('reads album lookups', async () => {
    const results = [
      { wrapperType: 'collection', collectionId: 1, collectionName: 'Album', artistName: 'Band', artworkUrl100: 'https://a/100x100bb.jpg', trackCount: 1 },
      { ...raw, trackId: 5 }
    ]
    const { album, tracks } = await new ItunesProvider('https://i', jsonFetcher({ results })).getAlbum('1')
    expect(album.id).toBe('itunes:1')
    expect(tracks).toHaveLength(1)
  })
})

describe('http', () => {
  const res = (status: number, body: unknown = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as Response
  const opts = { provider: 'deezer' as const, label: 'Deezer', retryDelayMs: 1 }

  it('retries on 5xx and then succeeds', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200, { ok: 1 }))
    expect(await createJsonFetcher({ ...opts, fetchImpl })('https://x')).toEqual({ ok: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('reports persistent 429 as rate_limited and network failures as network', async () => {
    const limited = createJsonFetcher({ ...opts, fetchImpl: vi.fn().mockResolvedValue(res(429)) })
    await expect(limited('https://x')).rejects.toMatchObject({ code: 'rate_limited' })
    const down = createJsonFetcher({ ...opts, fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) })
    await expect(down('https://x')).rejects.toBeInstanceOf(ProviderError)
    await expect(down('https://x')).rejects.toMatchObject({ code: 'network' })
  })

  it('does not retry 4xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(404))
    await expect(createJsonFetcher({ ...opts, fetchImpl })('https://x')).rejects.toMatchObject({ code: 'unknown' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('limiter delays requests beyond the window budget', async () => {
    const limiter = new SlidingWindowLimiter(2, 60)
    const t0 = Date.now()
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    expect(Date.now() - t0).toBeGreaterThanOrEqual(55)
  })
})
