import type { ReactNode } from 'react'

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex bg-surface-elevated rounded-lg p-1 gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-150
            ${value === option.value
              ? 'bg-gold text-bg'
              : 'text-text-muted hover:text-text-secondary'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}