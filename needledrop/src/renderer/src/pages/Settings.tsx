import { useEffect } from 'react'
import { btnGhost, Page, PageHeader } from '@/components/ui'
import { useAsyncData } from '@/lib/useAsyncData'
import { plural } from '@/lib/format'
import { useHistory } from '@/stores/history'
import { useSettings } from '@/stores/settings'

const COUNTRIES: Array<[string, string]> = [
  ['US', 'United States'], ['GB', 'United Kingdom'], ['CA', 'Canada'], ['AU', 'Australia'], ['DE', 'Germany'], ['FR', 'France'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['PL', 'Poland'], ['UA', 'Ukraine'], ['SE', 'Sweden'],
  ['BR', 'Brazil'], ['MX', 'Mexico'], ['JP', 'Japan'], ['KR', 'South Korea']
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-6">
      <h2 className="mb-4 font-display text-xl font-semibold">{title}</h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-start justify-between gap-6 ${disabled ? 'opacity-60' : ''}`}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block max-w-md text-xs text-mist">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-marigold" />
    </label>
  )
}

export function Settings() {
  const s = useSettings()
  const records = useHistory((h) => h.records.length)
  const clearHistory = useHistory((h) => h.clear)
  const info = useAsyncData(() => window.api.app.getInfo(), [])

  // Keep the main process in sync with the music source settings.
  useEffect(() => {
    void window.api.music.configure({ providers: s.providers, itunesCountry: s.itunesCountry })
  }, [s.providers, s.itunesCountry])

  const onlyOne = Number(s.providers.deezer) + Number(s.providers.itunes) === 1

  return (
    <Page>
      <PageHeader title="Settings" />
      <Section title="Audio">
        <label className="flex items-center justify-between gap-6">
          <span className="text-sm font-medium">Volume</span>
          <input type="range" min={0} max={1} step={0.01} value={s.muted ? 0 : s.volume} onChange={(e) => s.setVolume(Number(e.target.value))} aria-label="Volume" className="w-64" />
        </label>
        <Toggle label="Play both songs automatically" hint="In a tournament match, Side A plays and then Side B follows. Turn off to start each song yourself." checked={s.autoplayBoth} onChange={s.setAutoplayBoth} />
      </Section>

      <Section title="Music sources">
        <Toggle label="Deezer" hint="Main source. Search, artwork, charts and 30-second previews. No account needed." checked={s.providers.deezer} disabled={onlyOne && s.providers.deezer} onChange={(v) => s.setProvider('deezer', v)} />
        <Toggle label="Apple iTunes" hint="Backup source. Adds a second preview for songs and finds previews Deezer is missing." checked={s.providers.itunes} disabled={onlyOne && s.providers.itunes} onChange={(v) => s.setProvider('itunes', v)} />
        <label className="flex items-center justify-between gap-6">
          <span>
            <span className="block text-sm font-medium">iTunes store country</span>
            <span className="mt-0.5 block text-xs text-mist">Which regional catalog iTunes searches.</span>
          </span>
          <select value={s.itunesCountry} onChange={(e) => s.setItunesCountry(e.target.value)} className="rounded-lg border border-line bg-plum px-3 py-2 text-sm text-bone focus:border-marigold focus:outline-none">
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-mist">At least one source stays on. Previews are 30 seconds long, which is all these services provide for free.</p>
      </Section>

      <Section title="Window">
        <div className="flex items-center justify-between gap-6">
          <span className="text-sm font-medium">Fullscreen (F11)</span>
          <button type="button" className={btnGhost} onClick={() => void window.api.app.toggleFullscreen()}>
            Toggle fullscreen
          </button>
        </div>
      </Section>

      <Section title="Your data">
        <div className="flex items-center justify-between gap-6">
          <span>
            <span className="block text-sm font-medium">Tournament history</span>
            <span className="mt-0.5 block text-xs text-mist">Saved on this computer. {plural(records, 'finished tournament')}.</span>
          </span>
          <button type="button" className={btnGhost} disabled={records === 0} onClick={clearHistory}>
            Clear history
          </button>
        </div>
      </Section>

      <Section title="About">
        <p className="text-sm text-mist">
          Needledrop {info.data ? info.data.version : ''}
          {info.data && !info.data.packaged ? ' (development build)' : ''}
        </p>
      </Section>
    </Page>
  )
}
