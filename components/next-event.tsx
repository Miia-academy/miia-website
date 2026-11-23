import type { Alias as AliasBlok, Form as FormBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import NextLink from 'next/link'
import { Typography } from './typography'
import { Image } from '@components/ui/image'
import { responsiveImage } from '@modules/images'
import type { ProcessedEvent } from '@modules/cache'
import { getDocentiStories } from '@modules/events'
import { eventParts, AGEVOLAZIONE_TESTO } from '@modules/next-event'
import Person from './person'

type PersonLike = Parameters<typeof getDocentiStories>[1]

interface NextEventProps {
  blok: AliasBlok
  event: ProcessedEvent
  persons?: PersonLike
}

const getCleanUrl = (url?: string | null): string | null => {
  if (!url || url === '#') return null
  return `/${url.replace(/^\/+/, '')}`
}

const ROME = 'Europe/Rome'

/**
 * Prossimo evento richiamato dall'alias ("Prossimo evento").
 * La data è la protagonista; titolo e descrizione dell'evento stanno sotto, piccoli.
 * Quali parti mostrare si sceglie nel campo "Mostra" dell'alias (vedi eventParts).
 * Se l'alias ha una form ("Iscrizione"), la form riceve la data esatta dell'evento:
 * è quella che finisce in Brevo (OPENDAY_DATA e OPENDAY_CODICE).
 */
export default function NextEvent({ blok, event, persons = [] }: NextEventProps) {
  const eventDate = new Date(event.date as string)
  const parts = eventParts(blok)

  const openday = {
    id: 'openday',
    value: eventDate.toISOString(),
    required: true,
    error: null,
  }

  const rawPage = event.page as any
  const pageUrl =
    rawPage?.cached_url || rawPage?.cachedUrl || rawPage?.url || (typeof rawPage === 'string' ? rawPage : null)
  const cleanUrl = getCleanUrl(pageUrl)
  const submitForms = (blok.submit as FormBlok[]) || []
  const hasForm = submitForms.length > 0
  const persone = parts.docenti ? getDocentiStories(event, persons) : []
  const agevolazione = parts.agevolazione && event.prezzo_agevolato === true
  const agevolazioneTesto = String(blok.agevolazione_testo || '').trim() || AGEVOLAZIONE_TESTO

  const day = eventDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: ROME })
  const weekday = eventDate.toLocaleDateString('it-IT', { weekday: 'long', timeZone: ROME })
  const year = eventDate.toLocaleDateString('it-IT', { year: 'numeric', timeZone: ROME })
  const time = eventDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: ROME })
  const showTime = time !== '00:00'
  // Il campo "Titolo" dell'alias fa da occhiello solo con "Mostra" compilato (prima non si vedeva)
  const eyebrow = Array.isArray(blok.mostra) && blok.mostra.length ? String(blok.title || '').trim() : ''

  const dateBlock = parts.data && (
    <div className="space-y-2">
      {eyebrow && <p className="type-label text-foreground/60">{eyebrow}</p>}
      <p className="font-serif type-title-1 first-letter:uppercase">{day}</p>
      <p className="type-body-lg text-foreground/70 first-letter:uppercase">
        {[weekday, showTime ? `ore ${time}` : null, year].filter(Boolean).join(' · ')}
      </p>
    </div>
  )

  const title = parts.titolo && event.title && (
    !hasForm && cleanUrl ? (
      <NextLink href={cleanUrl} className="block transition-opacity hover:opacity-80">
        <h3 className="font-sans type-subtitle">{event.title}</h3>
      </NextLink>
    ) : (
      <h3 className="font-sans type-subtitle">{event.title}</h3>
    )
  )

  const description =
    parts.descrizione &&
    event.description &&
    compiler(event.description, {
      wrapper: 'div',
      forceWrapper: true,
      overrides: Typography({ theme: 'dark' }),
    })

  const reservedBox = agevolazione && (
    <aside className="border-l-4 border-primary py-1 pl-5">
      {compiler(agevolazioneTesto, {
        wrapper: 'div',
        forceWrapper: true,
        overrides: Typography({ theme: 'dark' }),
      })}
    </aside>
  )

  // Riga breve dell'alias (campo "Testo"): da sola basta per invitare, senza la descrizione lunga
  const line =
    String(blok.testo || '').trim() &&
    compiler(String(blok.testo), {
      wrapper: 'div',
      forceWrapper: true,
      overrides: Typography({ theme: 'dark', size: 'large' }),
    })
  const buttonLabel = String(blok.pulsante || '').trim() || 'Vai alla pagina'

  const image = blok.image?.filename && (
    <Image
      classNames={{
        wrapper: 'w-full !max-w-full aspect-[3/2] overflow-hidden rounded-xl',
        img: 'w-full h-full object-cover',
      }}
      {...responsiveImage(blok.image.filename, '(min-width: 1024px) 50vw, 100vw')}
      alt={blok.image.alt || ''}
      radius="lg"
    />
  )

  const texts = (title || line || description) && (
    <div className="max-w-prose space-y-3 text-left">
      {title}
      {line}
      {description}
    </div>
  )

  const button = !hasForm && cleanUrl && (
    <div className="pt-2">
      <NextLink
        href={cleanUrl}
        className="inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-85"
      >
        {buttonLabel}
        <i className="iconoir-arrow-right" aria-hidden />
      </NextLink>
    </div>
  )

  return (
    <div {...storyblokEditable(blok as any)} className="col-span-12 w-full space-y-12 sm:space-y-16">
      <div className="grid grid-cols-12 gap-8 lg:gap-16">
        {hasForm ? (
          /* Con la form: evento a sinistra, iscrizione a destra */
          <div className="col-span-12 space-y-6 lg:col-span-6">
            {image}
            {dateBlock}
            {texts}
            {reservedBox}
          </div>
        ) : (
          /* Richiamo (home, corsi): data a sinistra, riga e pulsante a destra */
          <>
            {(image || dateBlock) && (
              <div className="col-span-12 space-y-6 lg:col-span-5">
                {image}
                {dateBlock}
              </div>
            )}
            <div
              className={`col-span-12 space-y-6 self-end ${image || dateBlock ? 'lg:col-span-7' : ''}`}
            >
              {texts}
              {reservedBox}
              {button}
            </div>
          </>
        )}

        {/* Iscrizione: riceve la data esatta dell'evento mostrato */}
        {hasForm && (
          <div className="col-span-12 lg:col-span-6">
            <div className="rounded-2xl bg-content2 p-6 sm:p-8">
              {submitForms.map((form) => (
                <StoryblokComponent blok={form} openday={openday} key={form._uid} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Docenti: un blocco proprio, titolo e testo a sinistra, ritratti a destra */}
      {persone.length > 0 && (
        <div className="grid grid-cols-12 gap-8 border-t border-foreground/10 pt-10 sm:pt-12 lg:gap-16">
          {(blok.persone_titolo || blok.persone_testo) && (
            <div className="col-span-12 space-y-3 lg:col-span-4">
              {blok.persone_titolo && <h3 className="font-serif type-title-3">{blok.persone_titolo}</h3>}
              {blok.persone_testo && (
                <p className="type-body text-foreground/70">{String(blok.persone_testo)}</p>
              )}
            </div>
          )}
          <div
            className={`col-span-12 grid grid-cols-12 gap-6 ${
              blok.persone_titolo || blok.persone_testo ? 'lg:col-span-8' : ''
            }`}
          >
            {persone.map((persona) => (
              <Person key={persona.uuid} blok={{ component: 'person', _uid: persona.uuid, alias: persona }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
