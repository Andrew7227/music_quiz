import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProviderId } from '@shared/types'

interface SettingsState {
  volume: number
  muted: boolean
  providers: Record<ProviderId, boolean>
  itunesCountry: string
  autoplayBoth: boolean
  setVolume: (v: number) => void
  setMuted: (m: boolean) => void
  setProvider: (id: ProviderId, on: boolean) => void
  setItunesCountry: (c: string) => void
  setAutoplayBoth: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      volume: 0.8,
      muted: false,
      providers: { deezer: true, itunes: true },
      itunesCountry: 'US',
      autoplayBoth: true,
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)), muted: false }),
      setMuted: (muted) => set({ muted }),
      setProvider: (id, on) => {
        const next = { ...get().providers, [id]: on }
        // At least one music source must stay on, otherwise nothing can be searched or played.
        if (!next.deezer && !next.itunes) return
        set({ providers: next })
      },
      setItunesCountry: (itunesCountry) => set({ itunesCountry: itunesCountry.toUpperCase().slice(0, 2) }),
      setAutoplayBoth: (autoplayBoth) => set({ autoplayBoth })
    }),
    { name: 'needledrop.settings.v1' }
  )
)
