import type { Location as LocationBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { tv } from 'tailwind-variants'
import Link from 'next/link'
import { storyblokEditable } from '@storyblok/react'
import { resolveAlias } from '@modules/relations'

interface LocationComponentProps {
  blok: LocationBlok
  story?: ISbStoryData<LocationBlok>
}

// Spostiamo la configurazione delle classi all'esterno del componente
const containerClasses = tv({
  base: 'col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 block',
})

export default function Location({ blok, story }: LocationComponentProps) {
  // 1. Risoluzione safe del pattern Alias/Mirror
  const { content: location } = resolveAlias<LocationBlok>(
    blok.alias as ISbStoryData<LocationBlok> | string | undefined,
    blok,
    story?.full_slug
  )

  if (!location.title || !location.address) return null

  // 2. Isoliamo il contenuto interno per il principio DRY (Don't Repeat Yourself)
  const innerContent = (
    <>
      <h5 className="font-semibold leading-snug text-xl">{location.title}</h5>
      <p className="text-sm">{location.address}</p>
    </>
  )

  // 3. Gestione sicura dell'URL
  // (Prevede sia che il campo sia una stringa, sia che sia un oggetto Multilink di Storyblok)
  const href =
    typeof location.direction === 'string'
      ? location.direction
      : (location.direction as any)?.cached_url || (location.direction as any)?.url

  // 4. Rendering condizionale senza ricreare componenti al volo
  if (href) {
    return (
      <Link
        href={href}
        className={containerClasses()}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...storyblokEditable(blok as any)}
      >
        {innerContent}
      </Link>
    )
  }

  return (
    <div className={containerClasses()} {...storyblokEditable(blok as any)}>
      {innerContent}
    </div>
  )
}