import type { ReactNode } from 'react'

const paths = {
  home: <path d="M3 11l9-8 9 8M5 10v10h14V10" />,
  games: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </>
  ),
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  library: <path d="M5 4v16M10 4v16M15 5.5l4 14" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M17 14c2.8.2 4.5 2 4.5 5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  play: <path d="M7 4.5v15l13-7.5z" />,
  pause: <path d="M6 4h4v16H6zM14 4h4v16h-4z" />,
  replay: <path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5" />,
  volume: <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 0 1 0 7" />,
  mute: <path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12l5 5 9-10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  bracket: <path d="M3 5h6v4H3zM3 15h6v4H3zM15 10h6v4h-6zM9 7h3v10H9M12 12h3" />,
  skip: <path d="M5 5l10 7-10 7zM19 5v14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  back: <path d="M15 5l-7 7 7 7" />
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof paths

export function Icon({ name, className = 'size-5' }: { name: IconName; className?: string }) {
  const filled = name === 'play' || name === 'pause'
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}
