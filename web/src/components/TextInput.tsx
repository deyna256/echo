import type { InputHTMLAttributes } from 'react'

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function TextInput({ label, error, className = '', ...props }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2.5 text-sm rounded-lg
          bg-surface-elevated border border-border
          text-text-primary placeholder:text-text-muted
          transition-all duration-150
          focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20
          ${error ? 'border-red focus:border-red focus:ring-red/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  )
}

interface DateInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function DateInput({ label, error, className = '', ...props }: DateInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        type="date"
        className={`
          w-full px-3 py-2.5 text-sm rounded-lg
          bg-surface-elevated border border-border
          text-text-primary
          transition-all duration-150
          focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20
          ${error ? 'border-red focus:border-red focus:ring-red/20' : ''}
          ${className}
        `}
        style={{ colorScheme: 'dark' }}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  )
}

interface TimeInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function TimeInput({ label, error, className = '', ...props }: TimeInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        type="time"
        className={`
          w-full px-3 py-2.5 text-sm rounded-lg
          bg-surface-elevated border border-border
          text-text-primary
          transition-all duration-150
          focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20
          ${error ? 'border-red focus:border-red focus:ring-red/20' : ''}
          ${className}
        `}
        style={{ colorScheme: 'dark' }}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  )
}

interface NumberInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function NumberInput({ label, error, className = '', ...props }: NumberInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        type="number"
        className={`
          w-full px-3 py-2.5 text-sm rounded-lg
          bg-surface-elevated border border-border
          text-text-primary placeholder:text-text-muted
          transition-all duration-150
          focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold/20
          ${error ? 'border-red focus:border-red focus:ring-red/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          {error}
        </span>
      )}
    </div>
  )
}