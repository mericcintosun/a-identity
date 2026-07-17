import * as React from 'react'
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu'
import { cn } from '../../lib/utils'

/**
 * Minimal shadcn-style NavigationMenu (Radix). Used for the landing's top-nav
 * anchor links — gives real keyboard/focus semantics and a <nav> landmark while
 * keeping the existing look. No dropdown Viewport/Indicator (links only).
 */
const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Root ref={ref} className={cn('relative', className)} {...props}>
    {children}
  </NavigationMenuPrimitive.Root>
))
NavigationMenu.displayName = 'NavigationMenu'

const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.List>
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn('flex items-center gap-8', className)}
    {...props}
  />
))
NavigationMenuList.displayName = 'NavigationMenuList'

const NavigationMenuItem = NavigationMenuPrimitive.Item
const NavigationMenuLink = NavigationMenuPrimitive.Link

export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink }
