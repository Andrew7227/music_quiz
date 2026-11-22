import type { Album, AlbumDetail, Artist, Track } from '@shared/types'
import { providerKey } from '@shared/types'
import { trackIdFor } from '@shared/text'
import { createJsonFetcher, SlidingWindowLimiter } from './http'
import { ProviderError, type JsonFetcher, type MusicProvider } from './types'

/** Public Deezer API: no key needed. Documented limit is about 50 requests per 5 seconds. */
export const DEEZER_BASE = 'https://api.deezer.com'

interface DzArtist {
  id?: number
  name?: string
  picture_big?: string
  picture_xl?: string
  picture_medium?: string
  nb_fan?: number
}
interface DzAlbum {
  id?: number
  title?: string
  cover_big?: string
  cover_xl?: string
  cover_medium?: string
  md5_image?: string
  release_date?: string
  nb_tracks?: number
  artist?: DzArtist
  tracks?: { data?: DzTrack[] }
}
interface DzTrack {
  id?: number
  title?: string
  duration?: number
  rank?: number
  explicit_lyrics?: boolean
  preview?: string
  isrc?: string
  release_date?: string
  artist?: DzArtist
  album?: DzAlbum
}
interface DzList<T> {
  data?: T[]
  total?: number
}
interface DzError {
  error?: { type?: string; message?: string; code?: number }
}

function validDate(d: string | undefined): string | null {
  return d && /^\d{4}-\d{2}-\d{2}/.test(d) && !d.startsWith('0000') ? d.slice(0, 10) : null
}

function albumCover(a: DzAlbum | undefined): string | null {
  if (!a) return null
  if (a.cover_big) return a.cover_big
  if (a.cover_xl) return a.cover_xl
  if (a.cover_medium) return a.cover_medium
  if (a.md5_image) return `https://cdn-images.dzcdn.net/images/cover/${a.md5_image}/500x500-000000-80-0-0.jpg`
  return null
}

export function mapDeezerTrack(raw: DzTrack, fallbackAlbum?: DzAlbum, now: number = Date.now()): Track | null {
  if (raw.id === undefined || !raw.title || !raw.artist?.name) return null
  const album = raw.album?.title ? raw.album : fallbackAlbum
  const track: Track = {
    id: trackIdFor(raw.artist.name, raw.title),
    title: raw.title,
    artist: raw.artist.name,
    album: album?.title ?? '',
    artworkUrl: albumCover(album),
    releaseDate: validDate(raw.release_date) ?? validDate(album?.release_date),
    durationMs: Math.round((raw.duration ?? 0) * 1000),
    providerIds: { deezer: String(raw.id) },
    sources: [{ provider: 'deezer', kind: 'preview', url: raw.preview || null, fetchedAt: now }]
  }
  if (raw.artist.id !== undefined) track.artistId = providerKey('deezer', raw.artist.id)
  if (album?.id !== undefined) track.albumId = providerKey('deezer', album.id)
  if (raw.isrc) track.isrc = raw.isrc
  if (raw.explicit_lyrics !== undefined) track.explicit = raw.explicit_lyrics
  if (raw.rank !== undefined) track.deezerRank = raw.rank
  return track
}

export function mapDeezerArtist(raw: DzArtist): Artist | null {
  if (raw.id === undefined || !raw.name) return null
  const artist: Artist = {
    id: providerKey('deezer', raw.id),
    name: raw.name,
    imageUrl: raw.picture_big ?? raw.picture_xl ?? raw.picture_medium ?? null,
    providerIds: { deezer: String(raw.id) }
  }
  if (raw.nb_fan !== undefined) artist.fans = raw.nb_fan
  return artist
}

export function mapDeezerAlbum(raw: DzAlbum): Album | null {
  if (raw.id === undefined || !raw.title) return null
  const album: Album = {
    id: providerKey('deezer', raw.id),
    title: raw.title,
    artist: raw.artist?.name ?? '',
    artworkUrl: albumCover(raw),
    releaseDate: validDate(raw.release_date),
    providerIds: { deezer: String(raw.id) }
  }
  if (raw.artist?.id !== undefined) album.artistId = providerKey('deezer', raw.artist.id)
  if (raw.nb_tracks !== undefined) album.trackCount = raw.nb_tracks
  return album
}

