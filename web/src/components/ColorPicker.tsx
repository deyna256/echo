interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  palette?: string[]
}

const DEFAULT_PALETTE = [
  '#c4913a',
  '#4daa74',
  '#d95b5b',
  '#5b8dd9',
  '#8b6dd9',
  '#d96b8b',
  '#4daaaa',
  '#c87d4a',
]

export function ColorPicker({ value, onChange, palette = DEFAULT_PALETTE }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        Color
      </label>
      <div className="flex gap-2 flex-wrap">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(value === color ? '' : color)}
            className={`
              w-7 h-7 rounded-full transition-all duration-100
              hover:scale-110 hover:ring-2 hover:ring-white/20 hover:ring-offset-2 hover:ring-offset-bg
              focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-bg
              ${value === color ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-bg' : ''}
            `}
            style={{ backgroundColor: color }}
          />
        ))}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-surface-elevated border border-border text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  )
}