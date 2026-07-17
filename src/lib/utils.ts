import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class strings with correct precedence (clsx for conditionals,
 * tailwind-merge to dedupe conflicting utilities). The standard shadcn/ui helper.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