const compact = <T>(items: Array<T | null>): T[] => items.filter((x): x is T => x !== null)

export class DeezerProvider implements MusicProvider {
  readonly id = 'deezer' as const
  readonly label = 'Deezer'

  constructor(
    private readonly baseUrl: string = DEEZER_BASE,
    private readonly http: JsonFetcher = createJsonFetcher({
      provider: 'deezer',
      label: 'Deezer',
      limiter: new SlidingWindowLimiter(40, 5000)
    })
  ) {}

  private async get<T>(path: string): Promise<T> {
    const json = (await this.http(`${this.baseUrl}${path}`)) as T & DzError
    if (json && typeof json === 'object' && 'error' in json && json.error) {
      const { code, message } = json.error
      if (code === 4 || code === 100) throw new ProviderError('rate_limited', 'Deezer is limiting requests. Wait a few seconds and try again.', 'deezer')
      if (code === 800) throw new ProviderError('not_found', 'Deezer has no data for that item.', 'deezer')
      throw new ProviderError('unknown', `Deezer error: ${message ?? 'unknown'}`, 'deezer')
    }
    return json
  }

  async searchTracks(query: string, limit: number): Promise<Track[]> {
    const res = await this.get<DzList<DzTrack>>(`/search/track?q=${encodeURIComponent(query)}&limit=${limit}`)
    return compact((res.data ?? []).map((t) => mapDeezerTrack(t)))
  }

  async searchArtists(query: string, limit: number): Promise<Artist[]> {
    const res = await this.get<DzList<DzArtist>>(`/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`)
    return compact((res.data ?? []).map(mapDeezerArtist))
  }

  async searchAlbums(query: string, limit: number): Promise<Album[]> {
    const res = await this.get<DzList<DzAlbum>>(`/search/album?q=${encodeURIComponent(query)}&limit=${limit}`)
    return compact((res.data ?? []).map(mapDeezerAlbum))
  }

  async getTrack(nativeId: string): Promise<Track | null> {
    try {
      return mapDeezerTrack(await this.get<DzTrack>(`/track/${encodeURIComponent(nativeId)}`))
    } catch (err) {
      if (err instanceof ProviderError && err.code === 'not_found') return null
      throw err
    }
  }

  async getArtistTopTracks(nativeId: string, limit: number): Promise<Track[]> {
    const res = await this.get<DzList<DzTrack>>(`/artist/${encodeURIComponent(nativeId)}/top?limit=${limit}`)
    return compact((res.data ?? []).map((t) => mapDeezerTrack(t)))
  }

  async getChartTracks(limit: number): Promise<Track[]> {
    const res = await this.get<DzList<DzTrack>>(`/chart/0/tracks?limit=${limit}`)
    return compact((res.data ?? []).map((t) => mapDeezerTrack(t)))
  }

  async getAlbum(nativeId: string): Promise<AlbumDetail> {
    const raw = await this.get<DzAlbum>(`/album/${encodeURIComponent(nativeId)}`)
    const album = mapDeezerAlbum(raw)
    if (!album) throw new ProviderError('not_found', 'Deezer has no data for that album.', 'deezer')
    let items = raw.tracks?.data ?? []
    if (album.trackCount !== undefined && items.length < album.trackCount) {
      const full = await this.get<DzList<DzTrack>>(`/album/${encodeURIComponent(nativeId)}/tracks?limit=${album.trackCount}`)
      items = full.data ?? items
    }
    // Album track entries have no album object of their own, so lend them this album's data.
    const tracks = compact(items.map((t) => mapDeezerTrack({ ...t, artist: t.artist ?? raw.artist }, raw)))
    return { album, tracks }
  }
}
