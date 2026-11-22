import { app, BrowserWindow, ipcMain, shell } from 'electron'
import type { AppInfo, IpcResult, MusicConfig, RepresentativeTarget } from '@shared/ipc'
import type { Track } from '@shared/types'
import { ProviderError } from './providers/types'
import type { MusicService } from './services/music-service'

function toError(err: unknown): { code: string; message: string } {
  if (err instanceof ProviderError) return { code: err.code, message: err.message }
  console.error('[ipc]', err)
  return { code: 'unknown', message: 'Something went wrong. Try again.' }
}

function register<A extends unknown[], R>(channel: string, fn: (...args: A) => Promise<R> | R): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<IpcResult<R>> => {
    try {
      return { ok: true, data: await fn(...(args as A)) }
    } catch (err) {
      return { ok: false, error: toError(err) }
    }
  })
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

function str(x: unknown, max = 500): string {
  if (typeof x !== 'string' || x.length > max) throw new ProviderError('unknown', 'Invalid request.')
  return x
}

function limit(x: unknown): number | undefined {
  return typeof x === 'number' && Number.isFinite(x) ? x : undefined
}

function asTrack(x: unknown): Track {
  if (!isRecord(x) || typeof x.id !== 'string' || typeof x.title !== 'string' || typeof x.artist !== 'string' || !isRecord(x.providerIds) || !Array.isArray(x.sources)) {
    throw new ProviderError('unknown', 'Invalid track.')
  }
  return x as unknown as Track
}

function asConfig(x: unknown): MusicConfig {
  if (!isRecord(x) || !isRecord(x.providers) || typeof x.itunesCountry !== 'string') throw new ProviderError('unknown', 'Invalid settings.')
  return { providers: { deezer: x.providers.deezer !== false, itunes: x.providers.itunes !== false }, itunesCountry: x.itunesCountry.slice(0, 2) }
}

function asTarget(x: unknown): RepresentativeTarget {
  if (!isRecord(x) || (x.kind !== 'artist' && x.kind !== 'album')) throw new ProviderError('unknown', 'Invalid request.')
  return { kind: x.kind, id: str(x.id, 100) }
}

export function registerIpc(music: MusicService, getWindow: () => BrowserWindow | null): void {
  register('music:configure', (cfg: unknown) => music.configure(asConfig(cfg)))
  register('music:searchTracks', (q: unknown, n: unknown) => music.searchTracks(str(q, 200), limit(n)))
  register('music:searchArtists', (q: unknown, n: unknown) => music.searchArtists(str(q, 200), limit(n)))
  register('music:searchAlbums', (q: unknown, n: unknown) => music.searchAlbums(str(q, 200), limit(n)))
  register('music:artistTopTracks', (id: unknown, n: unknown) => music.artistTopTracks(str(id, 100), limit(n)))
  register('music:albumTracks', (id: unknown) => music.albumTracks(str(id, 100)))
  register('music:chartTracks', (n: unknown) => music.chartTracks(limit(n)))
  register('music:representativeTrack', (t: unknown) => music.representativeTrack(asTarget(t)))
  register('music:resolvePlayback', (t: unknown) => music.resolvePlayback(asTrack(t)))

  register(
    'app:getInfo',
    (): AppInfo => ({ version: app.getVersion(), platform: process.platform, packaged: app.isPackaged })
  )
  register('app:openExternal', async (url: unknown) => {
    const parsed = new URL(str(url, 2000))
    if (parsed.protocol !== 'https:') throw new ProviderError('unknown', 'Only https links can be opened.')
    await shell.openExternal(parsed.toString())
  })
  register('app:toggleFullscreen', () => {
    const win = getWindow()
    win?.setFullScreen(!win.isFullScreen())
  })
}
