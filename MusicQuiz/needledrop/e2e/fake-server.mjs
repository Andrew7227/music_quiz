// A local HTTPS server that imitates the response shapes of the Deezer and iTunes APIs,
// plus tiny WAV "previews" and SVG covers. Used only by the e2e run: it proves our code
// drives the app correctly, NOT that the live APIs still look like this.
import https from 'node:https'

const WORDS = ['Midnight Static', 'Paper Moons', 'Low Tide', 'Afterglow', 'Hollow Bells', 'Signal Fire']
export const ARTISTS = [
  { id: 1, name: 'Neon Harbor', fans: 1234567 },
  { id: 2, name: 'Glass Orchard', fans: 88000 },
  { id: 3, name: 'Glitch Parade', fans: 4200 }
]
export const NO_PREVIEW = 105 // Deezer has no preview at all
export const BROKEN_NO_FALLBACK = 206 // preview URL 404s, iTunes has nothing
export const BROKEN_WITH_FALLBACK = 306 // preview URL 404s, iTunes has a working one

export async function startFakeServer({ key, cert }) {
  const hits = new Map()
  let base = ''
  const bump = (k) => hits.set(k, (hits.get(k) ?? 0) + 1)

  const cover = (seed) => `${base}/img/${seed}.svg`
  const dzArtist = (a) => ({ id: a.id, name: a.name, nb_fan: a.fans, picture_big: cover(`artist-${a.id}`) })
  const dzAlbum = (id, title, artistId) => ({ id, title, cover_big: cover(`album-${id}`), release_date: '2019-05-17', nb_tracks: 5, artist: dzArtist(ARTISTS[artistId - 1]) })
  let allTracks = []
  const buildTracks = () => ARTISTS.flatMap((a) =>
    WORDS.map((title, i) => {
      const id = a.id * 100 + i + 1
      const preview = id === NO_PREVIEW ? '' : id === BROKEN_NO_FALLBACK || id === BROKEN_WITH_FALLBACK ? `${base}/audio/missing-${id}.wav` : `${base}/audio/${id}.wav`
      return { id, title, duration: 30, rank: id * 1000, explicit_lyrics: false, preview, isrc: `FAKE${id}`, release_date: '2019-05-17', artist: dzArtist(a), album: dzAlbum(10 + a.id, `Album ${a.id}`, a.id) }
    })
  )
  const album11 = () => ({ ...dzAlbum(11, 'Midnight Static', 1), tracks: { data: allTracks.filter((t) => t.artist.id === 1).slice(0, 5).map(({ album, ...t }) => t) } })

  const match = (q, ...fields) => !q || fields.some((f) => f.toLowerCase().includes(q.toLowerCase()))
  const dz = (path, p) => {
    const q = p.get('q') ?? ''
    if (path === '/search/track') return { data: allTracks.filter((t) => match(q, t.title, t.artist.name)).slice(0, Number(p.get('limit') ?? 25)) }
    if (path === '/search/artist') return { data: ARTISTS.filter((a) => match(q, a.name)).map(dzArtist) }
    if (path === '/search/album') return { data: [album11()].filter((a) => match(q, a.title, a.artist.name)).map(({ tracks, ...a }) => a) }
    if (path === '/chart/0/tracks') return { data: allTracks.filter((t) => t.id !== NO_PREVIEW).slice(0, Number(p.get('limit') ?? 20)) }
    let m = path.match(/^\/artist\/(\d+)\/top$/)
    if (m) return { data: allTracks.filter((t) => t.artist.id === Number(m[1])).slice(0, Number(p.get('limit') ?? 5)) }
    m = path.match(/^\/album\/11$/)
    if (m) return album11()
    m = path.match(/^\/track\/(\d+)$/)
    if (m) return allTracks.find((t) => t.id === Number(m[1])) ?? { error: { type: 'DataException', message: 'no data', code: 800 } }
    return { error: { type: 'DataException', message: 'no data', code: 800 } }
  }

  const itunes = (path, p) => {
    if (path === '/search') {
      const term = p.get('term') ?? ''
      bump(`itunes-search:${term}`)
      // Only knows the "broken with fallback" song, under a different provider id and a working preview.
      const t = allTracks.find((x) => x.id === BROKEN_WITH_FALLBACK)
      const hit = term.toLowerCase().includes(t.artist.name.toLowerCase()) && term.toLowerCase().includes(t.title.toLowerCase())
      return { resultCount: hit ? 1 : 0, results: hit ? [{ wrapperType: 'track', kind: 'song', trackId: 9306, trackName: t.title, artistName: t.artist.name, collectionName: 'Album 3', previewUrl: `${base}/audio/it-306.wav`, artworkUrl100: `${base}/img/it-306.svg`, trackTimeMillis: 30000, releaseDate: '2019-05-17T07:00:00Z' }] : [] }
    }
    return { resultCount: 0, results: [] }
  }

  const wav = (id) => {
    const rate = 22050
    const n = Math.floor(rate * (id % 100 === 1 ? 4 : 0.8))
    const buf = Buffer.alloc(44 + n * 2)
    buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8)
    buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
    buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
    buf.write('data', 36); buf.writeUInt32LE(n * 2, 40)
    const f = 220 + (id % 9) * 45
    for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * f * i) / rate) * 6000), 44 + i * 2)
    return buf
  }

  const svg = (seed) => {
    let h = 0
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 360
    return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 70% 55%)"/><stop offset="1" stop-color="hsl(${(h + 70) % 360} 65% 28%)"/></linearGradient></defs><rect width="500" height="500" fill="url(#g)"/><circle cx="250" cy="250" r="130" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="14"/></svg>`
  }

  const server = https.createServer({ key, cert }, (req, res) => {
    const url = new URL(req.url, 'https://x')
    const send = (body, type, status = 200) => {
      res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), 'Access-Control-Allow-Origin': '*' })
      res.end(body)
    }
    bump(url.pathname)
    let m
    if (url.pathname.startsWith('/deezer/')) return send(JSON.stringify(dz(url.pathname.slice(7), url.searchParams)), 'application/json')
    if (url.pathname.startsWith('/itunes/')) return send(JSON.stringify(itunes(url.pathname.slice(7), url.searchParams)), 'text/javascript')
    if ((m = url.pathname.match(/^\/audio\/it-(\d+)\.wav$/))) return send(wav(Number(m[1])), 'audio/wav')
    if ((m = url.pathname.match(/^\/audio\/(\d+)\.wav$/))) return send(wav(Number(m[1])), 'audio/wav')
    if ((m = url.pathname.match(/^\/img\/(.+)\.svg$/))) return send(svg(m[1]), 'image/svg+xml')
    return send('not found', 'text/plain', 404)
  })

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `https://127.0.0.1:${server.address().port}`
  allTracks = buildTracks()
  return { base, hits, close: () => new Promise((resolve) => server.close(resolve)) }
}
