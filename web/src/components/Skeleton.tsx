interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circle' | 'rect'
  width?: string | number
  height?: string | number
}

export function Skeleton({
  className = '',
  variant = 'rect',
  width,
  height,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-surface-elevated'

  const variantStyles = {
    text: 'h-3 rounded',
    circle: 'rounded-full',
    rect: 'rounded-lg',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = typeof width === 'number' ? `${width}px` : width
  if (height) style.height = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
    />
  )
}

export function GoalCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start gap-3 mb-4">
        <Skeleton variant="circle" width={32} height={32} />
        <div className="flex-1">
          <Skeleton variant="text" width="70%" className="mb-2" />
          <Skeleton variant="text" width="90%" className="mb-1" />
          <Skeleton variant="text" width="50%" />
        </div>
      </div>
      <Skeleton variant="rect" height={4} className="mb-3" />
      <div className="flex gap-3">
        <Skeleton variant="text" width={60} />
        <Skeleton variant="text" width={80} />
      </div>
    </div>
  )
}
