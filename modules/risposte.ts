/**
 * Pagina /risposta: la risposta a un dubbio cliccato in un'email del funnel
 * (brochure, prima dell'open day, dopo l'open day).
 *
 * Il testo viene da Storyblok › Datasources › "Domande open day": il nome della voce
 * è il valore "d" del link (e quello salvato in Brevo), il valore è la risposta.
 * La fase cambia solo il pulsante finale, non la risposta.
 */

export const FASI = ['brochure', 'pre-openday', 'post-openday'] as const
export type Fase = (typeof FASI)[number]

export function parseFase(value: unknown): Fase | null {
  const fase = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return (FASI as readonly string[]).includes(fase) ? (fase as Fase) : null
}

export const TELEFONATA_URL = 'https://meet.brevo.com/miia/telefonata'
export const WHATSAPP_URL = 'https://wa.me/393484463000'
export const WHATSAPP_NUMERO = '348 446 3000'

// Corso come nel resto del sito (cartella Storyblok): "corso-interior-design-primo-livello"
const CORSO = /^corso-[a-z0-9]+(-[a-z0-9]+)*$/

export function parseCorso(value: unknown): string | null {
  const corso = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return corso.length <= 80 && CORSO.test(corso) ? corso : null
}

// Pagina open day dell'area del corso (solo quelle pubblicate in Storyblok)
const OPENDAY_PAGE: Array<[RegExp, string]> = [[/^corso-interior-design-/, '/open-day/interior-design']]

export interface Cta {
  label: string
  href: string
}

/** Pulsante finale secondo la fase. Senza fase (link vecchi) non c'è pulsante, restano i contatti. */
export function ctaFor(fase: Fase | null, corso: string | null): Cta | null {
  if (fase === 'brochure') {
    const page = corso ? OPENDAY_PAGE.find(([re]) => re.test(corso))?.[1] : null
    return page ? { label: 'Vieni al prossimo open day', href: page } : null
  }
  if (fase === 'post-openday' && corso) {
    return { label: 'Iscriviti online', href: `/iscrizione/${corso}` }
  }
  return null
}

/** La risposta in paragrafi: una riga vuota (o un a capo) nel testo di Storyblok separa i paragrafi. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
}
