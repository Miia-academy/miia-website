import { createHmac, timingSafeEqual } from 'crypto'
import { brevoFetch } from '@modules/brevo'
import { storyUrl } from '@modules/sitemap'

/**
 * Newsletter da un articolo di Storyblok.
 *
 * Quando un articolo viene pubblicato con "Crea newsletter" spuntato, il webhook di
 * Storyblok chiama /api/storyblok/newsletter e qui si crea in Brevo una campagna in
 * BOZZA (mai inviata) per il segmento del pubblico scelto. La bozza la rivede e la
 * invia Miia da Brevo.
 *
 * Il layout è il modello Brevo "Modello newsletter - 2026" (id 214), con i segnaposto
 * {{ params.TITOLO }}, {{ params.INTRO }}, {{ params.IMMAGINE }} e {{ params.LINK }}:
 * il sito li sostituisce con i dati dell'articolo, quindi il modello si può ritoccare
 * nell'editor di Brevo purché i segnaposto restino.
 */

export const DEFAULT_TEMPLATE_ID = 214
export const DEFAULT_SENDER_ID = 1 // info@miia.it
export const DEFAULT_SENDER_NAME = 'Miia - info'

// Pubblico scelto nell'articolo → variabile con l'id del segmento Brevo
export const PUBBLICO_ENV: Record<string, string> = {
  interni: 'BREVO_NEWSLETTER_SEGMENT_INTERNI',
  moda: 'BREVO_NEWSLETTER_SEGMENT_MODA',
  generico: 'BREVO_NEWSLETTER_SEGMENT_TUTTI',
}

export interface ArticoloNewsletter {
  id: number
  name?: string
  full_slug: string
  content: {
    component?: string
    title?: string
    description?: string
    image?: { filename?: string; alt?: string } | null
    newsletter?: boolean
    newsletter_pubblico?: string
    newsletter_oggetto?: string
    newsletter_anteprima?: string
    newsletter_intro?: string
  }
}

export interface DatiNewsletter {
  titolo: string
  intro: string
  oggetto: string
  anteprima: string
  immagine: string
  link: string
  pubblico: string
}

/** Firma del webhook di Storyblok: HMAC-SHA1 del corpo grezzo, in esadecimale. */
export function firmaValida(body: string, firma: string | undefined, secret: string): boolean {
  if (!firma || !secret) return false
  const attesa = createHmac('sha1', secret).update(body).digest('hex')
  const a = Buffer.from(attesa)
  const b = Buffer.from(firma.trim().toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

function testo(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** Immagine ridimensionata dal servizio immagini di Storyblok (600px, doppia densità). */
export function immagineEmail(filename: string): string {
  if (!filename) return ''
  return /^https:\/\/a\.storyblok\.com\//.test(filename) ? `${filename}/m/1200x0` : filename
}

/** Dati della mail: i campi della scheda Newsletter, o quelli dell'articolo se vuoti. */
export function datiNewsletter(story: ArticoloNewsletter): DatiNewsletter {
  const c = story.content || {}
  const titolo = testo(c.title) || testo(story.name)
  const riassunto = testo(c.description)
  return {
    titolo,
    intro: testo(c.newsletter_intro) || riassunto,
    oggetto: testo(c.newsletter_oggetto) || titolo,
    anteprima: testo(c.newsletter_anteprima) || riassunto,
    immagine: immagineEmail(testo(c.image?.filename)),
    link: storyUrl(story.full_slug),
    pubblico: testo(c.newsletter_pubblico) || 'generico',
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const token = (name: string) => new RegExp(`\\{\\{\\s*params\\.${name}\\s*\\}\\}`, 'g')

/** Riempie il layout del modello con i dati dell'articolo. */
export function compilaLayout(html: string, dati: DatiNewsletter): string {
  let out = html
  // Senza immagine si toglie il tag img, invece di lasciare un'immagine rotta
  if (!dati.immagine) out = out.replace(/<img\b[^>]*\{\{\s*params\.IMMAGINE\s*\}\}[^>]*>/g, '')
  // Il link può avere già parametri UTM aggiunti da Brevo: li mette la campagna
  out = out.replace(/\{\{\s*params\.LINK\s*\}\}[^"']*/g, escapeHtml(dati.link))
  out = out.replace(token('IMMAGINE'), escapeHtml(dati.immagine))
  out = out.replace(token('TITOLO'), escapeHtml(dati.titolo))
  out = out.replace(token('INTRO'), escapeHtml(dati.intro).replace(/\r?\n/g, '<br/>'))
  return out
}

/** Nome della campagna: il suffisso con l'id dell'articolo evita doppioni. */
export function nomeCampagna(story: ArticoloNewsletter, titolo: string): string {
  return `Newsletter - ${titolo.slice(0, 120)} [articolo ${story.id}]`
}

/** Cerca tra le campagne recenti una già creata per questo articolo. */
export async function campagnaEsistente(storyId: number): Promise<{ id: number; name: string } | null> {
  const suffisso = `[articolo ${storyId}]`
  const limit = 100
  for (let offset = 0; offset < 500; offset += limit) {
    const data = await brevoFetch<{ campaigns?: { id: number; name: string }[] }>('/emailCampaigns', {
      method: 'GET',
      params: { limit, offset, sort: 'desc', excludeHtmlContent: true },
    })
    const campagne = data.campaigns || []
    const trovata = campagne.find((c) => c.name?.endsWith(suffisso))
    if (trovata) return { id: trovata.id, name: trovata.name }
    if (campagne.length < limit) break
  }
  return null
}

export function segmentoPer(pubblico: string): number | null {
  const name = PUBBLICO_ENV[pubblico] || PUBBLICO_ENV.generico
  const id = Number(process.env[name])
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Crea in Brevo la campagna in bozza: senza scheduledAt non parte. */
export async function creaBozza(story: ArticoloNewsletter): Promise<{ id: number; segmento: number; nome: string }> {
  const dati = datiNewsletter(story)
  const segmento = segmentoPer(dati.pubblico)
  if (!segmento) {
    throw new Error(`Segmento Brevo non configurato per il pubblico "${dati.pubblico}"`)
  }

  const templateId = Number(process.env.BREVO_NEWSLETTER_TEMPLATE_ID) || DEFAULT_TEMPLATE_ID
  const senderId = Number(process.env.BREVO_NEWSLETTER_SENDER_ID) || DEFAULT_SENDER_ID
  const senderName = process.env.BREVO_NEWSLETTER_SENDER_NAME || DEFAULT_SENDER_NAME
  const template = await brevoFetch<{ htmlContent?: string }>(`/smtp/templates/${templateId}`, { method: 'GET' })
  if (!template.htmlContent) throw new Error(`Il modello Brevo ${templateId} non ha contenuto`)

  const nome = nomeCampagna(story, dati.titolo)
  const creata = await brevoFetch<{ id: number }>('/emailCampaigns', {
    method: 'POST',
    body: {
      name: nome,
      subject: dati.oggetto,
      previewText: dati.anteprima || undefined,
      // Senza nome Brevo mostra "[DEFAULT_FROM_NAME]"
      sender: { id: senderId, name: senderName },
      htmlContent: compilaLayout(template.htmlContent, dati),
      recipients: { segmentIds: [segmento] },
      utmCampaign: `newsletter-${story.full_slug.split('/').pop() || story.id}`.slice(0, 50),
      tag: 'newsletter',
    },
  })
  return { id: creata.id, segmento, nome }
}
