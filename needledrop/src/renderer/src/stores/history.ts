import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface HistoryEntryFace {
  title: string
  subtitle: string
  imageUrl: string | null
}

export interface TournamentRecord {
  id: string
  finishedAt: number
  contestants: number
  kind: 'track' | 'artist' | 'album'
  champion: HistoryEntryFace
  runnerUp: HistoryEntryFace | null
  durationMs: number | null
}

interface HistoryState {
  records: TournamentRecord[]
  add: (record: TournamentRecord) => void
  clear: () => void
}

const MAX_RECORDS = 50

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      add: (record) => set((s) => ({ records: [record, ...s.records.filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS) })),
      clear: () => set({ records: [] })
    }),
    { name: 'needledrop.history.v1' }
  )
)
