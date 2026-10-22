import { forwardRef } from 'react'
import { Image as HeroImage, cn, type ImageProps, type InternalForwardRefRenderFunction } from '@heroui/react'

/**
 * The site's image: HeroUI Image without the loading skeleton. HeroUI can miss
 * the load event of an image the browser already has, so the skeleton stayed on:
 * its grey background showed as thin light lines at the image edges, and the
 * image itself stayed hidden (hence opacity-100, which keeps it visible).
 */
const HouseImage = forwardRef<HTMLImageElement, ImageProps>(function HouseImage(
  { disableSkeleton = true, classNames, ...props },
  ref
) {
  return (
    <HeroImage
      ref={ref}
      disableSkeleton={disableSkeleton}
      classNames={{ ...classNames, img: cn('opacity-100', classNames?.img) }}
      {...props}
    />
  )
})

// Same component, typed like the original Image (as={NextImage}...)
export const Image = HouseImage as unknown as InternalForwardRefRenderFunction<'img', ImageProps>
