import { Page, PageHeader } from '@/components/ui'

const COPY: Record<string, { title: string; body: string }> = {
  collections: { title: 'Collections', body: 'Save your favorite artists, albums and songs into named collections and use them in any game. Arrives in the next update.' },
  multiplayer: { title: 'Multiplayer', body: 'Create a room, share a code, and play with friends on their own computers, with scores kept by a server. Needs the online backend, which comes after the single-player games.' },
  profile: { title: 'Profile', body: 'Stats, achievements and game history across your computers. Comes with accounts, after multiplayer.' }
}

export function Soon({ page }: { page: 'collections' | 'multiplayer' | 'profile' }) {
  const c = COPY[page] as { title: string; body: string }
  return (
    <Page>
      <PageHeader title={c.title}>{c.body}</PageHeader>
    </Page>
  )
}
