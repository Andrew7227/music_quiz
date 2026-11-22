import type { Track } from '@shared/types'
import { hasPreview } from '@shared/types'
import { normalizeText, simplifyTitle } from '@shared/text'

const loose = (a: string, b: string): boolean => a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a))

/**
 * Picks the candidate that is most likely the same recording as `target`, among
 * candidates that actually have audio. Returns null rather than guessing: a wrong
 * song in a tournament is worse than "preview unavailable".
 */
export function pickBestMatch(candidates: readonly Track[], target: Track): Track | null {
  const wantTitle = simplifyTitle(target.title)
  const wantArtist = normalizeText(target.artist)
  let best: { track: Track; score: number } | null = null

  for (const c of candidates) {
    if (!hasPreview(c)) continue
    const title = simplifyTitle(c.title)
    const artist = normalizeText(c.artist)
    const titleScore = title === wantTitle ? 3 : loose(title, wantTitle) ? 1 : 0
    const artistScore = artist === wantArtist ? 2 : loose(artist, wantArtist) ? 1 : 0
    if (titleScore === 0 || artistScore === 0) continue

    const diff = Math.abs(c.durationMs - target.durationMs)
    const known = c.durationMs > 0 && target.durationMs > 0
    const durationScore = !known ? 0 : diff <= 3000 ? 1 : diff <= 8000 ? 0.5 : 0
    // A partial title match ("Love" inside "Love Story") needs the length to agree.
    if (titleScore === 1 && durationScore < 0.5) continue

    const score = titleScore + artistScore + durationScore
    if (!best || score > best.score) best = { track: c, score }
  }
  return best?.track ?? null
}
