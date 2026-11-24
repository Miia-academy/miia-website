import type { ReactNode } from 'react'
import type { Alias as AliasBlok, Form as FormBlok, Person as PersonBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import type { ISbStoryData } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import NextLink from 'next/link'
import { Button } from '@components/ui/button'
import { Image } from '@components/ui/image'
import { responsiveImage } from '@modules/images'
import type { ProcessedEvent } from '@modules/cache'
import { getDocentiStories } from '@modules/events'
import { isStoryResolved } from '@modules/relations'
import { eventParts, AGEVOLAZIONE_TESTO } from '@modules/next-event'

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

/** Testi piccoli dell'evento (descrizione, riga dell'alias, agevolazione): la classe sta sul contenitore. */
const smallText = (text: string, className: string) =>
  compiler(text, {
    wrapper: ({ children }: { children?: ReactNode }) => <div className={`space-y-2 ${className}`}>{children}</div>,
    forceWrapper: true,
    overrides: { p: { component: ({ children }: { children?: ReactNode }) => <p>{children}</p> } },
  })

/**
 * Prossimo evento richiamato dall'alias ("Prossimo evento"), sul mockup di Mirko (24/11/2026):
 * - colonna stretta a sinistra: data impilata (giorno grande, mese, anno) e sotto la form;
 * - accanto: titolo, testo breve o descrizione, agevolazione, pulsante verso la pagina;
 * - docenti: piccoli ritratti tondi, a destra su desktop, sotto il testo su mobile.
 * Quali parti mostrare si sceglie nel campo "Mostra" dell'alias (vedi eventParts).
 * La form riceve la data esatta dell'evento: è quella che finisce in Brevo (OPENDAY_DATA, OPENDAY_CODICE).
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

  // Form: quella dell'alias ("Iscrizione"); altrimenti, con "Modulo" in Mostra,
  // il modulo scelto nel campo "Form" dell'evento
  const eventForm = parts.modulo && isStoryResolved<FormBlok>(event.form) ? event.form.content : null
  const submitForms: FormBlok[] = (blok.submit as FormBlok[])?.length
    ? (blok.submit as FormBlok[])
    : eventForm
      ? [{ ...eventForm, _uid: `${event.uuid}-form` }]
      : []

  const persone: ISbStoryData<PersonBlok>[] = parts.docenti ? getDocentiStories(event, persons) : []
  const agevolazioneTesto = String(blok.agevolazione_testo || '').trim() || AGEVOLAZIONE_TESTO
  // Testo breve e testo esteso scritti nell'alias; senza testo esteso, con "Descrizione dell'evento"
  // in Mostra, vale la descrizione dell'evento
  const line = String(blok.testo || '').trim()
  const longText = String(blok.descrizione || '').trim() || (parts.descrizione ? String(event.description || '').trim() : '')
  // Titolo: quello scritto nell'alias (campo "Titolo"), altrimenti, con "Titolo dell'evento", quello dell'evento
  const heading = String(blok.title || '').trim() || (parts.titolo ? event.title : '')
  const buttonLabel = String(blok.pulsante || '').trim() || 'Vai alla pagina'

  const day = eventDate.toLocaleDateString('it-IT', { day: 'numeric', timeZone: ROME })
  const month = eventDate.toLocaleDateString('it-IT', { month: 'long', timeZone: ROME })
  const year = eventDate.toLocaleDateString('it-IT', { year: 'numeric', timeZone: ROME })

  const hasDateColumn = parts.data || submitForms.length > 0
  // Agevolazione: solo nella versione con iscrizione, e solo se l'evento ha "Prezzo agevolato"
  const agevolazione = parts.agevolazione && submitForms.length > 0 && event.prezzo_agevolato === true

  return (
    <div {...storyblokEditable(blok as any)} className="col-span-12 flex w-full items-start gap-4 sm:gap-6">
      {/* Data impilata, e sotto la form (il pulsante che apre il modulo) */}
      {hasDateColumn && (
        <div className="flex w-20 shrink-0 flex-col items-center gap-3 text-center sm:w-24 [&_button]:w-full [&_button]:min-w-0 [&_button]:px-2 [&_button]:text-xs sm:[&_button]:text-sm">
          {parts.data && (
            <p className="font-serif font-bold leading-none">
              <span className="block text-6xl tracking-tighter sm:text-7xl">{day}</span>
              <span className="mt-1 block text-base sm:text-lg">{month}</span>
              <span className="block text-sm sm:text-base">{year}</span>
            </p>
          )}
          {submitForms.map((form) => (
            <StoryblokComponent blok={form} openday={openday} key={form._uid} />
          ))}
        </div>
      )}

      {/* Testi a sinistra, docenti a destra su desktop; tutto in colonna su mobile */}
      <div className="flex min-w-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-10">
        <div className="min-w-0 flex-1 space-y-2">
          {heading && <h3 className="font-sans type-subtitle font-bold">{heading}</h3>}
          {line && smallText(line, 'type-body-sm text-foreground/70')}
          {longText && smallText(longText, 'type-body-sm text-foreground/70')}
          {agevolazione && smallText(agevolazioneTesto, 'type-body-sm font-semibold text-foreground/80')}
          {parts.pulsante && cleanUrl && (
            <div className="pt-3">
              <Button as={NextLink} href={cleanUrl} color="primary" size="md">
                {buttonLabel}
              </Button>
            </div>
          )}
        </div>

        {persone.length > 0 && (
          <div className="shrink-0 space-y-3">
            {blok.persone_titolo && <h4 className="type-body-sm font-semibold">{blok.persone_titolo}</h4>}
            <ul className="flex flex-wrap gap-4">
              {persone.map((persona) => {
                const { title, image } = persona.content
                return (
                  <li key={persona.uuid} className="flex w-16 flex-col items-center gap-2 text-center sm:w-20">
                    <div className="aspect-square w-full overflow-hidden rounded-full bg-content2">
                      {image?.filename && (
                        <Image
                          classNames={{ wrapper: 'w-full h-full !max-w-full', img: 'w-full h-full object-cover' }}
                          {...responsiveImage(image.filename, '80px', [160])}
                          alt={image.alt || title || ''}
                          radius="full"
                        />
                      )}
                    </div>
                    <span className="type-caption leading-tight">{title}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
