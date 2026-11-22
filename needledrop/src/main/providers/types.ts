import type { Album, AlbumDetail, Artist, ProviderId, Track } from '@shared/types'

export type ProviderErrorCode = 'network' | 'rate_limited' | 'not_found' | 'unavailable' | 'disabled' | 'unknown'

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly provider?: ProviderId
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

export type JsonFetcher = (url: string) => Promise<unknown>

/** Every music source implements this. Optional methods mean "this provider cannot do that". */
export interface MusicProvider {
  readonly id: ProviderId
  readonly label: string
  searchTracks(query: string, limit: number): Promise<Track[]>
  searchAlbums(query: string, limit: number): Promise<Album[]>
  getTrack(nativeId: string): Promise<Track | null>
  getAlbum(nativeId: string): Promise<AlbumDetail>
  searchArtists?(query: string, limit: number): Promise<Artist[]>
  getArtistTopTracks?(nativeId: string, limit: number): Promise<Track[]>
  getChartTracks?(limit: number): Promise<Track[]>
}
