/** Small, dependency-free text helpers shared by main and renderer. */

export function fnv1a(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Lowercase, strip diacritics and punctuation, collapse whitespace. Keeps non-Latin letters. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Normalizes a song title for matching: drops "(feat. X)", "[Remastered 2011]",
 * "- Single Version" and similar suffixes that differ between providers.
 */
export function simplifyTitle(title: string): string {
  const stripped = title
    .replace(/\s*[([][^)\]]*\b(feat\.?|ft\.?|featuring|remaster(?:ed)?|version|edit|mono|stereo|deluxe|bonus)\b[^)\]]*[)\]]/gi, '')
    .replace(/\s+-\s+.*\b(remaster(?:ed)?|version|edit|mono|stereo|single)\b.*$/i, '')
  const out = normalizeText(stripped)
  return out || normalizeText(title)
}

/** Internal track id: stable across providers whenever artist and title agree. */
export function trackIdFor(artist: string, title: string): string {
  const a = normalizeText(artist) || artist
  return `trk_${fnv1a(`${a}|${simplifyTitle(title)}`)}`
}
