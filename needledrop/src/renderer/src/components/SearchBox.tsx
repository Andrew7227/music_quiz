import { Icon } from './icons'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  autoFocus?: boolean
}

export function SearchBox({ value, onChange, placeholder, label, autoFocus }: Props) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-mist" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-line bg-plum py-3 pr-5 pl-11 text-sm text-bone placeholder:text-mist/70 focus:border-marigold focus:outline-none"
      />
    </label>
  )
}
