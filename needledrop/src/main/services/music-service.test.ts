import { describe, expect, it } from 'vitest'
import type { Album, AlbumDetail, ProviderId, Track } from '@shared/types'
import { trackIdFor } from '@shared/text'
import type { MusicProvider } from '../providers/types'
import { ProviderError } from '../providers/types'
import { pickBestMatch } from './match'
import { MusicService, mergeTracks } from './music-service'

function track(provider: ProviderId, nativeId: string, title: string, artist: string, url: string | null, extra: Partial<Track> = {}): Track {
  return {
    id: trackIdFor(artist, title),
    title,
    artist,
    album: 'Album',
    artworkUrl: null,
    releaseDate: null,
    durationMs: 200_000,
    providerIds: { [provider]: nativeId },
    sources: [{ provider, kind: 'preview', url, fetchedAt: 0 }],
    ...extra
  }
}

interface FakeOptions {
  id: ProviderId
  tracks?: Track[]
  lookup?: Record<string, Track | null>
  fail?: boolean
  top?: Track[]
  album?: AlbumDetail
}

function fake(o: FakeOptions): MusicProvider & { calls: string[] } {
  const calls: string[] = []
  const guard = () => {
    if (o.fail) throw new ProviderError('network', `Can't reach ${o.id}`, o.id)
  }
  return {
    id: o.id,
    label: o.id,
    calls,
    async searchTracks(q) {
      calls.push(`search:${q}`)
      guard()
      return o.tracks ?? []
    },
    async searchAlbums() {
      guard()
      return [] as Album[]
    },
    async getTrack(id) {
      calls.push(`get:${id}`)
      guard()
      return o.lookup?.[id] ?? null
    },
    async getAlbum() {
      guard()
      if (!o.album) throw new ProviderError('not_found', 'none', o.id)
      return o.album
    },
    ...(o.id === 'deezer'
      ? {
          async searchArtists() {
            guard()
            return []
          },
          async getArtistTopTracks() {
            guard()
            return o.top ?? []
          },
          async getChartTracks() {
            guard()
            return o.tracks ?? []
          }
        }
      : {})
  }
}

describe('mergeTracks', () => {
  it('combines the same song from two providers into one track with both sources', () => {
    const dz = track('deezer', '1', 'Get Lucky', 'Daft Punk', 'https://dz/1.mp3', { artworkUrl: 'dz.jpg' })
    const it = track('itunes', '9', 'Get Lucky (feat. Pharrell Williams)', 'Daft Punk', 'https://it/9.m4a', { releaseDate: '2013-04-19' })
    const [merged, ...rest] = mergeTracks([[dz], [it]])
    expect(rest).toHaveLength(0)
    expect(merged!.providerIds).toEqual({ deezer: '1', itunes: '9' })
    expect(merged!.sources.map((s) => s.provider)).toEqual(['deezer', 'itunes'])
    expect(merged!.releaseDate).toBe('2013-04-19')
    expect(merged!.artworkUrl).toBe('dz.jpg')
  })

  it('does not mutate its inputs', () => {
    const dz = track('deezer', '1', 'A', 'B', 'u')
    const it = track('itunes', '2', 'A', 'B', 'v')
    mergeTracks([[dz], [it]])
    expect(dz.sources).toHaveLength(1)
  })
})

describe('pickBestMatch', () => {
  const target = track('deezer', '1', 'Blinding Lights', 'The Weeknd', null, { durationMs: 200_000 })

  it('ignores candidates without audio and wrong songs', () => {
    const noAudio = track('itunes', '1', 'Blinding Lights', 'The Weeknd', null)
    const wrongSong = track('itunes', '2', 'Starboy', 'The Weeknd', 'u')
    expect(pickBestMatch([noAudio, wrongSong], target)).toBeNull()
  })

  it('accepts exact and remaster-suffixed titles and prefers the closest duration', () => {
    const far = track('itunes', '3', 'Blinding Lights', 'The Weeknd', 'far', { durationMs: 230_000 })
    const near = track('itunes', '4', 'Blinding Lights - Remastered', 'The Weeknd', 'near', { durationMs: 201_000 })
    expect(pickBestMatch([far, near], target)?.sources[0]?.url).toBe('near')
  })

  it('refuses a partial title match when the length is very different', () => {
    const t = track('deezer', '1', 'Love', 'Artist', null, { durationMs: 180_000 })
    const other = track('itunes', '2', 'Love Story', 'Artist', 'u', { durationMs: 300_000 })
    expect(pickBestMatch([other], t)).toBeNull()
  })
})

