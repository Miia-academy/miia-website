import { useEffect, useState } from 'react'
import type {
  Alias as AliasBlok,
  Article as ArticleBlok,
  Event as EventBlok,
  Form as FormBlok,
} from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'
import { Image } from '@heroui/react'
import NextLink from 'next/link'
import { tv } from 'tailwind-variants'
import { storyblokApi } from '@modules/storyblokApi'

interface AliasComponentProps {
  blok: AliasBlok
  parent?: string
}

// Struttura tipizzata per la storia dell'Evento risolto via GraphQL
type EventStory = ISbStoryData<EventBlok> & {
  parsedDate?: Date
}

// Struttura tipizzata per la storia dell'Articolo risolto via GraphQL
type ArticleStory = ISbStoryData<ArticleBlok>

// Tipo Unione per lo stato dell'Alias
type AliasData = ArticleStory | EventStory | null

export default function Alias({ blok }: AliasComponentProps) {
  const isArticle = blok.resource === 'last-article'
  const isEvent = blok.resource === 'next-event'

  const [alias, setAlias] = useState<AliasData>(null)
  const [isLoading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const getAlias = async () => {
      const variables = { isArticle, isEvent }
      const query = `
        query ($isArticle: Boolean!, $isEvent: Boolean!){      
          ArticleItems( 
            sort_by:"published_at:desc", 
            resolve_relations: "article.author",
            per_page: 1, 
            filter_query: {hidden: {not_in: true}})
          @include(if: $isArticle) {
            items {
              name
              full_slug
              published_at
              tag_list
              content {
                title
                image {
                  alt
                  filename
                  copyright
                  title
                }
                description
              }
            }
          }
          EventItems(sort_by: "position:asc", resolve_relations: "event.location")
          @include(if: $isEvent) {
            items {
              name
              full_slug
              content {
                title
                description
                openday
                date
                location {
                  content
                }
                page {
                  cachedUrl
                  url
                }
              }
            }
          }
        }
      `

      try {
        const data = await storyblokApi({ query, variables })
        if (!isMounted) return

        if (data?.ArticleItems?.items?.length) {
          setAlias(data.ArticleItems.items[0] as ArticleStory)
        } else if (data?.EventItems?.items?.length) {
          const today = new Date()

          const events: EventStory[] = data.EventItems.items
            .filter((item: EventStory) => {
              if (!item.content?.date) return false
              return blok.filter ? item.name?.includes(blok.filter) : true
            })
            .sort((a: EventStory, b: EventStory) => {
              const dateA = new Date(a.content.date || 0).getTime()
              const dateB = new Date(b.content.date || 0).getTime()
              return dateA - dateB
            })

          const nextEvent = events.find(
            (item) => new Date(item.content.date || 0) >= today
          )

          if (nextEvent && nextEvent.content.date) {
            setAlias({
              ...nextEvent,
              parsedDate: new Date(nextEvent.content.date),
            })
          } else {
            setAlias(null)
          }
        }
      } catch (error) {
        console.error('Errore durante il recupero dell\'alias:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    getAlias()

    return () => {
      isMounted = false
    }
  }, [isArticle, isEvent, blok.filter])

  if (isLoading) return <p className="col-span-12 py-4">Caricamento in corso...</p>
  if (!alias) return null

  // --- RENDERING PER GLI EVENTI ---
  if (isEvent) {
    const eventContent = alias.content as EventBlok
    const eventDate = (alias as EventStory).parsedDate || new Date()

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

    const pageUrl = eventContent.page?.cached_url || eventContent.page?.url || '#'
    const submitForms = (blok.submit as FormBlok[]) || []

    return (
      <div
        {...storyblokEditable(blok as any)}
        className="flex flex-col gap-2 sm:gap-4 sm:flex-row col-span-12 items-start sm:items-center"
      >
        <div
          className="flex-1 sm:max-w-64 bg-cover bg-center rounded-md overflow-hidden self-stretch flex"
          style={{
            backgroundImage: blok.image?.filename
              ? `url(${blok.image.filename})`
              : '',
          }}
        >
          <div className={dateClasses({ hasImage: !!blok.image?.filename })}>
            <p className="text-3xl font-semibold sm:block">
              <span className="sm:w-full sm:block">
                {eventDate.toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: 'long',
                })}
              </span>
              <span className="sm:w-full ml-1 sm:block sm:text-lg sm:font-medium">
                {eventDate.toLocaleDateString('it-IT', {
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>
        </div>

        <div className="flex-1 space-y-4 block py-4">
          {eventContent.title && (!pageUrl || submitForms.length > 0) ? (
            <h3 className="font-sans text-lg md:text-2xl xl:text-3xl font-bold leading-snug">
              {eventContent.title}
            </h3>
          ) : (
            <NextLink
              href={pageUrl}
              className="font-semibold text-sm hover:opacity-100 opacity-85 inline-flex"
            >
              <h3 className="font-sans text-lg md:text-2xl xl:text-3xl font-bold leading-snug">
                {eventContent.title}
              </h3>
            </NextLink>
          )}

          {eventContent.description &&
            compiler(eventContent.description, {
              wrapper: 'div',
              forceWrapper: true,
              overrides: Typography({}),
            })}

          {pageUrl && pageUrl !== '#' && submitForms.length === 0 && (
            <NextLink
              href={pageUrl}
              className="font-medium text-sm py-2 hover:opacity-100 opacity-85 inline-flex border-2 border-foreground px-3 rounded-xl"
            >
              Vai alla pagina
            </NextLink>
          )}

          {submitForms.length > 0 &&
            submitForms.map((form) => (
              <StoryblokComponent blok={form} openday={openday} key={form._uid} />
            ))}
        </div>
      </div>
    )
  }

  // --- RENDERING PER GLI ARTICOLI ---
  if (isArticle) {
    const articleContent = alias.content as ArticleBlok
    const articleSlug = alias.full_slug ? `/${alias.full_slug}` : '#'

    return (
      <article
        {...storyblokEditable(blok as any)}
        className="col-span-12 md:col-span-10 flex flex-col md:flex-row gap-6 items-stretch"
      >
        {articleContent.image?.filename && (
          <NextLink
            href={articleSlug}
            className="flex-none w-full md:max-w-1/2"
          >
            <Image
              src={articleContent.image.filename}
              alt={articleContent.image.alt || articleContent.title || ''}
              radius="sm"
              isZoomed={true}
            />
          </NextLink>
        )}

        <div className="flex-1 space-y-6">
          <NextLink
            href={articleSlug}
            className="hover:opacity-80 transition-all space-y-3 block"
          >
            <h4 className="font-serif font-bold text-4xl">
              {articleContent.title}
            </h4>
            <p className="text-sm line-clamp-3 sm:line-clamp-none">
              {articleContent.description}
            </p>
          </NextLink>

          <NextLink
            href={articleSlug}
            className="font-medium text-sm py-2 hover:opacity-100 opacity-85 inline-flex border-2 border-foreground px-3 rounded-xl"
          >
            Leggi articolo
          </NextLink>
        </div>
      </article>
    )
  }

  return (
    <div {...storyblokEditable(blok as any)} className="col-span-12">
      <h3>{(alias.content as any)?.title}</h3>
    </div>
  )
}