/**
 * Dati dell'iscrizione letti da Storyblok: edizioni del corso (storie "course"
 * nella cartella del corso) e listino (datasource "listino", uguale per tutti i corsi).
 *
 * Le API non passano da _app, quindi qui si usa direttamente la Content Delivery API.
 */
import { getStoryblokVersion } from '@config/version'
import { courseFromEditionSlug } from './courses'
import { romeDate } from './dates'
import { editionKey, parseCapacity } from './editions'
import { isPriceListValid } from './pricing'
import type { PriceList } from './types'

const CDN = 'https://api.storyblok.com/v2/cdn'

async function cdn<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW
  if (!token) throw new Error('NEXT_PUBLIC_STORYBLOK_PREVIEW mancante')
  const query = new URLSearchParams({ token, version: getStoryblokVersion(), ...params })
  const res = await fetch(`${CDN}/${path}?${query}`)
  if (!res.ok) throw new Error(`Storyblok ${path}: ${res.status}`)
  return res.json() as Promise<T>
}

// --- Listino ---

/** Nomi delle voci del datasource "listino" in Storyblok. */
export const PRICE_KEYS: Record<keyof PriceList, string> = {
  unica: 'prezzo_unica',
  rata5: 'rata_5',
  rata10: 'rata_10',
  offerta: 'prezzo_open_day',
  esame: 'quota_esame',
}

/** Accetta "5490", "5490.50" e "5.490,50"; null se non è un importo. */
function amount(value: unknown): number | null {
  if (typeof value !== 'string') return null
  let text = value.replace(/[€\s]/g, '')
  if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.')
  const n = Number(text)
  return text && Number.isFinite(n) ? n : null
}

export function parsePriceList(entries: Array<{ name?: string; value?: string }>): PriceList | null {
  const byName = new Map(entries.map((e) => [String(e.name || '').trim(), e.value]))
  const list = Object.fromEntries(
    (Object.keys(PRICE_KEYS) as Array<keyof PriceList>).map((k) => [k, amount(byName.get(PRICE_KEYS[k]))])
  ) as Partial<PriceList>
  return isPriceListValid(list) ? list : null
}

export async function getPriceList(): Promise<PriceList | null> {
  const data = await cdn<{ datasource_entries: Array<{ name: string; value: string }> }>('datasource_entries', {
    datasource: 'listino',
    per_page: '100',
  })
  return parsePriceList(data.datasource_entries || [])
}

// --- Edizioni ---

export interface Edition {
  chiave: string
  titolo: string
  sede: string
  giorni: string[]
  orari: string[]
  inizio: string
  fine: string | null
  /** Posti disponibili dell'edizione (campo "posti" in Storyblok); null se non indicati. */
  posti: number | null
}

interface Story {
  uuid: string
  full_slug: string
  content: Record<string, any>
}

const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [])

/** Edizione dalla storia Storyblok; null se senza data di inizio o già iniziata. */
export function toEdition(story: Story, locations: Map<string, string>, now: Date = new Date()): Edition | null {
  const c = story.content || {}
  const key = editionKey(story.uuid, c.starts)
  if (!key) return null
  const inizio = String(c.starts).slice(0, 10)
  if (inizio < romeDate(now)) return null
  const locationId = typeof c.location === 'string' ? c.location : c.location?.uuid
  return {
    chiave: key,
    titolo: typeof c.title === 'string' ? c.title : '',
    sede: locations.get(locationId) || '',
    giorni: list(c.days),
    orari: list(c.hours),
    inizio,
    fine: typeof c.ends === 'string' && c.ends ? c.ends.slice(0, 10) : null,
    posti: parseCapacity(c.seats),
  }
}

/** Edizioni future del corso, in ordine di inizio. */
export async function getCourseEditions(corso: string, now: Date = new Date()): Promise<Edition[]> {
  const [courses, places] = await Promise.all([
    cdn<{ stories: Story[] }>('stories', { content_type: 'course', starts_with: 'corsi/', per_page: '100' }),
    cdn<{ stories: Story[] }>('stories', { content_type: 'location', per_page: '100' }),
  ])
  const locations = new Map(places.stories.map((s) => [s.uuid, String(s.content?.title || s.content?.name || '')]))
  return courses.stories
    .filter((s) => courseFromEditionSlug(s.full_slug) === corso)
    .map((s) => toEdition(s, locations, now))
    .filter((e): e is Edition => e !== null)
    .sort((a, b) => a.inizio.localeCompare(b.inizio))
}
