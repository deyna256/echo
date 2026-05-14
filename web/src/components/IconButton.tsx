import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  variant?: 'ghost' | 'filled' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function IconButton({
  icon: Icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  ...props
}: IconButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

  const variantStyles = {
    ghost: 'bg-transparent text-text-muted hover:text-text-primary hover:bg-surface-elevated',
    filled: 'bg-surface-elevated text-text-secondary hover:text-gold hover:border hover:border-gold/40',
    outline: 'bg-transparent text-text-muted border border-border hover:border-gold/40 hover:text-gold',
  }

  const sizeStyles = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  }

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 18,
  }

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <Icon size={iconSizes[size]} />
    </button>
  )
}