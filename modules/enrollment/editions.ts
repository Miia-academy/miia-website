/**
 * Edizioni programmate (storie "course" di Storyblok) e posti liberi.
 * Le storie vengono riusate negli anni cambiando le date, quindi
 * un'edizione si identifica con uuid della storia + data di inizio.
 */

export function editionKey(storyUuid: string, starts: string | undefined | null): string | null {
  const day = typeof starts === 'string' ? starts.trim().slice(0, 10) : ''
  if (!storyUuid || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return `${storyUuid}:${day}`
}

export type EditionState = 'disponibile' | 'ultimi_posti' | 'completa'

export interface EditionAvailability {
  stato: EditionState
  posti_liberi: number | null
}

/**
 * capacity: posti totali dell'edizione (Storyblok); null se non indicati.
 * signed: iscrizioni firmate o definitive già registrate per l'edizione.
 * fewSeats: sotto questa soglia si mostra "ultimi N posti" (da decidere con Simone).
 */
export function editionAvailability(
  capacity: number | null | undefined,
  signed: number,
  fewSeats = 3
): EditionAvailability {
  if (typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity < 0) {
    return { stato: 'disponibile', posti_liberi: null }
  }
  const left = Math.max(0, Math.floor(capacity) - signed)
  if (left === 0) return { stato: 'completa', posti_liberi: 0 }
  return { stato: left <= fewSeats ? 'ultimi_posti' : 'disponibile', posti_liberi: left }
}

/** Legge la capienza da Storyblok: numero, o testo con un numero (come l'attuale campo seats). */
export function parseCapacity(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^\d+$/)
  return match ? Number(match[0]) : null
}
