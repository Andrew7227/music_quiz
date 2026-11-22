import type { NeedledropApi } from '../ipc'
import type { Album, Artist, Track } from '../types'
import { hasPreview } from '../types'
import { sample, type Rng } from './rng'
import { MAX_CONTESTANTS, MIN_CONTESTANTS, type Contestant } from './tournament'

export type SetupKind = 'songs' | 'artist-hits' | 'album-tracks' | 'chart' | 'artists' | 'albums'

export interface SetupInput {
  kind: SetupKind
  /** Number of contestants, or 'all' to use exactly what was picked. */
  size: number | 'all'
  songs: Track[]
  artists: Artist[]
  albums: Album[]
}

export interface BuildResult {
  contestants: Contestant[]
  notice: string | null
}

type Music = Pick<NeedledropApi['music'], 'artistTopTracks' | 'albumTracks' | 'chartTracks' | 'representativeTrack'>

const HITS_PER_ARTIST = 15
const CONCURRENCY = 4

export const fromTrack = (t: Track): Contestant => ({ id: t.id, kind: 'track', title: t.title, subtitle: t.artist, imageUrl: t.artworkUrl, track: t })

export const fromArtist = (a: Artist, t: Track): Contestant => ({
  id: a.id,
  kind: 'artist',
  title: a.name,
  subtitle: `Plays “${t.title}”`,
  imageUrl: a.imageUrl ?? t.artworkUrl,
  track: t
})

export const fromAlbum = (a: Album, t: Track): Contestant => ({
  id: a.id,
  kind: 'album',
  title: a.title,
  subtitle: a.artist,
  imageUrl: a.artworkUrl ?? t.artworkUrl,
  track: t
})

export async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i] as T, i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  return items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)))
}

/** Turns the user's setup into a list of playable contestants (3 to 64). Throws a readable error if it cannot. */
export async function buildContestants(
  input: SetupInput,
  music: Music,
  rng: Rng,
  onProgress: (message: string) => void = () => undefined
): Promise<BuildResult> {
  const notices: string[] = []
  let all: Contestant[]

  if (input.kind === 'artists' || input.kind === 'albums') {
    const isArtists = input.kind === 'artists'
    const entities: Array<Artist | Album> = isArtists ? input.artists : input.albums
    let done = 0
    const built = await mapLimit(entities, CONCURRENCY, async (entity) => {
      const rep = await music.representativeTrack({ kind: isArtists ? 'artist' : 'album', id: entity.id })
      onProgress(`Finding a song for each pick (${++done} of ${entities.length})`)
      if (!rep) return null
      return 'name' in entity ? fromArtist(entity, rep) : fromAlbum(entity, rep)
    })
    all = built.filter((c): c is Contestant => c !== null)
    const lost = entities.length - all.length
    if (lost > 0) notices.push(`${lost} had no playable preview and ${lost === 1 ? 'was' : 'were'} left out.`)
  } else {
    let pool: Track[] = []
    if (input.kind === 'songs') {
      pool = input.songs
    } else if (input.kind === 'chart') {
      onProgress('Loading the charts')
      pool = await music.chartTracks(100)
    } else if (input.kind === 'artist-hits') {
      let done = 0
      const lists = await mapLimit(input.artists, CONCURRENCY, async (a) => {
        const tracks = await music.artistTopTracks(a.id, HITS_PER_ARTIST)
        onProgress(`Collecting hits (${++done} of ${input.artists.length})`)
        return tracks
      })
      pool = lists.flat()
    } else {
      let done = 0
      const lists = await mapLimit(input.albums, CONCURRENCY, async (a) => {
        const detail = await music.albumTracks(a.id)
        onProgress(`Collecting album tracks (${++done} of ${input.albums.length})`)
        return detail.tracks
      })
      pool = lists.flat()
    }
    const unique = uniqueById(pool)
    const playable = unique.filter(hasPreview)
    if (playable.length < unique.length) {
      const lost = unique.length - playable.length
      notices.push(`${lost} ${lost === 1 ? 'song has' : 'songs have'} no preview and ${lost === 1 ? 'was' : 'were'} left out.`)
    }
    all = playable.map(fromTrack)
  }

  if (all.length < MIN_CONTESTANTS) {
    throw new Error('Not enough playable songs to start. Pick more, or try different ones.')
  }

  const wanted = input.size === 'all' ? Math.min(all.length, MAX_CONTESTANTS) : Math.min(input.size, MAX_CONTESTANTS)
  const target = Math.max(MIN_CONTESTANTS, wanted)
  if (all.length < target) notices.push(`Only ${all.length} could be used, so the bracket has ${all.length}.`)
  const contestants = all.length > target ? sample(all, target, rng) : all
  return { contestants, notice: notices.length ? notices.join(' ') : null }
}
