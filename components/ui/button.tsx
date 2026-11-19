import {
  Button as HeroButton,
  extendVariants,
  type ButtonProps as HeroButtonProps,
  type InternalForwardRefRenderFunction,
} from '@heroui/react'

/**
 * The site's button: HeroUI Button with the house defaults, so pages pass
 * props (color, size, variant) instead of repeating classes.
 * - medium weight everywhere (HeroUI default is normal)
 * - color "dark": black button with white text
 * - size "lg": taller button for the main action of a form
 */
const HouseButton = extendVariants(HeroButton, {
  variants: {
    weight: {
      medium: 'font-medium',
    },
    color: {
      dark: 'bg-neutral-900 text-white',
    },
    size: {
      lg: 'px-8',
    },
  },
  defaultVariants: {
    weight: 'medium',
  },
})

export type ButtonProps = Omit<HeroButtonProps, 'color'> & {
  color?: HeroButtonProps['color'] | 'dark'
}

// extendVariants drops HeroUI's polymorphic typing (as={Link} with href, isExternal...):
// same component, typed like the original Button plus the new colour
export const Button = HouseButton as unknown as InternalForwardRefRenderFunction<'button', ButtonProps>
