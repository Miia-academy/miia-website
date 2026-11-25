import { useEffect, useState } from 'react'
import type { Alias as AliasBlok } from '@types'
import { storyblokEditable } from '@storyblok/react'
import { Image } from '@components/ui/image'
import { responsiveImage } from '@modules/images'
import NextLink from 'next/link'
import { useDataContext } from '@modules/context'
import type { ProcessedArticle, ProcessedEvent } from '@modules/cache'
import NextEvent from './next-event'

interface AliasComponentProps {
  blok: AliasBlok
  parent?: string
}

// Helper per pulire gli slug ed evitare doppi slash (//)
const getCleanUrl = (url?: string | null): string | null => {
  if (!url || url === '#') return null
  return `/${url.replace(/^\/+/, '')}`
}

export default function Alias({ blok }: AliasComponentProps) {
  const { articles, events, persons } = useDataContext()

  const isArticle = blok.resource === 'last-article'
  const isEvent = blok.resource === 'next-event'

  const [selectedEvent, setSelectedEvent] = useState<ProcessedEvent | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<ProcessedArticle | null>(null)
  const [isClientReady, setIsClientReady] = useState(false)

  useEffect(() => {
    if (isEvent) {
      const now = new Date()

      const upcomingEvent = events
        .filter((ev) => {
          if (!ev.date) return false
          return blok.filter ? ev.name?.includes(blok.filter) : true
        })
        .sort((a, b) => {
          const dateA = new Date(a.date || 0).getTime()
          const dateB = new Date(b.date || 0).getTime()
          return dateA - dateB
        })
        .find((ev) => new Date(ev.date || 0) >= now)

      setSelectedEvent(upcomingEvent || null)
    }

    if (isArticle) {
      // Article chosen in Storyblok ("articolo" field, a story uuid or a resolved story);
      // when empty or not found (e.g. unpublished), fall back to the latest article.
      const chosen = blok.articolo
      const chosenUuid = typeof chosen === 'string' ? chosen : chosen?.uuid
      const pinned = chosenUuid ? articles.find((a) => a.uuid === chosenUuid) : undefined
      setSelectedArticle(pinned || articles[0] || null)
    }

    setIsClientReady(true)
  }, [events, articles, isEvent, isArticle, blok.filter, blok.articolo])

  if (!isClientReady) return null

  if (isEvent && selectedEvent && selectedEvent.date) {
    return <NextEvent blok={blok} event={selectedEvent} persons={persons} />
  }

  if (isArticle && selectedArticle) {
    const articleSlug = getCleanUrl(selectedArticle.fullSlug || selectedArticle.slug) || '#'

    return (
      <article
        {...storyblokEditable(blok as any)}
        className="col-span-12 grid grid-cols-12 gap-6 items-center w-full"
      >
        {selectedArticle.image?.filename && (
          <div className="col-span-12 md:col-span-5 lg:col-span-5">
            <NextLink href={articleSlug} className="block w-full overflow-hidden rounded-xl">
              <Image
                classNames={{
                  wrapper: 'w-full aspect-[16/10] overflow-hidden rounded-xl',
                  img: 'w-full h-full object-cover',
                }}
                {...responsiveImage(selectedArticle.image.filename, '(min-width: 768px) 58vw, 100vw')}
                alt={selectedArticle.image.alt || selectedArticle.title || ''}
                radius="lg"
              />
            </NextLink>
          </div>
        )}

        <div
          className={`col-span-12 ${selectedArticle.image?.filename ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-12'
            } space-y-4`}
        >
          <NextLink
            href={articleSlug}
            className="inline-block space-y-3 transition-opacity hover:opacity-85"
          >
            <h4 className="font-serif type-title-3">
              {selectedArticle.title}
            </h4>
          </NextLink>

          <p className="text-sm sm:text-base text-neutral-300 line-clamp-3 md:line-clamp-none font-sans leading-relaxed">
            {selectedArticle.description}
          </p>

          <div className="pt-2">
            <NextLink
              href={articleSlug}
              className="inline-flex rounded-xl border-2 border-foreground px-4 py-2 text-sm font-medium transition-all hover:bg-foreground hover:text-background"
            >
              Leggi articolo
            </NextLink>
          </div>
        </div>
      </article>
    )
  }

  return null
}