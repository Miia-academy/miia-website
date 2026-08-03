import { useEffect, useState } from 'react'
import type { Alias as AliasBlok, Form as FormBlok } from '@types'
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
  const { articles, events } = useDataContext()

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
      base: 'flex flex-col justify-end h-full w-full p-4 text-white relative z-10',
      variants: {
        hasImage: {
          true: 'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
          false: 'bg-neutral-800',
        },
      },
    })

    // 1. Estrazione del link diretta dalla proprietà dell'evento
    const rawPage = selectedEvent.page as any
    const pageUrl =
      rawPage?.cached_url ||
      rawPage?.cachedUrl ||
      rawPage?.url ||
      (typeof rawPage === 'string' ? rawPage : null)

    const cleanUrl = pageUrl && pageUrl !== '#' ? (pageUrl.startsWith('/') ? pageUrl : `/${pageUrl}`) : null
    const submitForms = (blok.submit as FormBlok[]) || []

    return (
      <div
        {...storyblokEditable(blok as any)}
        className="col-span-12 flex w-full flex-col items-stretch gap-6 sm:flex-row sm:items-center sm:gap-8"
      >
        {/* Box Data con Immagine */}
        <div
          className="relative flex aspect-[4/3] min-h-48 w-full min-w-56 flex-none overflow-hidden rounded-xl bg-cover bg-center sm:w-64"
          style={{
            backgroundImage: blok.image?.filename
              ? `url(${blok.image.filename})`
              : 'none',
          }}
        >
          <div className={dateClasses({ hasImage: !!blok.image?.filename })}>
            <p className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              <span className="block">
                {eventDate.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                })}
              </span>
              <span className="block text-lg font-medium opacity-90 sm:text-xl">
                {eventDate.toLocaleDateString('it-IT', {
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Dettagli Evento */}
        <div className="flex flex-1 flex-col justify-center space-y-4 py-2">
          {selectedEvent.title && (!cleanUrl || submitForms.length > 0) ? (
            <h3 className="font-sans text-xl font-bold leading-tight sm:text-2xl md:text-3xl xl:text-4xl">
              {selectedEvent.title}
            </h3>
          ) : (
            <NextLink
              href={cleanUrl || '#'}
              className="inline-block transition-opacity hover:opacity-85"
            >
              <h3 className="font-sans text-xl font-bold leading-tight sm:text-2xl md:text-3xl xl:text-4xl">
                {selectedEvent.title}
              </h3>
            </NextLink>
          )}

          {selectedEvent.description &&
            compiler(selectedEvent.description, {
              wrapper: 'div',
              forceWrapper: true,
              overrides: Typography({ theme: 'dark' }),
            })}

          {/* 2. Ripristino del Bottone "Vai alla pagina" */}
          {cleanUrl && submitForms.length === 0 && (
            <div className="pt-2">
              <NextLink
                href={cleanUrl}
                className="inline-flex rounded-xl border-2 border-foreground px-4 py-2 text-sm font-medium transition-all hover:bg-foreground hover:text-background"
              >
                Vai alla pagina
              </NextLink>
            </div>
          )}

          {submitForms.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-2">
              {submitForms.map((form) => (
                <StoryblokComponent
                  blok={form}
                  openday={openday}
                  key={form._uid}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (isArticle && selectedArticle) {
    const articleSlug = selectedArticle.fullSlug ? `/${selectedArticle.fullSlug}` : '#'

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
                src={selectedArticle.image.filename}
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
            <h4 className="font-serif text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
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