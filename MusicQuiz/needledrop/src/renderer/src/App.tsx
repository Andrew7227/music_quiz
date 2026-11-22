import { useEffect } from 'react'
import { PlayerBar } from '@/components/PlayerBar'
import { Sidebar } from '@/components/Sidebar'
import { useNav } from '@/lib/nav'
import { useSettings } from '@/stores/settings'
import { Discover } from '@/pages/Discover'
import { Games } from '@/pages/Games'
import { Home } from '@/pages/Home'
import { Settings } from '@/pages/Settings'
import { Soon } from '@/pages/Soon'
import { TournamentPage } from '@/pages/tournament/TournamentPage'

function Current() {
  const page = useNav((s) => s.page)
  switch (page) {
    case 'home':
      return <Home />
    case 'games':
      return <Games />
    case 'discover':
      return <Discover />
    case 'tournament':
      return <TournamentPage />
    case 'settings':
      return <Settings />
    default:
      return <Soon page={page} />
  }
}

export default function App() {
  const providers = useSettings((s) => s.providers)
  const itunesCountry = useSettings((s) => s.itunesCountry)

  useEffect(() => {
    void window.api.music.configure({ providers, itunesCountry }).catch(() => undefined)
  }, [providers, itunesCountry])

  return (
    <div className="flex h-full flex-col">
      {/* Window drag area; the OS draws the window buttons over its right edge. */}
      <div className="drag fixed inset-x-0 top-0 z-30 h-9" aria-hidden="true" />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto pt-9">
          <Current />
        </main>
      </div>
      <PlayerBar />
    </div>
  )
}
