import type { Event as EventBlok, Form as FormBlok } from '@types'
import type { PropsWithChildren } from 'react'
import { Card, CardBody, CardHeader } from '@heroui/react'
import { getLongDate } from '@modules/formats'
import Link from 'next/link'
import NextLink from 'next/link'
import { compiler } from 'markdown-to-jsx'
import { Typography } from '../typography'
import { storyblokEditable, StoryblokComponent } from '@storyblok/react'
import { tv } from 'tailwind-variants'

export interface EventBannerProps {
  blok?: EventBlok
  parent?: string
  title?: string | null
  description?: string | null
  date?: string | null
  imageFilename?: string | null
  pageUrl?: string | null
  submitForms?: FormBlok[]
}

const dateClasses = tv({
  base: 'flex flex-col justify-end h-full w-full p-4 sm:p-6 text-white relative z-10',
  variants: {
    hasImage: {
      true: 'bg-gradient-to-t from-black/85 via-black/40 to-transparent',
      false: 'bg-neutral-800',
    },
  },
})

export default function EventBanner({
  blok,
  parent,
  title: propTitle,
  description: propDescription,
  date: propDate,
  imageFilename: propImageFilename,
  pageUrl: propPageUrl,
  submitForms = [],
}: EventBannerProps) {
  // Casting 'any' per bypassare l'errore TypeScript "Property X does not exist on type {}"
  const rawAliasContent = (blok?.alias as any)?.content
  const event = rawAliasContent || blok || {}

  const title = (event as any).title ?? propTitle
  const dateStr = (event as any).date ?? propDate
  const description = (event as any).description ?? propDescription
  const imageFilename = (event as any).image?.filename ?? propImageFilename
  const link = (event as any).page?.cached_url || (event as any).page?.url || propPageUrl

  if (!title || !dateStr) return null

  const date = new Date(dateStr)
  const isValidDate = !isNaN(date.getTime())

  // VARIANTE 1: Banner Hero con Immagine / Form (Alias / OpenDay)
  if (imageFilename || submitForms.length > 0) {
    const openday = isValidDate
      ? {
        id: 'openday',
        value: date.toISOString(),
        required: true,
        error: null,
      }
      : undefined

    const cleanUrl = link && link !== '#' ? link : null

    return (
      <div
        {...(blok ? storyblokEditable(blok as any) : {})}
        className="col-span-12 grid grid-cols-12 gap-4 sm:gap-6 items-center w-full"
      >
        <div className="col-span-12 sm:col-span-5 md:col-span-4 lg:col-span-3">
          <div
            className="relative aspect-square sm:aspect-[4/3] w-full overflow-hidden rounded-xl bg-cover bg-center shadow-md"
            style={{
              backgroundImage: imageFilename ? `url(${imageFilename})` : undefined,
            }}
          >
            <div className={dateClasses({ hasImage: !!imageFilename })}>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-none">
                <span className="block">
                  {isValidDate
                    ? date.toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                    })
                    : '--'}
                </span>
                <span className="block text-lg font-normal opacity-90 mt-1">
                  {isValidDate
                    ? date.toLocaleDateString('it-IT', {
                      year: 'numeric',
                    })
                    : ''}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="col-span-12 sm:col-span-7 md:col-span-8 lg:col-span-9 space-y-4 py-2">
          {title && (!cleanUrl || submitForms.length > 0) ? (
            <h3 className="font-sans text-xl font-bold leading-snug sm:text-2xl md:text-3xl xl:text-4xl">
              {title}
            </h3>
          ) : (
            <NextLink
              href={cleanUrl || '#'}
              className="inline-block transition-opacity hover:opacity-80"
            >
              <h3 className="font-sans text-xl font-bold leading-snug sm:text-2xl md:text-3xl xl:text-4xl">
                {title}
              </h3>
            </NextLink>
          )}

          {description &&
            compiler(description, {
              wrapper: 'div',
              forceWrapper: true,
              overrides: Typography({ theme: 'dark' }),
            })}

          {cleanUrl && submitForms.length === 0 && (
            <div className="pt-2">
              <NextLink
                href={cleanUrl}
                className="inline-flex rounded-full border border-foreground/80 px-5 py-2 text-sm font-medium transition-all hover:bg-foreground hover:text-background"
              >
                Vai alla pagina
              </NextLink>
            </div>
          )}

          {submitForms.length > 0 && (
            <div className="pt-2 flex flex-wrap gap-3">
              {submitForms.map((form: any) => (
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

  // VARIANTE 2: Layout Section Orizzontale
  if (parent === 'section') {
    return (
      <div
        className="flex flex-col sm:flex-row col-span-12"
        {...(blok ? storyblokEditable(blok as any) : {})}
      >
        <div className="flex-1 sm:max-w-24 gap-2 sm:gap-1 flex sm:flex-col sm:justify-center items-baseline sm:items-center sm:px-6 py-2 text-center">
          <span className="text-xl sm:text-3xl font-bold">
            {isValidDate
              ? date.toLocaleDateString('it-IT', { day: '2-digit' })
              : '--'}
          </span>
          <span className="text-xl font-semibold">
            {isValidDate
              ? date.toLocaleDateString('it-IT', { month: 'long' })
              : ''}
          </span>
          <span className="text-lg font-semibold sm:text-xs sm:font-normal">
            {isValidDate
              ? date.toLocaleDateString('it-IT', { year: 'numeric' })
              : ''}
          </span>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="font-serif leading-tight font-bold break-words text-3xl md:text-4xl xl:text-5xl">
            {title}
          </h3>
          {description &&
            compiler(description, {
              wrapper: 'p',
              forceWrapper: true,
              overrides: Typography({}),
            })}
        </div>
      </div>
    )
  }

  // VARIANTE 3: Layout Card HeroUI Standard
  const Container = ({ children }: PropsWithChildren) =>
    link ? <Link href={link}>{children}</Link> : <>{children}</>

  return (
    <Container>
      <Card {...(blok ? storyblokEditable(blok as any) : {})}>
        <CardHeader className="flex-col items-start">
          <h4 className="font-bold leading-snug text-2xl">{title}</h4>
        </CardHeader>

        <CardBody className="text-sm space-y-1">
          {description &&
            compiler(description, {
              wrapper: 'p',
              forceWrapper: true,
              overrides: Typography({}),
            })}

          {dateStr && (
            <p className="space-x-0.5">
              <i className="iconoir-calendar-arrow-up pr-1" />
              <span className="md:max-lg:hidden">Data: </span>
              <span>
                {isValidDate ? getLongDate(dateStr) : 'in programmazione'}
              </span>
            </p>
          )}
        </CardBody>
      </Card>
    </Container>
  )
}