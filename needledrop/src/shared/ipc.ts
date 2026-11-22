import type { Album, AlbumDetail, Artist, PlaybackSource, ProviderId, Track } from './types'

export interface MusicConfig {
  providers: Record<ProviderId, boolean>
  /** Two-letter iTunes storefront, for example "US". */
  itunesCountry: string
}

export type RepresentativeTarget = { kind: 'artist'; id: string } | { kind: 'album'; id: string }

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } }

export interface AppInfo {
  version: string
  platform: string
  packaged: boolean
}

/** The only surface the renderer can reach the main process through (see preload). */
export interface NeedledropApi {
  music: {
    configure(config: MusicConfig): Promise<void>
    searchTracks(query: string, limit?: number): Promise<Track[]>
    searchArtists(query: string, limit?: number): Promise<Artist[]>
    searchAlbums(query: string, limit?: number): Promise<Album[]>
    artistTopTracks(artistId: string, limit?: number): Promise<Track[]>
    albumTracks(albumId: string): Promise<AlbumDetail>
    chartTracks(limit?: number): Promise<Track[]>
    representativeTrack(target: RepresentativeTarget): Promise<Track | null>
    resolvePlayback(track: Track): Promise<PlaybackSource[]>
  }
  app: {
    getInfo(): Promise<AppInfo>
    openExternal(url: string): Promise<void>
    toggleFullscreen(): Promise<void>
  }
}

export const MUSIC_CHANNELS = [
  'configure',
  'searchTracks',
  'searchArtists',
  'searchAlbums',
  'artistTopTracks',
  'albumTracks',
  'chartTracks',
  'representativeTrack',
  'resolvePlayback'
] as const
