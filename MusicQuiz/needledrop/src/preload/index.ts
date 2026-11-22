import { contextBridge, ipcRenderer } from 'electron'
import type { AppInfo, IpcResult, NeedledropApi } from '../shared/ipc'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!res.ok) throw new Error(res.error.message)
  return res.data
}

const api: NeedledropApi = {
  music: {
    configure: (config) => call('music:configure', config),
    searchTracks: (query, limit) => call('music:searchTracks', query, limit),
    searchArtists: (query, limit) => call('music:searchArtists', query, limit),
    searchAlbums: (query, limit) => call('music:searchAlbums', query, limit),
    artistTopTracks: (artistId, limit) => call('music:artistTopTracks', artistId, limit),
    albumTracks: (albumId) => call('music:albumTracks', albumId),
    chartTracks: (limit) => call('music:chartTracks', limit),
    representativeTrack: (target) => call('music:representativeTrack', target),
    resolvePlayback: (track) => call('music:resolvePlayback', track)
  },
  app: {
    getInfo: () => call<AppInfo>('app:getInfo'),
    openExternal: (url) => call('app:openExternal', url),
    toggleFullscreen: () => call('app:toggleFullscreen')
  }
}

contextBridge.exposeInMainWorld('api', api)
