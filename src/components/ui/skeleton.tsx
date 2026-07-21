import { cn } from '../../lib/utils'

/**
 * Shimmer placeholder shown while data loads, so a screen never renders blank/empty while
 * waiting on the backend (which can cold-start). Size/shape it with className, e.g.
 * <Skeleton className="h-4 w-40" /> or <Skeleton className="h-24 w-full rounded-xl" />.
 * Themes with the surface (uses the foreground token at low opacity).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-foreground/[0.08]', className)} />
}

/** A few stacked text lines (last one shorter), for paragraph/detail placeholders. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
