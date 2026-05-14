import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

export function Card({ children, className = '', padding = 'md', hover = false, onClick }: CardProps) {
  const paddingStyles = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  }

  return (
    <div
      onClick={onClick}
      className={`
        bg-surface border border-border rounded-xl
        ${paddingStyles[padding]}
        ${hover && onClick ? 'cursor-pointer transition-all duration-150 hover:border-gold/40 hover:bg-surface-elevated' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}