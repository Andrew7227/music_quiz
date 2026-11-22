export type ProviderId = 'deezer' | 'itunes'

export type ProviderIds = Partial<Record<ProviderId, string>>

export interface PlaybackSource {
  provider: ProviderId
  kind: 'preview'
  /** Direct audio URL, or null when the provider has no audio for this track. URLs can go stale: treat as a hint. */
  url: string | null
  fetchedAt: number
}

export interface Track {
  /** Internal id derived from artist + title, so the same song from two providers merges. */
  id: string
  title: string
  artist: string
  /** Internal artist id such as "deezer:27", when the provider exposes one. */
  artistId?: string
  album: string
  albumId?: string
  artworkUrl: string | null
  /** ISO date (YYYY-MM-DD) when known. */
  releaseDate: string | null
  durationMs: number
  isrc?: string
  explicit?: boolean
  /** Deezer's own popularity score. Not a stream count. */
  deezerRank?: number
  providerIds: ProviderIds
  sources: PlaybackSource[]
}

export interface Artist {
  id: string
  name: string
  imageUrl: string | null
  /** Deezer fan count. Not "monthly listeners". */
  fans?: number
  providerIds: ProviderIds
}

export interface Album {
  id: string
  title: string
  artist: string
  artistId?: string
  artworkUrl: string | null
  releaseDate: string | null
  trackCount?: number
  providerIds: ProviderIds
}

export interface AlbumDetail {
  album: Album
  tracks: Track[]
}

export function providerKey(provider: ProviderId, nativeId: string | number): string {
  return `${provider}:${nativeId}`
}

export function splitProviderKey(key: string): { provider: ProviderId; nativeId: string } | null {
  const i = key.indexOf(':')
  if (i < 0) return null
  const provider = key.slice(0, i)
  if (provider !== 'deezer' && provider !== 'itunes') return null
  const nativeId = key.slice(i + 1)
  return nativeId ? { provider, nativeId } : null
}

export function firstPlayableUrl(track: Track): string | null {
  return track.sources.find((s) => s.url)?.url ?? null
}

export function hasPreview(track: Track): boolean {
  return firstPlayableUrl(track) !== null
}
