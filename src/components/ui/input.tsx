import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * shadcn-style Input. A thin, prop-forwarding wrapper over the native <input>
 * (value/onChange/disabled/etc. all pass straight through), styled with the
 * brand tokens so it themes light/dark. Drop-in for existing text inputs.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex w-full rounded-xl border border-foreground/15 bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm transition-colors',
        'placeholder:text-foreground/40',
        'focus:border-accent/40 focus:outline-none focus:ring-2 focus:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