describe('MusicService', () => {
  it('merges results from both providers and tolerates one failing', async () => {
    const dz = fake({ id: 'deezer', tracks: [track('deezer', '1', 'A', 'X', 'u1')] })
    const it = fake({ id: 'itunes', fail: true })
    const svc = new MusicService([dz, it])
    expect(await svc.searchTracks('a')).toHaveLength(1)
  })

  it('throws a friendly error when every provider fails', async () => {
    const svc = new MusicService([fake({ id: 'deezer', fail: true }), fake({ id: 'itunes', fail: true })])
    await expect(svc.searchTracks('a')).rejects.toThrow(/Can't reach/)
  })

  it('caches identical searches', async () => {
    const dz = fake({ id: 'deezer', tracks: [track('deezer', '1', 'A', 'X', 'u')] })
    const svc = new MusicService([dz])
    await svc.searchTracks('same')
    await svc.searchTracks('Same ')
    expect(dz.calls.filter((c) => c.startsWith('search:'))).toHaveLength(1)
  })

  it('respects disabled providers', async () => {
    const dz = fake({ id: 'deezer', tracks: [track('deezer', '1', 'A', 'X', 'u')] })
    const it = fake({ id: 'itunes', tracks: [track('itunes', '2', 'B', 'Y', 'v')] })
    const svc = new MusicService([dz, it])
    svc.configure({ providers: { deezer: false, itunes: true }, itunesCountry: 'US' })
    const res = await svc.searchTracks('q')
    expect(res.map((t) => t.title)).toEqual(['B'])
    await expect(svc.artistTopTracks('deezer:1')).rejects.toMatchObject({ code: 'disabled' })
  })

  it('never lets the user disable every provider', () => {
    const svc = new MusicService([fake({ id: 'deezer' }), fake({ id: 'itunes' })])
    svc.configure({ providers: { deezer: false, itunes: false }, itunesCountry: 'US' })
    return expect(svc.searchTracks('a')).resolves.toBeDefined()
  })

  describe('resolvePlayback', () => {
    it('refreshes the known provider and falls back to another by artist+title search', async () => {
      const stale = track('deezer', '1', 'Blinding Lights', 'The Weeknd', 'https://old')
      const dz = fake({ id: 'deezer', lookup: { '1': track('deezer', '1', 'Blinding Lights', 'The Weeknd', null) } })
      const it = fake({ id: 'itunes', tracks: [track('itunes', '7', 'Blinding Lights', 'The Weeknd', 'https://it/7.m4a')] })
      const sources = await new MusicService([dz, it]).resolvePlayback(stale)
      expect(sources.map((s) => s.url)).toEqual(['https://it/7.m4a'])
      expect(dz.calls).toContain('get:1')
      expect(it.calls[0]).toBe('search:The Weeknd Blinding Lights')
    })

    it('returns fresh URLs in provider order and survives provider outages', async () => {
      const t = track('deezer', '1', 'S', 'A', 'old')
      t.providerIds.itunes = '2'
      const dz = fake({ id: 'deezer', lookup: { '1': track('deezer', '1', 'S', 'A', 'https://fresh') } })
      const it = fake({ id: 'itunes', fail: true })
      const sources = await new MusicService([dz, it]).resolvePlayback(t)
      expect(sources.map((s) => s.url)).toEqual(['https://fresh'])
    })

    it('returns nothing when no provider has audio', async () => {
      const t = track('deezer', '1', 'S', 'A', null)
      const dz = fake({ id: 'deezer', lookup: { '1': t } })
      const it = fake({ id: 'itunes', tracks: [] })
      expect(await new MusicService([dz, it]).resolvePlayback(t)).toEqual([])
    })
  })

  it('picks the most popular playable album track as the album representative', async () => {
    const tracks = [
      track('deezer', '1', 'Deep cut', 'A', 'u1', { deezerRank: 10 }),
      track('deezer', '2', 'Hit', 'A', 'u2', { deezerRank: 900 }),
      track('deezer', '3', 'Bigger hit, no audio', 'A', null, { deezerRank: 999 })
    ]
    const album: Album = { id: 'deezer:5', title: 'Alb', artist: 'A', artworkUrl: null, releaseDate: null, providerIds: { deezer: '5' } }
    const svc = new MusicService([fake({ id: 'deezer', album: { album, tracks } })])
    expect((await svc.representativeTrack({ kind: 'album', id: 'deezer:5' }))?.title).toBe('Hit')
  })

  it('returns null when an artist has no playable top track', async () => {
    const svc = new MusicService([fake({ id: 'deezer', top: [track('deezer', '1', 'S', 'A', null)] })])
    expect(await svc.representativeTrack({ kind: 'artist', id: 'deezer:1' })).toBeNull()
  })
})
