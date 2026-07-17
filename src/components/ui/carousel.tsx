import * as React from 'react'
import useEmblaCarousel, { type UseEmblaCarouselType } from 'embla-carousel-react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

/**
 * shadcn-style Carousel (Embla). Trimmed to what the landing needs: horizontal
 * scroll-snap, drag, keyboard arrows, and prev/next buttons. Styled with the
 * brand tokens so it fits light and dark.
 */
type CarouselApi = UseEmblaCarouselType[1]
type CarouselOptions = NonNullable<Parameters<typeof useEmblaCarousel>[0]>

type CarouselContextValue = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  api: ReturnType<typeof useEmblaCarousel>[1]
  scrollPrev: () => void
  scrollNext: () => void
  canScrollPrev: boolean
  canScrollNext: boolean
}

const CarouselContext = React.createContext<CarouselContextValue | null>(null)

function useCarousel() {
  const ctx = React.useContext(CarouselContext)
  if (!ctx) throw new Error('useCarousel must be used within a <Carousel />')
  return ctx
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    opts?: CarouselOptions
    setApi?: (api: CarouselApi) => void
  }
>(({ opts, setApi, className, children, ...props }, ref) => {
  const [carouselRef, api] = useEmblaCarousel({ align: 'start', ...opts })
  const [canScrollPrev, setCanScrollPrev] = React.useState(false)
  const [canScrollNext, setCanScrollNext] = React.useState(false)

  const onSelect = React.useCallback((embla: CarouselApi) => {
    if (!embla) return
    setCanScrollPrev(embla.canScrollPrev())
    setCanScrollNext(embla.canScrollNext())
  }, [])

  const scrollPrev = React.useCallback(() => api?.scrollPrev(), [api])
  const scrollNext = React.useCallback(() => api?.scrollNext(), [api])

  React.useEffect(() => {
    if (!api) return
    setApi?.(api)
    onSelect(api)
    api.on('reInit', onSelect).on('select', onSelect)
    return () => {
      api.off('reInit', onSelect).off('select', onSelect)
    }
  }, [api, onSelect, setApi])

  return (
    <CarouselContext.Provider
      value={{ carouselRef, api, scrollPrev, scrollNext, canScrollPrev, canScrollNext }}
    >
      <div
        ref={ref}
        className={cn('relative', className)}
        role="region"
        aria-roledescription="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
})
Carousel.displayName = 'Carousel'

const CarouselContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { carouselRef } = useCarousel()
  return (
    <div ref={carouselRef} className="overflow-hidden">
      <div ref={ref} className={cn('flex', className)} {...props} />
    </div>
  )
})
CarouselContent.displayName = 'CarouselContent'

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    aria-roledescription="slide"
    className={cn('min-w-0 shrink-0 grow-0 basis-full', className)}
    {...props}
  />
))
CarouselItem.displayName = 'CarouselItem'

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { scrollPrev, canScrollPrev } = useCarousel()
  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      shape="pill"
      className={cn('h-10 w-10 disabled:opacity-40', className)}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      aria-label="Previous slide"
      {...props}
    >
      <ArrowLeft size={18} />
    </Button>
  )
})
CarouselPrevious.displayName = 'CarouselPrevious'

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => {
  const { scrollNext, canScrollNext } = useCarousel()
  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      shape="pill"
      className={cn('h-10 w-10 disabled:opacity-40', className)}
      disabled={!canScrollNext}
      onClick={scrollNext}
      aria-label="Next slide"
      {...props}
    >
      <ArrowRight size={18} />
    </Button>
  )
})
CarouselNext.displayName = 'CarouselNext'

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
}
