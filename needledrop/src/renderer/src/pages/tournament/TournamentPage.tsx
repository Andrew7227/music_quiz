import { useTournament } from '@/stores/tournament'
import { Results } from './Results'
import { Setup } from './Setup'
import { Stage } from './Stage'

export function TournamentPage() {
  const screen = useTournament((s) => s.screen)
  if (screen === 'stage') return <Stage />
  if (screen === 'results') return <Results />
  return <Setup />
}
