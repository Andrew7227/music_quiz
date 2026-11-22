import { create } from 'zustand'

export type PageId = 'home' | 'games' | 'discover' | 'tournament' | 'collections' | 'multiplayer' | 'profile' | 'settings'

interface NavState {
  page: PageId
  go: (page: PageId) => void
}

export const useNav = create<NavState>((set) => ({
  page: 'home',
  go: (page) => set({ page })
}))
