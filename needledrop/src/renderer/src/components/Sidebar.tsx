import { useNav, type PageId } from '@/lib/nav'
import { Icon, type IconName } from './icons'

interface Item {
  id: PageId
  label: string
  icon: IconName
  soon?: boolean
}

const ITEMS: Item[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'games', label: 'Games', icon: 'games' },
  { id: 'discover', label: 'Discover', icon: 'search' },
  { id: 'tournament', label: 'Tournaments', icon: 'trophy' },
  { id: 'collections', label: 'Collections', icon: 'library', soon: true },
  { id: 'multiplayer', label: 'Multiplayer', icon: 'users', soon: true },
  { id: 'profile', label: 'Profile', icon: 'user', soon: true },
  { id: 'settings', label: 'Settings', icon: 'sliders' }
]

export function Sidebar() {
  const { page, go } = useNav()
  return (
    <nav aria-label="Main" className="flex w-56 shrink-0 flex-col border-r border-line bg-plum/60 px-3 pt-12 pb-4">
      <div className="mb-8 flex items-center gap-2.5 px-3">
        <span className="relative grid size-7 place-items-center rounded-full bg-[#0b0910]" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-marigold" />
        </span>
        <span className="font-display text-xl font-semibold tracking-tight">Needledrop</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {ITEMS.map((item) => {
          const active = page === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.id)}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  active ? 'bg-plum-hi text-bone' : 'text-mist hover:bg-plum-hi/60 hover:text-bone'
                }`}
              >
                {active && <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-marigold" aria-hidden="true" />}
                <Icon name={item.icon} className="size-[18px]" />
                <span className="flex-1">{item.label}</span>
                {item.soon && <span className="rounded-full bg-night px-2 py-0.5 text-[10px] text-mist">Soon</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
