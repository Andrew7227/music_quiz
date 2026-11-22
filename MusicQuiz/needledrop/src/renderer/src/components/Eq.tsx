export function Eq({ paused = false, className = '' }: { paused?: boolean; className?: string }) {
  return (
    <span className={`eq ${className}`} aria-hidden="true" style={paused ? { opacity: 0.5 } : undefined}>
      <i />
      <i />
      <i />
    </span>
  )
}
