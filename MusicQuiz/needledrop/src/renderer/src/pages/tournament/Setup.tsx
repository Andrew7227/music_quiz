import { useState } from 'react'
import type { Album, Artist, Track } from '@shared/types'
import { buildContestants, type SetupKind } from '@shared/engine/contestants'
import { createRng, randomSeed } from '@shared/engine/rng'
import { MAX_CONTESTANTS, MIN_CONTESTANTS } from '@shared/engine/tournament'
import { Artwork } from '@/components/Artwork'
import { Icon } from '@/components/icons'
import { SearchBox } from '@/components/SearchBox'
import { SearchResults, type SearchKind } from '@/components/SearchResults'
import { btnGhost, btnPrimary, Notice, Page, PageHeader, Spinner } from '@/components/ui'
import { plural } from '@/lib/format'
import { useDebounced } from '@/lib/useAsyncData'
import { useTournament } from '@/stores/tournament'

interface KindInfo {
  id: SetupKind
  title: string
  blurb: string
  pick: SearchKind | null
  /** Pool kinds sample `size` contestants from everything collected; others use the picks themselves. */
  pool: boolean
  maxPicks: number
  minPicks: number
}

const KINDS: KindInfo[] = [
  { id: 'songs', title: 'Songs I pick', blurb: 'Search and add the exact songs you want to see fight.', pick: 'tracks', pool: false, maxPicks: 64, minPicks: 2 },
  { id: 'artist-hits', title: 'Hits from artists', blurb: 'Pick artists or groups. Their most popular songs enter the bracket.', pick: 'artists', pool: true, maxPicks: 20, minPicks: 1 },
  { id: 'album-tracks', title: 'Tracks from albums', blurb: 'Pick albums. Every track on them enters the bracket.', pick: 'albums', pool: true, maxPicks: 20, minPicks: 1 },
  { id: 'chart', title: 'Today’s charts', blurb: 'The most played songs on Deezer right now.', pick: null, pool: true, maxPicks: 0, minPicks: 0 },
  { id: 'artists', title: 'Artists head to head', blurb: 'Each artist plays their top song. Last one standing wins.', pick: 'artists', pool: false, maxPicks: 64, minPicks: 2 },
  { id: 'albums', title: 'Albums head to head', blurb: 'Each album plays its most popular track.', pick: 'albums', pool: false, maxPicks: 64, minPicks: 2 }
]

const SIZES = [8, 16, 32, 64]

interface Chip {
  id: string
  label: string
  image: string | null
}

