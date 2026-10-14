import type { Event, Person } from '@types'
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
