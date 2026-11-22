import { Icon, type IconName } from '@/components/icons'
import { Page, PageHeader } from '@/components/ui'
import { useNav } from '@/lib/nav'

interface Game {
  id: string
  title: string
  blurb: string
  difficulty: string
  icon: IconName
  playable: boolean
}

const GAMES: Game[] = [
  { id: 'tournament', title: 'Music Tournament', blurb: 'Songs, artists or albums face off in a knockout bracket. Listen to both and pick the winner.', difficulty: 'No wrong answers', icon: 'trophy', playable: true },
  { id: 'guess', title: 'Guess the Song', blurb: 'Name the artist or the title from a clip. Easy to expert, with hints and streak bonuses.', difficulty: 'Easy to expert', icon: 'play', playable: false },
  { id: 'pick', title: 'Pick One', blurb: 'Two options, one choice, again and again. Ends with your personal ranking.', difficulty: 'No wrong answers', icon: 'games', playable: false },
  { id: 'songless', title: 'Daily Clue', blurb: 'Find the hidden song from clues that open up with every wrong guess.', difficulty: 'Medium', icon: 'search', playable: false },
  { id: 'blind', title: 'Blind Ranking', blurb: 'Place each song in your top 10 as it appears. You cannot move it later.', difficulty: 'Nerves of steel', icon: 'library', playable: false },
  { id: 'higher', title: 'Higher or Lower', blurb: 'Which artist has more fans on Deezer? Only real, sourced numbers.', difficulty: 'Medium', icon: 'sliders', playable: false }
]

export function Games() {
  const go = useNav((s) => s.go)
  return (
    <Page>
      <PageHeader title="Games">Tournaments are ready to play. The rest arrive in the next update.</PageHeader>
      <ul className="grid grid-cols-2 gap-5">
        {GAMES.map((g) => {
          const inner = (
            <>
              <div className="flex items-start justify-between">
                <span className={`grid size-11 place-items-center rounded-xl ${g.playable ? 'bg-marigold text-night' : 'bg-plum-hi text-mist'}`}>
                  <Icon name={g.icon} />
                </span>
                <span className={`rounded-full px-3 py-1 text-xs ${g.playable ? 'bg-marigold/15 text-marigold' : 'bg-night text-mist'}`}>{g.playable ? 'Playable now' : 'Coming next'}</span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold">{g.title}</h2>
              <p className="mt-2 text-sm text-mist">{g.blurb}</p>
              <p className="mt-4 text-xs text-mist/80">{g.difficulty}</p>
            </>
          )
          return (
            <li key={g.id}>
              {g.playable ? (
                <button type="button" onClick={() => go('tournament')} className="block h-full w-full rounded-2xl border border-line bg-plum p-6 text-left transition hover:border-marigold">
                  {inner}
                </button>
              ) : (
                <div className="h-full rounded-2xl border border-line/60 bg-plum/50 p-6 opacity-80">{inner}</div>
              )}
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
