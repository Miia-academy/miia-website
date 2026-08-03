import { useEffect, useState } from 'react'
import type {
  Alias as AliasBlok,
  Article as ArticleBlok,
  Event as EventBlok,
  Form as FormBlok,
} from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'
import { Image } from '@heroui/react'
import NextLink from 'next/link'
import { tv } from 'tailwind-variants'
import { useDataContext } from '@modules/context'
import type { ProcessedArticle, ProcessedEvent } from '@modules/cache'

interface AliasComponentProps {
  blok: AliasBlok
  parent?: string
}

export default function Alias({ blok }: AliasComponentProps) {
  // 1. Dati globali estratti istantaneamente dal Context (Zero chiamate di rete)
  const { articles, events } = useDataContext()

  const isArticle = blok.resource === 'last-article'
  const isEvent = blok.resource === 'next-event'

  const [selectedEvent, setSelectedEvent] = useState<ProcessedEvent | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<ProcessedArticle | null>(null)
  const [isClientReady, setIsClientReady] = useState(false)

  useEffect(() => {
    // 2. Calcolo puramente client-side per evitare mismatch di timezone / cache stale ISR
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
      // Prende l'articolo più recente (gli articoli sono già ordinati per data in cache)
      setSelectedArticle(articles[0] || null)
    }

    setIsClientReady(true)
  }, [events, articles, isEvent, isArticle, blok.filter])

  if (!isClientReady) return null

  if (isEvent && selectedEvent && selectedEvent.date) {
    const eventDate = new Date(selectedEvent.date)

    const openday = {
      id: 'openday',
      value: eventDate.toISOString(),
      required: true,
      error: null,
    }

    const dateClasses = tv({
      base: 'flex flex-col h-full w-full p-4',
      variants: {
        hasImage: {
          true: 'min-h-64 sm:min-h-0 bg-gradient-to-br from-background to-transparent to-75 bg-blend-multiply',
        },
      },
    })

    const pageUrl =
      (selectedEvent.page as any)?.cachedUrl ||
      (selectedEvent.page as any)?.url ||
      '#'
    const submitForms = (blok.submit as FormBlok[]) || []

    return (
      <div
        {...storyblokEditable(blok as any)}
        className="col-span-12 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4"
      >
        <div
          className="flex flex-1 self-stretch overflow-hidden rounded-md bg-cover bg-center sm:max-w-64"
          style={{
            backgroundImage: blok.image?.filename
              ? `url(${blok.image.filename})`
              : '',
          }}
        >
          <div className={dateClasses({ hasImage: !!blok.image?.filename })}>
            <p className="text-3xl font-semibold sm:block">
              <span className="sm:block sm:w-full">
                {eventDate.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                })}
              </span>
              <span className="ml-1 sm:block sm:w-full sm:text-lg sm:font-medium">
                {eventDate.toLocaleDateString('it-IT', {
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>

        <div className="block flex-1 space-y-4 py-4">
          {selectedEvent.title && (!pageUrl || submitForms.length > 0) ? (
            <h3 className="font-sans text-lg font-bold leading-snug md:text-2xl xl:text-3xl">
              {selectedEvent.title}
            </h3>
          ) : (
            <NextLink
              href={pageUrl}
              className="inline-flex font-semibold text-sm opacity-85 hover:opacity-100"
            >
              <h3 className="font-sans text-lg font-bold leading-snug md:text-2xl xl:text-3xl">
                {selectedEvent.title}
              </h3>
            </NextLink>
          )}

          {selectedEvent.description &&
            compiler(selectedEvent.description, {
              wrapper: 'div',
              forceWrapper: true,
              overrides: Typography({}),
            })}

          {pageUrl && pageUrl !== '#' && submitForms.length === 0 && (
            <NextLink
              href={pageUrl}
              className="inline-flex rounded-xl border-2 border-foreground px-3 py-2 text-sm font-medium opacity-85 hover:opacity-100"
            >
              Vai alla pagina
            </NextLink>
          )}

          {submitForms.length > 0 &&
            submitForms.map((form) => (
              <StoryblokComponent
                blok={form}
                openday={openday}
                key={form._uid}
              />
            ))}
        </div>
      </div>
    )
  }

  if (isArticle && selectedArticle) {
    const articleSlug = selectedArticle.fullSlug ? `/${selectedArticle.fullSlug}` : '#'

    return (
      <article
        {...storyblokEditable(blok as any)}
        className="col-span-12 flex flex-col items-stretch gap-6 md:col-span-10 md:flex-row"
      >
        {selectedArticle.image?.filename && (
          <NextLink
            href={articleSlug}
            className="w-full flex-none md:max-w-1/2"
          >
            <Image
              src={selectedArticle.image.filename}
              alt={selectedArticle.image.alt || selectedArticle.title || ''}
              radius="sm"
              isZoomed={true}
            />
          </NextLink>
        )}

        <div className="flex-1 space-y-6">
          <NextLink
            href={articleSlug}
            className="block space-y-3 transition-all hover:opacity-80"
          >
            <h4 className="font-serif text-4xl font-bold">
              {selectedArticle.title}
            </h4>
            <p className="text-sm line-clamp-3 sm:line-clamp-none">
              {selectedArticle.description}
            </p>
          </NextLink>

          <NextLink
            href={articleSlug}
            className="inline-flex rounded-xl border-2 border-foreground px-3 py-2 text-sm font-medium opacity-85 hover:opacity-100"
          >
            Leggi articolo
          </NextLink>
        </div>
      </article>
    )
  }

  return null
}