function Tray({ chips, onRemove, onClear }: { chips: Chip[]; onRemove: (id: string) => void; onClear: () => void }) {
  if (chips.length === 0) return null
  return (
    <div className="rounded-2xl border border-line bg-plum p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{plural(chips.length, 'pick')}</p>
        <button type="button" onClick={onClear} className="text-xs text-mist hover:text-bone">
          Clear all
        </button>
      </div>
      <ul className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
        {chips.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-full bg-plum-hi py-1 pr-1 pl-1 text-xs">
            <Artwork src={c.image} seed={c.label} round className="size-6" />
            <span className="max-w-40 truncate">{c.label}</span>
            <button type="button" aria-label={`Remove ${c.label}`} onClick={() => onRemove(c.id)} className="grid size-5 place-items-center rounded-full text-mist hover:bg-night hover:text-bone">
              <Icon name="close" className="size-3" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Setup() {
  const draft = useTournament((s) => s.draft)
  const { setDraft, start } = useTournament.getState()
  const info = KINDS.find((k) => k.id === draft.kind) ?? (KINDS[0] as KindInfo)

  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 350)
  const [custom, setCustom] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [limitHit, setLimitHit] = useState(false)

  const picks = info.pick === 'tracks' ? draft.songs.length : info.pick === 'artists' ? draft.artists.length : info.pick === 'albums' ? draft.albums.length : 0

  const chooseKind = (kind: KindInfo) => {
    setError(null)
    setLimitHit(false)
    setCustom(false)
    setQuery('')
    setDraft({ kind: kind.id, size: kind.pool ? 16 : 'all' })
  }

  const toggle = <T extends { id: string }>(list: T[], item: T, key: 'songs' | 'artists' | 'albums') => {
    const exists = list.some((x) => x.id === item.id)
    if (!exists && list.length >= info.maxPicks) {
      setLimitHit(true)
      return
    }
    setLimitHit(false)
    setDraft({ [key]: exists ? list.filter((x) => x.id !== item.id) : [...list, item] } as never)
  }

  const chips: Chip[] =
    info.pick === 'tracks'
      ? draft.songs.map((t) => ({ id: t.id, label: `${t.title}, ${t.artist}`, image: t.artworkUrl }))
      : info.pick === 'artists'
        ? draft.artists.map((a) => ({ id: a.id, label: a.name, image: a.imageUrl }))
        : info.pick === 'albums'
          ? draft.albums.map((a) => ({ id: a.id, label: a.title, image: a.artworkUrl }))
          : []

  const removeChip = (id: string) => {
    if (info.pick === 'tracks') setDraft({ songs: draft.songs.filter((x) => x.id !== id) })
    else if (info.pick === 'artists') setDraft({ artists: draft.artists.filter((x) => x.id !== id) })
    else if (info.pick === 'albums') setDraft({ albums: draft.albums.filter((x) => x.id !== id) })
  }
  const clearChips = () => setDraft(info.pick === 'tracks' ? { songs: [] } : info.pick === 'artists' ? { artists: [] } : { albums: [] })

  const ready = picks >= info.minPicks
  const tooMany = info.pool ? false : picks > MAX_CONTESTANTS

  const build = async () => {
    setError(null)
    setBusy('Getting started…')
    try {
      const result = await buildContestants(
        { kind: draft.kind, size: draft.size, songs: draft.songs, artists: draft.artists, albums: draft.albums },
        window.api.music,
        createRng(randomSeed()),
        setBusy
      )
      start(result.contestants, result.notice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the bracket.')
    } finally {
      setBusy(null)
    }
  }

  const sizeOptions: Array<number | 'all'> = info.pool ? SIZES : ['all', ...SIZES]

  return (
    <Page>
      <PageHeader title="Tournaments">Songs, artists or albums face off two at a time, with a 30-second preview each. The last one standing wins.</PageHeader>

      <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-10">
        <div role="radiogroup" aria-label="Tournament type" className="flex flex-col gap-1.5">
          {KINDS.map((k) => {
            const on = k.id === draft.kind
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => chooseKind(k)}
                className={`rounded-xl border px-4 py-3 text-left transition ${on ? 'border-marigold bg-plum-hi' : 'border-line hover:bg-plum'}`}
              >
                <span className="block text-sm font-semibold">{k.title}</span>
                <span className="mt-0.5 block text-xs text-mist">{k.blurb}</span>
              </button>
            )
          })}
        </div>

        <div className="min-w-0 space-y-6">
          {info.pick && (
            <div className="space-y-4">
              <SearchBox
                value={query}
                onChange={setQuery}
                label={`Search ${info.pick}`}
                placeholder={info.pick === 'tracks' ? 'Search songs to add' : info.pick === 'artists' ? 'Search artists or groups' : 'Search albums'}
              />
              <SearchResults
                kind={info.pick}
                query={debounced}
                isSelected={(id) => (info.pick === 'artists' ? draft.artists.some((a) => a.id === id) : draft.albums.some((a) => a.id === id))}
                onArtist={(a: Artist) => toggle(draft.artists, a, 'artists')}
                onAlbum={(a: Album) => toggle(draft.albums, a, 'albums')}
                trackAction={(t: Track) => {
                  const added = draft.songs.some((s) => s.id === t.id)
                  return (
                    <button
                      type="button"
                      onClick={() => toggle(draft.songs, t, 'songs')}
                      aria-pressed={added}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${added ? 'border-marigold text-marigold' : 'border-line text-bone hover:bg-plum-hi'}`}
                    >
                      <Icon name={added ? 'check' : 'plus'} className="size-3.5" /> {added ? 'Added' : 'Add'}
                    </button>
                  )
                }}
              />
              {limitHit && <Notice>You can add up to {info.maxPicks} here. Remove one to add another.</Notice>}
              <Tray chips={chips} onRemove={removeChip} onClear={clearChips} />
            </div>
          )}
          {!info.pick && <Notice>Nothing to pick. We take the current Deezer chart and draw the bracket from it.</Notice>}

          <div className="rounded-2xl border border-line bg-plum p-5">
            <p className="text-sm font-semibold">{info.pool ? 'How many songs fight?' : 'How many go in?'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {sizeOptions.map((s) => {
                const on = !custom && draft.size === s
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setCustom(false)
                      setDraft({ size: s })
                    }}
                    className={`rounded-full border px-4 py-1.5 text-sm transition ${on ? 'border-marigold bg-marigold text-night' : 'border-line hover:bg-plum-hi'}`}
                  >
                    {s === 'all' ? 'Everything I picked' : s}
                  </button>
                )
              })}
              <button
                type="button"
                aria-pressed={custom}
                onClick={() => {
                  setCustom(true)
                  setDraft({ size: typeof draft.size === 'number' ? draft.size : 12 })
                }}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${custom ? 'border-marigold bg-marigold text-night' : 'border-line hover:bg-plum-hi'}`}
              >
                Custom
              </button>
              {custom && (
                <label className="flex items-center gap-2 text-sm text-mist">
                  <span className="sr-only">Custom bracket size</span>
                  <input
                    type="number"
                    min={MIN_CONTESTANTS}
                    max={MAX_CONTESTANTS}
                    value={typeof draft.size === 'number' ? draft.size : ''}
                    onChange={(e) => setDraft({ size: Math.min(MAX_CONTESTANTS, Math.max(MIN_CONTESTANTS, Math.round(Number(e.target.value) || MIN_CONTESTANTS))) })}
                    className="w-20 rounded-lg border border-line bg-night px-3 py-1.5 text-bone focus:border-marigold focus:outline-none"
                  />
                  between {MIN_CONTESTANTS} and {MAX_CONTESTANTS}
                </label>
              )}
            </div>
            <p className="mt-3 text-xs text-mist">
              {info.pool
                ? 'We collect everything first, then pick this many at random. Songs without a preview are left out.'
                : draft.size === 'all'
                  ? 'Every pick goes in, in a random bracket.'
                  : 'If you picked more, we choose this many at random.'}{' '}
              A size that is not a power of two gives some contestants a free pass in round one.
            </p>
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {tooMany && <Notice tone="error">That is more than {MAX_CONTESTANTS}. Remove some picks or choose a smaller size.</Notice>}

          <div className="sticky bottom-0 -mx-2 flex items-center gap-4 bg-night/90 px-2 py-4 backdrop-blur">
            <button type="button" className={btnPrimary} disabled={!ready || busy !== null || (tooMany && draft.size === 'all')} onClick={() => void build()}>
              {busy ? <Spinner className="size-4 !border-night/30 !border-t-night" /> : <Icon name="trophy" className="size-4" />}
              {busy ? 'Building…' : 'Build the bracket'}
            </button>
            {busy && <span className="text-sm text-mist">{busy}</span>}
            {!ready && !busy && (
              <span className="text-sm text-mist">
                Pick at least {info.minPicks} {info.pick === 'tracks' ? 'songs' : info.pick === 'artists' ? 'artists' : 'albums'} to start.
              </span>
            )}
            {draft.size !== 'all' && !busy && ready && picks > 0 && !info.pool && typeof draft.size === 'number' && picks < draft.size && (
              <button type="button" className={btnGhost} onClick={() => setDraft({ size: 'all' })}>
                Use all {picks}
              </button>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}
