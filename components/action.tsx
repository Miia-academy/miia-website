import type { Action as ActionBlok } from '@types'
import { Button, Link } from '@heroui/react'
import { compiler } from 'markdown-to-jsx'
import { storyblokEditable } from '@storyblok/react'
import { Typography } from './typography'
import { usePathname } from 'next/navigation'

interface ActionComponentProps {
  blok: ActionBlok
  parent?: string
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Utility per costruire in modo sicuro la destinazione dell'href
 */
function resolveLink(linkBlok: any, currentPathname: string): string {
  if (!linkBlok) return '#'

  let targetUrl = linkBlok.url || (linkBlok.cached_url ? `/${linkBlok.cached_url}` : '#')

  if (typeof linkBlok.anchor === 'string' && linkBlok.anchor.trim() !== '') {
    const cleanAnchor = linkBlok.anchor.replaceAll(' ', '-')
    const isCurrentPage = targetUrl === currentPathname || targetUrl === `${currentPathname}/`

    targetUrl = isCurrentPage ? `#${cleanAnchor}` : `${targetUrl}#${cleanAnchor}`
  }

  return targetUrl
}

export default function Action({ blok, parent, size }: ActionComponentProps) {
  const pathname = usePathname() || ''
  const href = resolveLink(blok.link, pathname)

  const isSection = parent === 'section'

  // Label sicura per il compilatore Markdown
  const labelText = typeof blok.label === 'string' && blok.label.trim() !== '' ? blok.label : 'Azione'
  const Label = compiler(labelText, {
    wrapper: null,
    overrides: Typography({}),
  })

  // Pulsante HeroUI
  if (blok.button) {
    const buttonElement = (
      <Button
        id={typeof blok.id === 'string' ? blok.id : undefined}
        href={href}
        as={Link}
        size={size}
        isExternal={!!blok.external}
        color={(blok.color as any) || 'default'}
        className="col-auto text-medium font-medium min-w-fit cursor-pointer gap-2"
        {...storyblokEditable(blok as any)}
      >
        {Label}
      </Button>
    )

    return isSection ? <div className="col-span-12">{buttonElement}</div> : buttonElement
  }

  // Link semplice HeroUI
  const linkElement = (
    <Link
      className="col-auto font-medium min-w-fit cursor-pointer gap-2"
      href={href}
      isExternal={!!blok.external}
      color={(blok.color as any) || 'foreground'}
      size={size || 'md'}
      {...storyblokEditable(blok as any)}
    >
      {Label}
    </Link>
  )

  return isSection ? <div className="col-span-12">{linkElement}</div> : linkElement
}