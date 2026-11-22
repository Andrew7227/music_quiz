import type { Album, AlbumDetail, Track } from '@shared/types'
import { providerKey } from '@shared/types'
import { trackIdFor } from '@shared/text'
import { createJsonFetcher, SlidingWindowLimiter } from './http'
import { ProviderError, type JsonFetcher, type MusicProvider } from './types'

/** iTunes Search API: no key, 30-second previews, roughly 20 requests per minute. */
export const ITUNES_BASE = 'https://itunes.apple.com'

interface ItItem {
  wrapperType?: string
  kind?: string
  trackId?: number
  trackName?: string
  artistName?: string
  artistId?: number
  collectionId?: number
  collectionName?: string
  previewUrl?: string
  artworkUrl100?: string
  trackTimeMillis?: number
  releaseDate?: string
  trackCount?: number
  trackExplicitness?: string
}
interface ItResponse {
  results?: ItItem[]
}

function artwork(url: string | undefined): string | null {
  return url ? url.replace(/\/\d+x\d+(bb)?\./, '/600x600bb.') : null
}

function isoDate(d: string | undefined): string | null {
  return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null
}

export function mapItunesTrack(raw: ItItem, now: number = Date.now()): Track | null {
  if (raw.trackId === undefined || !raw.trackName || !raw.artistName) return null
  const track: Track = {
    id: trackIdFor(raw.artistName, raw.trackName),
    title: raw.trackName,
    artist: raw.artistName,
    album: raw.collectionName ?? '',
    artworkUrl: artwork(raw.artworkUrl100),
    releaseDate: isoDate(raw.releaseDate),
    durationMs: raw.trackTimeMillis ?? 0,
    explicit: raw.trackExplicitness === 'explicit',
    providerIds: { itunes: String(raw.trackId) },
    sources: [{ provider: 'itunes', kind: 'preview', url: raw.previewUrl || null, fetchedAt: now }]
  }
  if (raw.artistId !== undefined) track.artistId = providerKey('itunes', raw.artistId)
  if (raw.collectionId !== undefined) track.albumId = providerKey('itunes', raw.collectionId)
  return track
}

export function mapItunesAlbum(raw: ItItem): Album | null {
  if (raw.collectionId === undefined || !raw.collectionName || !raw.artistName) return null
  const album: Album = {
    id: providerKey('itunes', raw.collectionId),
    title: raw.collectionName,
    artist: raw.artistName,
    artworkUrl: artwork(raw.artworkUrl100),
    releaseDate: isoDate(raw.releaseDate),
    providerIds: { itunes: String(raw.collectionId) }
  }
  if (raw.artistId !== undefined) album.artistId = providerKey('itunes', raw.artistId)
  if (raw.trackCount !== undefined) album.trackCount = raw.trackCount
  return album
}

const compact = <T>(items: Array<T | null>): T[] => items.filter((x): x is T => x !== null)

export class ItunesProvider implements MusicProvider {
  readonly id = 'itunes' as const
  readonly label = 'Apple iTunes'
  country = 'US'

  constructor(
    private readonly baseUrl: string = ITUNES_BASE,
    private readonly http: JsonFetcher = createJsonFetcher({
      provider: 'itunes',
      label: 'Apple iTunes',
      limiter: new SlidingWindowLimiter(18, 60_000)
    })
  ) {}

  private async get(path: string): Promise<ItItem[]> {
    const sep = path.includes('?') ? '&' : '?'
    const json = (await this.http(`${this.baseUrl}${path}${sep}country=${encodeURIComponent(this.country)}`)) as ItResponse
    return json.results ?? []
  }

  async searchTracks(query: string, limit: number): Promise<Track[]> {
    const items = await this.get(`/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`)
    return compact(items.map((i) => mapItunesTrack(i)))
  }

  async searchAlbums(query: string, limit: number): Promise<Album[]> {
    const items = await this.get(`/search?term=${encodeURIComponent(query)}&media=music&entity=album&limit=${limit}`)
    return compact(items.map(mapItunesAlbum))
  }

  async getTrack(nativeId: string): Promise<Track | null> {
    const items = await this.get(`/lookup?id=${encodeURIComponent(nativeId)}`)
    const song = items.find((i) => i.wrapperType === 'track')
    return song ? mapItunesTrack(song) : null
  }

  async getAlbum(nativeId: string): Promise<AlbumDetail> {
    const items = await this.get(`/lookup?id=${encodeURIComponent(nativeId)}&entity=song&limit=200`)
    const albumRaw = items.find((i) => i.wrapperType === 'collection')
    const album = albumRaw ? mapItunesAlbum(albumRaw) : null
    if (!album) throw new ProviderError('not_found', 'Apple has no data for that album.', 'itunes')
    const tracks = compact(items.filter((i) => i.wrapperType === 'track' && i.kind === 'song').map((i) => mapItunesTrack(i)))
    return { album, tracks }
  }
}
