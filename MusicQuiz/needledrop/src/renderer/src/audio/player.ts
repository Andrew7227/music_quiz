import { create } from 'zustand'
import type { Track } from '@shared/types'
import { useSettings } from '@/stores/settings'

/**
 * One audio element for the whole app, so playback survives navigation.
 * A game can take control (acquire): while it holds control, the user transport is locked
 * and only the game decides what plays and when it stops.
 */

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'

interface PlayerState {
  track: Track | null
  status: PlayerStatus
  error: string | null
  position: number
  duration: number
  owner: string | null
}

export const usePlayer = create<PlayerState>(() => ({
  track: null,
  status: 'idle',
  error: null,
  position: 0,
  duration: 0,
  owner: null
}))

export interface PlayOptions {
  startAt?: number
  /** Stops (and fires onEnded) when playback reaches this many seconds. */
  stopAt?: number
  onEnded?: () => void
  /** No source could be played: show it to the user, or skip the song. */
  onUnavailable?: () => void
}

const LOAD_TIMEOUT_MS = 10_000

const audio = new Audio()
audio.preload = 'auto'

let token = 0
let loading = false
let handlers: { onEnded?: () => void; stopAt?: number } = {}

function applyVolume(): void {
  const { volume, muted } = useSettings.getState()
  audio.volume = muted ? 0 : volume
}
applyVolume()
useSettings.subscribe(applyVolume)

function finish(): void {
  audio.pause()
  usePlayer.setState({ status: 'ended', position: audio.currentTime })
  const cb = handlers.onEnded
  handlers = { ...handlers, onEnded: undefined, stopAt: undefined }
  cb?.()
}

audio.addEventListener('timeupdate', () => {
  if (usePlayer.getState().status === 'idle') return
  usePlayer.setState({ position: audio.currentTime })
  if (handlers.stopAt !== undefined && audio.currentTime >= handlers.stopAt) finish()
})
audio.addEventListener('durationchange', () => {
  usePlayer.setState({ duration: Number.isFinite(audio.duration) ? audio.duration : 0 })
})
audio.addEventListener('playing', () => usePlayer.setState({ status: 'playing', error: null }))
audio.addEventListener('pause', () => {
  if (loading || audio.ended) return
  if (usePlayer.getState().status === 'playing') usePlayer.setState({ status: 'paused' })
})
audio.addEventListener('ended', finish)
audio.addEventListener('error', () => {
  if (loading) return
  usePlayer.setState({ status: 'error', error: 'This song stopped playing. Try it again.' })
})

function loadUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cleanup = () => {
      clearTimeout(timer)
      audio.removeEventListener('canplay', onReady)
      audio.removeEventListener('error', onFail)
    }
    const onReady = () => {
      cleanup()
      resolve(true)
    }
    const onFail = () => {
      cleanup()
      resolve(false)
    }
    const timer = setTimeout(onFail, LOAD_TIMEOUT_MS)
    audio.addEventListener('canplay', onReady, { once: true })
    audio.addEventListener('error', onFail, { once: true })
    audio.src = url
    audio.load()
  })
}

const urlsOf = (track: Track): string[] => track.sources.map((s) => s.url).filter((u): u is string => !!u)

async function startTrack(track: Track, opts: PlayOptions): Promise<void> {
  const mine = ++token
  loading = true
  audio.pause()
  handlers = { onEnded: opts.onEnded, stopAt: opts.stopAt }
  usePlayer.setState({ track, status: 'loading', error: null, position: 0, duration: 0 })

  const attempted = new Set<string>()
  const tryUrls = async (urls: string[]): Promise<boolean> => {
    for (const url of urls) {
      if (attempted.has(url)) continue
      attempted.add(url)
      const ok = await loadUrl(url)
      if (mine !== token || ok) return ok
    }
    return false
  }

  let ready = await tryUrls(urlsOf(track))
  if (mine !== token) return
  if (!ready) {
    // Stored URLs may be stale or missing: ask the main process for fresh ones, other providers included.
    try {
      const fresh = await window.api.music.resolvePlayback(track)
      if (mine !== token) return
      ready = await tryUrls(fresh.map((s) => s.url).filter((u): u is string => !!u))
    } catch {
      // Handled as unavailable below.
    }
  }
  if (mine !== token) return
  loading = false

  if (!ready) {
    usePlayer.setState({ status: 'error', error: 'No preview is available for this song.' })
    opts.onUnavailable?.()
    return
  }
  if (opts.startAt) audio.currentTime = opts.startAt
  try {
    await audio.play()
  } catch {
    if (mine === token) usePlayer.setState({ status: 'paused', error: 'Playback was blocked. Press play.' })
  }
}

function doPause(): void {
  if (usePlayer.getState().status === 'playing') audio.pause()
}

function doResume(): void {
  const { status, track } = usePlayer.getState()
  if (!track) return
  if (status === 'paused') void audio.play().catch(() => undefined)
  else if (status === 'ended') {
    audio.currentTime = 0
    void audio.play().catch(() => undefined)
  }
}

function doReplay(): void {
  const { track, status } = usePlayer.getState()
  if (!track || status === 'loading' || status === 'idle') return
  if (status === 'error') {
    void startTrack(track, {})
    return
  }
  audio.currentTime = 0
  void audio.play().catch(() => undefined)
}

function doStop(): void {
  token++
  loading = false
  handlers = {}
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  usePlayer.setState({ track: null, status: 'idle', error: null, position: 0, duration: 0 })
}

const isLocked = (): boolean => usePlayer.getState().owner !== null

export interface PlayerController {
  play: (track: Track, opts?: PlayOptions) => Promise<void>
  pause: () => void
  resume: () => void
  replay: () => void
  stop: () => void
  release: () => void
}

export const player = {
  /** User-initiated playback. Ignored while a game holds control. */
  play(track: Track, opts: PlayOptions = {}): Promise<void> {
    return isLocked() ? Promise.resolve() : startTrack(track, opts)
  },
  pause(): void {
    if (!isLocked()) doPause()
  },
  resume(): void {
    if (!isLocked()) doResume()
  },
  toggle(): void {
    if (isLocked()) return
    const { status } = usePlayer.getState()
    if (status === 'playing') doPause()
    else doResume()
  },
  replay(): void {
    if (!isLocked()) doReplay()
  },
  seek(seconds: number): void {
    if (isLocked() || usePlayer.getState().status === 'idle') return
    audio.currentTime = Math.max(0, seconds)
  },
  stop(): void {
    if (!isLocked()) doStop()
  },

  /** A game takes over playback. Call release() when leaving; that also stops the audio. */
  acquire(owner: string): PlayerController {
    doStop()
    usePlayer.setState({ owner })
    const owned = () => usePlayer.getState().owner === owner
    return {
      play: (track, opts = {}) => (owned() ? startTrack(track, opts) : Promise.resolve()),
      pause: () => {
        if (owned()) doPause()
      },
      resume: () => {
        if (owned()) doResume()
      },
      replay: () => {
        if (owned()) doReplay()
      },
      stop: () => {
        if (owned()) doStop()
      },
      release: () => {
        if (!owned()) return
        doStop()
        usePlayer.setState({ owner: null })
      }
    }
  }
}
