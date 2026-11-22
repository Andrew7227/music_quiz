import type { Album, AlbumDetail, Artist, PlaybackSource, ProviderId, Track } from '@shared/types'
import { hasPreview, splitProviderKey } from '@shared/types'
import { normalizeText } from '@shared/text'
import type { MusicConfig, RepresentativeTarget } from '@shared/ipc'
import { TtlCache } from '../providers/cache'
import { ItunesProvider } from '../providers/itunes'
import { ProviderError, type MusicProvider } from '../providers/types'
import { pickBestMatch } from './match'

const DEFAULT_CONFIG: MusicConfig = { providers: { deezer: true, itunes: true }, itunesCountry: 'US' }

/** Merges duplicates (same internal id) and combines their providers and playback sources. */
export function mergeTracks(lists: readonly (readonly Track[])[]): Track[] {
  const byId = new Map<string, Track>()
  for (const list of lists) {
    for (const t of list) {
      const existing = byId.get(t.id)
      if (!existing) {
        byId.set(t.id, { ...t, providerIds: { ...t.providerIds }, sources: t.sources.slice() })
        continue
      }
      existing.providerIds = { ...t.providerIds, ...existing.providerIds }
      for (const s of t.sources) {
        const i = existing.sources.findIndex((x) => x.provider === s.provider)
        if (i < 0) existing.sources.push(s)
        else if (!existing.sources[i]?.url && s.url) existing.sources[i] = s
      }
      existing.artworkUrl ??= t.artworkUrl
      existing.releaseDate ??= t.releaseDate
      existing.isrc ??= t.isrc
      existing.artistId ??= t.artistId
      existing.albumId ??= t.albumId
    }
  }
  return [...byId.values()]
}

function mergeAlbums(lists: readonly (readonly Album[])[]): Album[] {
  const seen = new Map<string, Album>()
  for (const list of lists) {
    for (const a of list) {
      const key = `${normalizeText(a.artist)}|${normalizeText(a.title)}`
      const existing = seen.get(key)
      if (!existing) seen.set(key, { ...a, providerIds: { ...a.providerIds } })
      else existing.providerIds = { ...a.providerIds, ...existing.providerIds }
    }
  }
  return [...seen.values()]
}

const clampLimit = (n: number | undefined, fallback: number): number => Math.min(100, Math.max(1, Math.floor(n ?? fallback)))

export class MusicService {
  private config: MusicConfig = DEFAULT_CONFIG
  private readonly searches = new TtlCache<unknown>(5 * 60_000)
  private readonly lookups = new TtlCache<unknown>(30 * 60_000)

  constructor(private readonly providers: readonly MusicProvider[]) {}

  configure(config: MusicConfig): void {
    const country = /^[A-Za-z]{2}$/.test(config.itunesCountry) ? config.itunesCountry.toUpperCase() : 'US'
    const enabled = this.providers.some((p) => config.providers[p.id])
    this.config = { providers: enabled ? { ...config.providers } : DEFAULT_CONFIG.providers, itunesCountry: country }
    for (const p of this.providers) if (p instanceof ItunesProvider) p.country = country
  }

  private active(): MusicProvider[] {
    return this.providers.filter((p) => this.config.providers[p.id])
  }

  private signature(): string {
    return `${this.active().map((p) => p.id).join('+')}|${this.config.itunesCountry}`
  }

  private resolveProvider(key: string): { provider: MusicProvider; nativeId: string } {
    const parts = splitProviderKey(key)
    if (!parts) throw new ProviderError('not_found', 'Unknown item.')
    const provider = this.providers.find((p) => p.id === parts.provider)
    if (!provider) throw new ProviderError('not_found', 'Unknown item.')
    if (!this.config.providers[provider.id]) throw new ProviderError('disabled', `${provider.label} is turned off in Settings.`, provider.id)
    return { provider, nativeId: parts.nativeId }
  }

  /** Runs `fn` on every active provider that supports it; ignores partial failures, throws only if all failed. */
  private async fanOut<T>(supports: (p: MusicProvider) => boolean, fn: (p: MusicProvider) => Promise<T[]>): Promise<T[][]> {
    const targets = this.active().filter(supports)
    if (targets.length === 0) throw new ProviderError('disabled', 'No music source is turned on for this. Check Settings.')
    const settled = await Promise.allSettled(targets.map(fn))
    const ok = settled.filter((s): s is PromiseFulfilledResult<T[]> => s.status === 'fulfilled').map((s) => s.value)
    if (ok.length === 0) {
      const failure = settled.find((s): s is PromiseRejectedResult => s.status === 'rejected')
      throw failure?.reason instanceof Error ? failure.reason : new ProviderError('unknown', 'Search failed.')
    }
    return ok
  }

