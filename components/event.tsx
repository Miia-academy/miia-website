import type { Event as EventBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import type { PropsWithChildren } from 'react'
import { storyblokEditable } from '@storyblok/react'
import { Card, CardBody, CardHeader } from '@heroui/react'
import { getLongDate } from '@modules/formats'
import { resolveAlias } from '@modules/relations'
import Link from 'next/link'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'

interface EventComponentProps {
  blok: EventBlok
  story?: ISbStoryData<EventBlok>
  parent?: string
}

export default function Event({ blok, story, parent }: EventComponentProps) {
  // 1. Risoluzione safe del pattern Alias/Mirror
  const { content: event } = resolveAlias<EventBlok>(
    blok.alias as ISbStoryData<EventBlok> | string | undefined,
    blok,
    story?.full_slug
  )

  // 2. Guard Clause sui dati essenziali
  if (!event.title || !event.date) return null

  const link = event.page?.cached_url || event.page?.url

  const Container = ({ children }: PropsWithChildren) =>
    link ? <Link href={link}>{children}</Link> : <>{children}</>

  const parsedDate = new Date(event.date)
  const isValidDate = !isNaN(parsedDate.getTime())

  // Rendering per variante Section (layout orizzontale)
  if (parent === 'section') {
    return (
      <div
        className="flex flex-col sm:flex-row col-span-12"
        {...storyblokEditable(blok as any)}
      >
        <div className="flex-1 sm:max-w-24 gap-2 sm:gap-1 flex sm:flex-col sm:justify-center items-baseline sm:items-center sm:px-6 py-2 text-center">
          <span className="text-xl sm:text-3xl font-bold">
            {isValidDate
              ? parsedDate.toLocaleDateString('it-IT', { day: '2-digit' })
              : '--'}
          </span>
          <span className="text-xl font-semibold">
            {isValidDate
              ? parsedDate.toLocaleDateString('it-IT', { month: 'long' })
              : ''}
          </span>
          <span className="text-lg font-semibold sm:text-xs sm:font-normal">
            {isValidDate
              ? parsedDate.toLocaleDateString('it-IT', { year: 'numeric' })
              : ''}
          </span>
        </div>

        <div className="flex-1 space-y-3">
          <h3 className="font-serif leading-tight font-bold break-words text-3xl md:text-4xl xl:text-5xl">
            {event.title}
          </h3>
          {event.description &&
            compiler(event.description, {
              wrapper: 'p',
              forceWrapper: true,
              overrides: Typography({}),
            })}
        </div>
      </div>
    )
  }

  // Rendering Standard (Card)
  return (
    <Container>
      <div {...storyblokEditable(blok as any)}>
        <Card>
          <CardHeader className="flex-col items-start">
            <h4 className="font-bold leading-snug text-2xl">{event.title}</h4>
          </CardHeader>

          <CardBody className="text-sm space-y-1">
            {event.description &&
              compiler(event.description, {
                wrapper: 'p',
                forceWrapper: true,
                overrides: Typography({}),
              })}

            <p className="space-x-0.5">
              <i className="iconoir-calendar-arrow-up pr-1" />
              <span className="md:max-lg:hidden">Data: </span>
              <span>
                {isValidDate
                  ? getLongDate(event.date)
                  : 'in programmazione'}
              </span>
            </p>
          </CardBody>
        </Card>
      </div>
    </Container>
  )
}