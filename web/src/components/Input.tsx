import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <input
        className={`
          w-full bg-bg border rounded-lg px-3 py-2 text-sm text-text-primary
          placeholder:text-text-muted transition-colors duration-150
          focus:outline-none focus:border-gold
          ${error ? 'border-red' : 'border-border'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          ✕ {error}
        </span>
      )}
    </div>
  )
}

export function Textarea({ label, error, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        className={`
          w-full bg-bg border rounded-lg px-3 py-2 text-sm text-text-primary
          placeholder:text-text-muted transition-colors duration-150 resize-y min-h-[80px]
          focus:outline-none focus:border-gold
          ${error ? 'border-red' : 'border-border'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-red flex items-center gap-1">
          ✕ {error}
        </span>
      )}
    </div>
  )
}
