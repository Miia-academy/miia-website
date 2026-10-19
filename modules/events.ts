import type { Event, Person } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { isStoryResolved } from '@modules/relations'

type EventLike = Pick<Event, 'date' | 'docenti'> & { isOpenday?: boolean }

/**
 * Nomi dei docenti di un evento (campo "Docenti" in Storyblok).
 * Considera solo le schede risolte con un titolo; ignora gli UUID non risolti.
 */
export function getDocentiNames(event?: Pick<Event, 'docenti'> | null): string[] {
  if (!event?.docenti || !Array.isArray(event.docenti)) return []
  return event.docenti
    .filter((docente) => isStoryResolved<Person>(docente))
    .map((docente) => ((docente as { content: Person }).content.title || '').trim())
    .filter(Boolean)
}

/** Dati minimi di una scheda docente presa dall'elenco globale delle persone. */
type PersonLike = { uuid: string; title?: string; role?: string; image?: any; description?: string; video?: string }

/**
 * Schede dei docenti di un evento, nell'ordine scelto in Storyblok.
 * Se Storyblok non ha risolto la relazione (resta l'UUID), la scheda si ricostruisce
 * dall'elenco globale delle persone; gli UUID che non si trovano vengono ignorati.
 */
export function getDocentiStories(
  event?: Pick<Event, 'docenti'> | null,
  persons: PersonLike[] = []
): ISbStoryData<Person>[] {
  if (!event?.docenti || !Array.isArray(event.docenti)) return []
  return event.docenti.flatMap((docente) => {
    if (isStoryResolved<Person>(docente)) return [docente]
    const person = typeof docente === 'string' ? persons.find((p) => p.uuid === docente) : undefined
    if (!person) return []
    const { uuid, title, role, image, description, video } = person
    const content = { component: 'person', _uid: uuid, title, role, image, description, video } as Person
    return [{ uuid, content } as ISbStoryData<Person>]
  })
}

/** Elenco leggibile: "A", "A e B", "A, B e C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] || ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/** L'open day che cade esattamente in quella data e ora, se c'è. */
export function findOpendayByDate<T extends EventLike>(events: T[], isoDate: string): T | undefined {
  const time = new Date(isoDate).getTime()
  if (isNaN(time)) return undefined
  return events.find((ev) => ev.isOpenday && ev.date && new Date(ev.date).getTime() === time)
}
