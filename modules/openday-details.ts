/**
 * Open day details saved on the Brevo contact when a person signs up for an open day,
 * so the open day emails can show date, start, timetable, teachers and prices
 * (attributes OD_*, PREZZO_* and PROSSIMO_OD_TESTO).
 *
 * Everything is read from Storyblok: the "event" story (by its slug, OD_CODICE),
 * the editions of the matching course and the "listino" datasource.
 * Loading never blocks a sign-up: if anything is missing, nothing is added and the
 * emails fall back to their default texts.
 */
import { cdn, getCourseEditions, getPriceList, type Edition } from '@modules/enrollment/catalog'
import { normalizeCodice, quandoTesto, toEvento, type OpendayEvento } from '@modules/openday-accesso'
import { joinNames } from '@modules/events'
import type { PriceList } from '@modules/enrollment/types'

export type OpendayDetails = Record<string, string | boolean>

const AREA_FOLDERS: Record<string, string> = {
  interni: 'interior-design',
  moda: 'fashion-design',
}

/** "interni - primo livello" → "corso-interior-design-primo-livello" (folder name in Storyblok). */
export function courseForOpenday(openday: string | undefined | null): string | null {
  const [area, level] = String(openday || '')
    .split(' - ')
    .map((part) => part.trim().toLowerCase())
  const folder = AREA_FOLDERS[area]
  if (!folder || !/^(primo|secondo) livello$/.test(level || '')) return null
  return `corso-${folder}-${level.replace(' ', '-')}`
}

/** 4990 → "4.990 €", 499.5 → "499,50 €" (as written in the emails). */
export function euro(amount: number): string {
  const cents = Math.round(amount * 100)
  const whole = Math.floor(cents / 100)
  const rest = cents % 100
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${grouped}${rest ? `,${String(rest).padStart(2, '0')}` : ''} €`
}

/** "2027-03-06" → "marzo 2027" */
export function monthText(day: string): string {
  return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day.slice(0, 10)}T12:00:00Z`)
  )
}

/** "lunedì 14 dicembre" */
export function dayText(at: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(at)
}

/** "Treviso: sabato, 9:00-12:00 e 13:00-16:00" for each edition starting in the first start month. */
export function calendarText(editions: Edition[]): string {
  if (!editions.length) return ''
  const month = editions[0].inizio.slice(0, 7)
  return editions
    .filter((e) => e.inizio.startsWith(month))
    .map((e) => {
      const days = joinNames(e.giorni.map((d) => d.toLowerCase()))
      const hours = joinNames(e.orari.map((h) => h.replace('/', '-')))
      const when = [days, hours].filter(Boolean).join(', ')
      return [e.sede, when].filter(Boolean).join(': ')
    })
    .filter(Boolean)
    .join('; ')
}

export function priceAttributes(list: PriceList): OpendayDetails {
  return {
    PREZZO_OD: euro(list.offerta),
    PREZZO_OD_RATA5: euro(list.offerta / 5),
    PREZZO_OD_RATA10: euro(list.offerta / 10),
    PREZZO_UNICA: euro(list.unica),
    PREZZO_RATA5: euro(list.rata5),
    PREZZO_RATA10: euro(list.rata10),
    PREZZO_ESAME: euro(list.esame),
  }
}

interface DetailsInput {
  event: OpendayEvento
  /** All open days, in date order. */
  events: OpendayEvento[]
  teachers: string[]
  /** Future editions of the open day's course, in start order (empty if unknown). */
  editions: Edition[]
  priceList: PriceList | null
}

/**
 * Attributes for the contact. OD_VALIDO (reserved open day price) is true when the
 * open day leads to a course with a future edition and the price list is complete.
 */
export function buildOpendayDetails({ event, events, teachers, editions, priceList }: DetailsInput): OpendayDetails {
  const details: OpendayDetails = {
    OD_DATA_TESTO: quandoTesto(event.inizio),
    OD_VALIDO: !!priceList && editions.length > 0,
  }
  if (teachers.length) details.OD_DOCENTI = joinNames(teachers)
  if (editions.length) {
    details.OD_PARTENZA = monthText(editions[0].inizio)
    const calendar = calendarText(editions)
    if (calendar) details.OD_CALENDARIO = calendar
  }
  if (priceList) Object.assign(details, priceAttributes(priceList))
  const next = events.find((e) => e.area === event.area && e.inizio > event.inizio)
  if (next) details.PROSSIMO_OD_TESTO = dayText(next.inizio)
  return details
}

interface EventStory {
  slug?: string
  name?: string
  content?: { date?: string; title?: string; openday?: string; link_meet?: string; docenti?: unknown }
}

async function loadTeachers(uuids: string[]): Promise<string[]> {
  if (!uuids.length) return []
  const data = await cdn<{ stories: Array<{ uuid: string; content?: { title?: string } }> }>('stories', {
    by_uuids: uuids.join(','),
    per_page: '100',
  })
  const names = new Map(data.stories.map((s) => [s.uuid, String(s.content?.title || '').trim()]))
  return uuids.map((uuid) => names.get(uuid) || '').filter(Boolean)
}

/** Details for the open day with this code (event slug); {} if it can't be loaded. */
export async function loadOpendayDetails(code: unknown): Promise<OpendayDetails> {
  const slug = normalizeCodice(code)
  if (!slug) return {}
  try {
    const data = await cdn<{ stories: EventStory[] }>('stories', { content_type: 'event', per_page: '100' })
    const story = data.stories.find((s) => s.slug === slug)
    const event = story && toEvento(story)
    if (!story || !event) return {}
    const events = data.stories
      .map(toEvento)
      .filter((e): e is OpendayEvento => !!e)
      .sort((a, b) => a.inizio.getTime() - b.inizio.getTime())
    const course = courseForOpenday(story.content?.openday)
    const teacherIds = Array.isArray(story.content?.docenti)
      ? story.content.docenti.filter((id): id is string => typeof id === 'string')
      : []
    const [teachers, editions, priceList] = await Promise.all([
      loadTeachers(teacherIds).catch(() => []),
      course ? getCourseEditions(course, event.inizio).catch(() => []) : Promise.resolve([]),
      getPriceList().catch(() => null),
    ])
    return buildOpendayDetails({ event, events, teachers, editions, priceList })
  } catch (error) {
    console.error('[Open day] Could not load details from Storyblok:', error)
    return {}
  }
}
