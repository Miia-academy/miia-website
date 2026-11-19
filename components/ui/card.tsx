import { forwardRef } from 'react'
import { Card as HeroCard, cn, type CardProps, type InternalForwardRefRenderFunction } from '@heroui/react'

/**
 * The site's card: HeroUI Card with the house defaults (light shadow and a
 * thin grey border), so pages don't repeat shadow="sm" and border classes.
 * bordered={false} drops the border, e.g. on cards with a photo background.
 */
const HouseCard = forwardRef<HTMLDivElement, CardProps & { bordered?: boolean }>(function HouseCard(
  { shadow = 'sm', bordered = true, className, ...props },
  ref
) {
  return <HeroCard ref={ref} shadow={shadow} className={cn(bordered && 'border border-neutral-200', className)} {...props} />
})

// Same component, typed like the original Card (as={Link} with href...) plus the border switch
export const Card = HouseCard as unknown as InternalForwardRefRenderFunction<'div', CardProps & { bordered?: boolean }>
