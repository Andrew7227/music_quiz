export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatDuration(ms: number): string {
  return ms > 0 ? formatTime(ms / 1000) : '–'
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  if (m === 0) return `${s}\u00a0s`
  return `${m}\u00a0min ${s}\u00a0s`
}

export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatDay(ts: number): string {
  return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' }).format(ts)
}

export function hueFor(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
  return h
}

export function initials(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '♪'
}
