import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

/**
 * shadcn-style Badge for the console's status pills. Variants cover the palette
 * already in use (accent, neutral, and the semantic success/warning/info/danger
 * states) so pills read the same in light and dark. Presentational only.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none',
  {
    variants: {
      variant: {
        default: 'bg-accent/10 text-accent',
        neutral: 'bg-foreground/8 text-foreground/60',
        outline: 'border border-foreground/15 text-foreground/70',
        success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
        info: 'bg-[#2775CA]/12 text-[#2775CA] dark:text-[#5b9be0]',
        danger: 'bg-red-500/12 text-red-600 dark:text-red-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