  async searchTracks(query: string, limit?: number): Promise<Track[]> {
    const q = query.trim().slice(0, 200)
    if (!q) return []
    const n = clampLimit(limit, 25)
    return (await this.searches.getOrLoad(`t|${this.signature()}|${n}|${q.toLowerCase()}`, async () => {
      const lists = await this.fanOut(() => true, (p) => p.searchTracks(q, n))
      return mergeTracks(lists).slice(0, n)
    })) as Track[]
  }

  async searchArtists(query: string, limit?: number): Promise<Artist[]> {
    const q = query.trim().slice(0, 200)
    if (!q) return []
    const n = clampLimit(limit, 20)
    return (await this.searches.getOrLoad(`a|${this.signature()}|${n}|${q.toLowerCase()}`, async () => {
      const lists = await this.fanOut(
        (p) => typeof p.searchArtists === 'function',
        (p) => (p.searchArtists as NonNullable<MusicProvider['searchArtists']>)(q, n)
      )
      return lists.flat().slice(0, n)
    })) as Artist[]
  }

  async searchAlbums(query: string, limit?: number): Promise<Album[]> {
    const q = query.trim().slice(0, 200)
    if (!q) return []
    const n = clampLimit(limit, 20)
    return (await this.searches.getOrLoad(`b|${this.signature()}|${n}|${q.toLowerCase()}`, async () => {
      const lists = await this.fanOut(() => true, (p) => p.searchAlbums(q, n))
      return mergeAlbums(lists).slice(0, n)
    })) as Album[]
  }

  async artistTopTracks(artistId: string, limit?: number): Promise<Track[]> {
    const { provider, nativeId } = this.resolveProvider(artistId)
    const getTop = provider.getArtistTopTracks?.bind(provider)
    if (!getTop) throw new ProviderError('unavailable', `${provider.label} can't list an artist's top songs.`, provider.id)
    const n = clampLimit(limit, 20)
    return (await this.lookups.getOrLoad(`top|${artistId}|${n}`, () => getTop(nativeId, n))) as Track[]
  }

  async albumTracks(albumId: string): Promise<AlbumDetail> {
    const { provider, nativeId } = this.resolveProvider(albumId)
    return (await this.lookups.getOrLoad(`album|${albumId}`, () => provider.getAlbum(nativeId))) as AlbumDetail
  }

  async chartTracks(limit?: number): Promise<Track[]> {
    const n = clampLimit(limit, 50)
    const provider = this.active().find((p) => typeof p.getChartTracks === 'function')
    if (!provider?.getChartTracks) throw new ProviderError('disabled', 'Charts need Deezer. Turn it on in Settings.')
    const load = provider.getChartTracks.bind(provider)
    return (await this.lookups.getOrLoad(`chart|${provider.id}|${n}`, () => load(n))) as Track[]
  }

  /** The song that stands in for an artist or album in head-to-head tournaments. */
  async representativeTrack(target: RepresentativeTarget): Promise<Track | null> {
    if (target.kind === 'artist') {
      const top = await this.artistTopTracks(target.id, 10)
      return top.find(hasPreview) ?? null
    }
    const { tracks } = await this.albumTracks(target.id)
    const playable = tracks.filter(hasPreview)
    if (playable.length === 0) return null
    return playable.reduce((best, t) => ((t.deezerRank ?? 0) > (best.deezerRank ?? 0) ? t : best))
  }

  /**
   * Fresh, ordered playback sources for a track. Provider ids we already know are looked up
   * again (preview URLs go stale); providers we have no id for are searched by artist and title.
   */
  async resolvePlayback(track: Track): Promise<PlaybackSource[]> {
    const out: PlaybackSource[] = []
    const active = this.active()

    for (const p of active) {
      const nativeId = track.providerIds[p.id as ProviderId]
      if (!nativeId) continue
      try {
        const fresh = await p.getTrack(nativeId)
        const source = fresh?.sources.find((s) => s.url)
        if (source) out.push(source)
      } catch {
        // Provider unreachable: other providers may still work.
      }
    }

    for (const p of active) {
      if (track.providerIds[p.id]) continue
      try {
        const hits = await p.searchTracks(`${track.artist} ${track.title}`, 10)
        const best = pickBestMatch(hits, track)
        const source = best?.sources.find((s) => s.url)
        if (source) out.push(source)
      } catch {
        // Same: best effort.
      }
    }
    return out
  }
}
