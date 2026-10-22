import { forwardRef } from 'react'
import { Image as HeroImage, cn, image, type ImageProps, type InternalForwardRefRenderFunction } from '@heroui/react'

/**
 * The site's image: HeroUI Image without the loading skeleton. HeroUI can miss
 * the load event of an image the browser already has, so the skeleton stayed on:
 * its grey background showed as thin light lines at the image edges, and the
 * image itself stayed hidden (hence opacity-100, which keeps it visible).
 *
 * Without the skeleton HeroUI also drops its wrapper div, and with it
 * classNames.wrapper (grid columns, order, flex): the images shrank to one grid
 * column. So the wrapper is rendered here, with the same classes and max width.
 */
const HouseImage = forwardRef<HTMLImageElement, ImageProps>(function HouseImage(
  { disableSkeleton = true, classNames, ...props },
  ref
) {
  const imgClassNames = { ...classNames, img: cn('opacity-100', classNames?.img) }
  const heroKeepsWrapper =
    !disableSkeleton || props.removeWrapper || props.isZoomed || props.isBlurred || props.fallbackSrc

  if (heroKeepsWrapper) {
    return <HeroImage ref={ref} disableSkeleton={disableSkeleton} classNames={imgClassNames} {...props} />
  }

  const { width } = props
  const maxWidth = width ? (typeof width === 'number' ? `${width}px` : width) : 'fit-content'

  return (
    <div
      className={image({ radius: props.radius, shadow: props.shadow }).wrapper({ class: classNames?.wrapper })}
      style={{ maxWidth }}
    >
      <HeroImage ref={ref} disableSkeleton classNames={imgClassNames} {...props} removeWrapper />
    </div>
  )
})

// Same component, typed like the original Image (as={NextImage}...)
export const Image = HouseImage as unknown as InternalForwardRefRenderFunction<'img', ImageProps>
