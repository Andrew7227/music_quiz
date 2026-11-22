import type { ReactNode } from 'react'

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-marigold px-5 py-2.5 text-sm font-semibold text-night transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-full border border-line px-4 py-2 text-sm text-bone transition hover:bg-plum-hi disabled:opacity-40'

export function Spinner({ className = 'size-4' }: { className?: string }) {
  return <span role="status" aria-label="Loading" className={`${className} inline-block animate-spin rounded-full border-2 border-bone/25 border-t-bone`} />
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  const color = tone === 'error' ? 'border-rose/40 bg-rose/10 text-rose' : 'border-line bg-plum text-mist'
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${color}`}>
      {children}
    </p>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="max-w-sm">
        <p className="font-display text-xl text-bone">{title}</p>
        {children && <p className="mt-2 text-sm text-mist">{children}</p>}
      </div>
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-bone">{title}</h1>
      {children && <p className="mt-2 max-w-xl text-mist">{children}</p>}
    </header>
  )
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-10 py-8">{children}</div>
}
