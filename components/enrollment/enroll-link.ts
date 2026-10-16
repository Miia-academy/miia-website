import { courseFromEditionSlug } from '@modules/enrollment/courses'

/**
 * Link alla pagina di iscrizione online per un'edizione mostrata sul sito,
 * con l'edizione già scelta al passo 2: /iscrizione/<cartella del corso>?edizione=<chiave>.
 * null se dalla storia non si ricava il corso.
 */
export function enrollHref(fullSlug: string | undefined | null, key: string | null): string | null {
  const corso = courseFromEditionSlug(fullSlug)
  if (!corso) return null
  return key ? `/iscrizione/${corso}?edizione=${encodeURIComponent(key)}` : `/iscrizione/${corso}`
}

/**
 * Il pulsante si mostra solo quando l'iscrizione online è accesa: lo dice la
 * risposta dei posti (con l'interruttore spento l'API risponde 404 e counts resta null),
 * e solo se l'edizione ha ancora posti.
 */
export function canEnroll(counts: Record<string, number> | null, seatsText: string | null): boolean {
  return counts !== null && seatsText !== 'completo'
}
