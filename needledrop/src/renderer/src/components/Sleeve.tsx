import type { CSSProperties } from 'react'
import { Artwork } from './Artwork'

interface Props {
  src: string | null
  title: string
  /** Side A slides its record out to the right, Side B to the left (toward the middle of a match). */
  side: 'a' | 'b'
  playing: boolean
  className?: string
}

/** Album artwork as a record sleeve; the disc slides out and spins while the song plays. */
export function Sleeve({ src, title, side, playing, className = '' }: Props) {
  const style = {
    '--slide': side === 'a' ? '34%' : '-34%',
    '--label': side === 'a' ? 'var(--color-marigold)' : 'var(--color-lagoon)'
  } as CSSProperties
  return (
    <div className={`relative isolate aspect-square ${className}`} style={style}>
      <div className="vinyl" data-out={playing} data-spin={playing} aria-hidden="true">
        <div className="vinyl-disc" />
      </div>
      <Artwork src={src} alt="" seed={title} className="relative z-10 size-full shadow-[0_18px_50px_rgb(0_0_0/0.55)]" />
    </div>
  )
}
