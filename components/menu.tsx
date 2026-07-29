import type { Menu as MenuBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Link,
} from '@heroui/react'
import { tv } from 'tailwind-variants'

interface MenuComponentProps {
  blok: MenuBlok
  isOpen?: boolean
  handleOpen?: () => void
  parent?: string
}

// 1. Spostiamo le configurazioni Tailwind Variants FUORI dal render
const buttonClasses = tv({
  base: 'inline-flex items-center gap-1 font-medium hover:opacity-80 active:opacity-disabled transition-opacity text-foreground text-right',
  variants: {
    isOpen: {
      true: 'opacity-30 hover:opacity-30',
    },
  },
})

const submenuClasses = tv({
  base: 'z-50 overflow-hidden md:overflow-visible whitespace-nowrap md:absolute top-full md:bottom-0 md:right-0 md:left-0 py-0 text-foreground flex flex-col md:flex-row items-end md:items-center justify-center md:justify-start max-md:[&>a]:self-end md:[&>a]:self-center gap-6 invisible opacity-0 h-0 transition-all duration-150 ease-in-out',
  variants: {
    isOpen: {
      true: 'py-2 md:p-0 visible opacity-100 h-full md:h-10 transition-all duration-250 ease-in-out delay-75',
    },
  },
})

export default function Menu({
  blok,
  isOpen = false,
  handleOpen,
  parent,
}: MenuComponentProps) {
  // Fallback di sicurezza per prevenire errori se la lista è vuota
  const links = blok.links || []

  if (blok.inline) {
    return (
      <div
        {...storyblokEditable(blok as any)}
        className="flex flex-wrap gap-x-2 gap-y-4"
      >
        {links.map((link: any) => (
          <StoryblokComponent
            blok={link}
            key={link._uid}
            theme="default"
            size="sm"
          />
        ))}
      </div>
    )
  }

  if (parent === 'header') {
    return (
      <>
        <button
          className={buttonClasses({ isOpen })}
          onClick={() => handleOpen && handleOpen()}
        >
          {blok.title}
          <i
            className={`-order-1 md:order-none iconoir-nav-arrow-${isOpen ? 'down' : 'up'}`}
          />
        </button>

        <div className={submenuClasses({ isOpen })}>
          {links.map((link: any) => (
            <StoryblokComponent blok={link} size="sm" key={link._uid} />
          ))}
        </div>
      </>
    )
  }

  if (parent === 'footer') {
    return (
      <div className="flex-none" {...storyblokEditable(blok as any)}>
        {blok.title && (
          <>
            <p className="text-lg font-medium mb-2">{blok.title}</p>
            <hr className="opacity-10 mb-4" />
          </>
        )}

        <ul className={`space-y-2 ${blok.title ? '' : 'mt-12'}`}>
          {links.map((link: any) => (
            <li key={link._uid}>
              <StoryblokComponent blok={link} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    )
  }
}