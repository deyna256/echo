import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full px-3 py-2.5 text-sm rounded-lg resize-y min-h-[80px]
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