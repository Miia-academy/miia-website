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
 * La versione (collegamento o registrazione) si sceglie nel campo "Versione" dell'alias (vedi eventParts).
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

  // Form: quella dell'alias ("Iscrizione"); altrimenti, nella versione "registrazione",
  // il modulo scelto nel campo "Form" dell'evento
  const eventForm = parts.modulo && isStoryResolved<FormBlok>(event.form) ? event.form.content : null
  // Nella versione "collegamento" niente form, anche se l'alias ne ha una
  const aliasForms = blok.versione === 'collegamento' ? [] : ((blok.submit as FormBlok[]) || [])
  const submitForms: FormBlok[] = aliasForms.length
    ? aliasForms
    : eventForm
      ? [{ ...eventForm, _uid: `${event.uuid}-form` }]
      : []

  const persone: ISbStoryData<PersonBlok>[] = parts.docenti ? getDocentiStories(event, persons) : []
  const agevolazioneTesto = String(blok.agevolazione_testo || '').trim() || AGEVOLAZIONE_TESTO
  // Testo breve e testo esteso scritti nell'alias; senza testo esteso, con "Descrizione dell'evento"
  // nella versione "registrazione", vale la descrizione dell'evento
  const line = String(blok.testo || '').trim()
  const longText = String(blok.descrizione || '').trim() || (parts.descrizione ? String(event.description || '').trim() : '')
  // Titolo: quello scritto nell'alias (campo "Titolo"), altrimenti, con "Titolo dell'evento", quello dell'evento
  const heading = String(blok.title || '').trim() || (parts.titolo ? event.title : '')
  const buttonLabel = String(blok.pulsante || '').trim() || 'Vai alla pagina'

  const day = eventDate.toLocaleDateString('it-IT', { day: 'numeric', timeZone: ROME })
  const month = eventDate.toLocaleDateString('it-IT', { month: 'long', timeZone: ROME })
  const year = eventDate.toLocaleDateString('it-IT', { year: 'numeric', timeZone: ROME })

  // Agevolazione: solo nella versione con iscrizione, e solo se l'evento ha "Prezzo agevolato"
  const agevolazione = parts.agevolazione && submitForms.length > 0 && event.prezzo_agevolato === true

  const hasForm = submitForms.length > 0

  const dateBlock = parts.data && (
    <p className="font-serif font-bold leading-none text-center">
      <span className="block text-6xl tracking-tighter sm:text-7xl">{day}</span>
      <span className="mt-1 block text-base sm:text-lg">{month}</span>
      <span className="block text-sm sm:text-base">{year}</span>
    </p>
  )
  const title = heading && <h3 className="font-serif type-title-3">{heading}</h3>
  const texts = (line || longText || agevolazione) && (
    <div className="space-y-2">
      {line && smallText(line, 'type-body-sm text-foreground/70')}
      {longText && smallText(longText, 'type-body-sm text-foreground/70')}
      {agevolazione && smallText(agevolazioneTesto, 'type-body-sm font-semibold text-foreground/80')}
    </div>
  )

  const docenti = persone.length > 0 && (
    <div className="space-y-3">
      {blok.persone_titolo && <h4 className="type-body-lg text-center font-semibold lg:text-left">{blok.persone_titolo}</h4>}
      <ul className="flex flex-wrap justify-center gap-4 lg:flex-nowrap lg:justify-start">
        {persone.map((persona) => {
          const { title: name, image } = persona.content
          return (
            <li key={persona.uuid} className="flex w-16 flex-col items-center gap-2 text-center sm:w-20">
              <div className="aspect-square w-full overflow-hidden rounded-full bg-content2">
                {image?.filename && (
                  <Image
                    classNames={{ wrapper: 'w-full h-full !max-w-full', img: 'w-full h-full object-cover' }}
                    {...responsiveImage(image.filename, '80px', [160])}
                    alt={image.alt || name || ''}
                    radius="full"
                  />
                )}
              </div>
              <span className="type-caption leading-tight">{name}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )

  // Registrazione (mockup 24/11): su mobile data e titolo affiancati, poi testi, "Registrati" e
  // docenti a tutta larghezza; su desktop data e "Registrati" larghi 2 colonne della griglia del sito (12 colonne, gap-6),
  // testi nello spazio restante, docenti a destra su una sola riga.
  // I contenitori "contents" spariscono su mobile, così i figli si dispongono nella griglia.
  if (hasForm) {
    return (
      <div
        {...storyblokEditable(blok as any)}
        className="col-span-12 grid w-full grid-cols-[5rem_1fr] items-center gap-x-4 gap-y-4 sm:grid-cols-[6rem_1fr] lg:grid-cols-[calc((100%-16.5rem)/6+1.5rem)_minmax(0,1fr)_auto] lg:items-start lg:gap-x-6"
      >
        <div className="contents lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:items-center lg:gap-4">
          {dateBlock && <div className="col-start-1 row-start-1">{dateBlock}</div>}
          <div className="col-span-2 row-start-3 lg:w-full [&_button]:w-full">
            {submitForms.map((form) => (
              <StoryblokComponent blok={form} openday={openday} key={form._uid} />
            ))}
          </div>
        </div>
        <div className={`contents lg:row-start-1 lg:block lg:min-w-0 lg:space-y-2 ${docenti ? 'lg:col-start-2' : 'lg:col-span-2 lg:col-start-2'}`}>
          {title && <div className={`row-start-1 ${dateBlock ? 'col-start-2' : 'col-span-2'}`}>{title}</div>}
          {texts && <div className="col-span-2 row-start-2">{texts}</div>}
        </div>
        {docenti && <div className="col-span-2 row-start-4 lg:col-span-1 lg:col-start-3 lg:row-start-1">{docenti}</div>}
      </div>
    )
  }

  // Collegamento: data a sinistra; titolo, testo breve e pulsante accanto
  return (
    <div {...storyblokEditable(blok as any)} className="col-span-12 flex w-full items-start gap-4 sm:gap-6 lg:grid lg:grid-cols-12 lg:gap-x-6">
      {dateBlock && <div className="w-20 shrink-0 sm:w-24 lg:col-span-2 lg:w-auto">{dateBlock}</div>}
      <div className={`flex min-w-0 flex-1 flex-col gap-6 lg:flex-row lg:gap-6 ${dateBlock ? 'lg:col-span-10' : 'lg:col-span-12'}`}>
        <div className="min-w-0 flex-1 space-y-2">
          {title}
          {texts}
          {parts.pulsante && cleanUrl && (
            <div className="pt-3">
              <Button as={NextLink} href={cleanUrl} color="primary" size="md">
                {buttonLabel}
              </Button>
            </div>
          )}
        </div>
        {docenti && <div className="shrink-0">{docenti}</div>}
      </div>
    </div>
  )
}
