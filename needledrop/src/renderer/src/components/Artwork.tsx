import { useEffect, useState } from 'react'
import { hueFor, initials } from '@/lib/format'

interface Props {
  src: string | null | undefined
  /** Describes the image. Leave empty when the title is shown right next to it. */
  alt?: string
  /** Used to colour the fallback tile when there is no image. */
  seed?: string
  className?: string
  round?: boolean
}

export function Artwork({ src, alt = '', seed, className = '', round = false }: Props) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  const shape = round ? 'rounded-full' : 'rounded-md'

  if (!src || failed) {
    const label = seed ?? alt
    const hue = hueFor(label)
    return (
      <div
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
        className={`${className} ${shape} grid place-items-center overflow-hidden`}
        style={{ background: `linear-gradient(135deg, hsl(${hue} 42% 34%), hsl(${(hue + 55) % 360} 48% 20%))` }}
      >
        <span className="font-display text-[1.4em] text-bone/70">{initials(label)}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={`${className} ${shape} object-cover`}
    />
  )
}
