import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'gold' | 'green' | 'red' | 'blue'
  size?: 'sm' | 'md'
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-surface-elevated text-text-secondary border-border',
    gold: 'bg-gold-dim text-gold border-gold-border',
    green: 'bg-green-dim text-green border-green/30',
    red: 'bg-red-dim text-red border-red/30',
    blue: 'bg-blue-dim text-blue border-blue/30',
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  }

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${variantStyles[variant]}
        ${sizeStyles[size]}
      `}
    >
      {children}
    </span>
  )
}