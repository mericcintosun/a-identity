import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from './ThemeProvider'

/**
 * Light/dark switch for the landing nav. Ghost icon button; crossfades a
 * Sun/Moon (lucide) so it reads instantly in either theme.
 */
export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={className}
    >
      <span className="relative grid h-5 w-5 place-items-center">
        <Sun
          size={18}
          className={`absolute transition-all duration-300 ${
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
          }`}
        />
        <Moon
          size={18}
          className={`absolute transition-all duration-300 ${
            isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
          }`}
        />
      </span>
    </Button>
  )
}
