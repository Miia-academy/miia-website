import { courseFromEditionSlug } from '@modules/enrollment/courses'
import { seatsLabel } from '@components/enrollment/use-seats'

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

/**
 * Pulsante principale della pagina corso: porta all'iscrizione online del corso
 * (edizione da scegliere al passo 2) se l'iscrizione è accesa e almeno una
 * delle edizioni mostrate ha posti. null altrimenti: resta il modulo di sempre.
 */
export function mainEnrollHref(
  editions: Array<{ key: string | null; seats: unknown; fullSlug: string | null }>,
  counts: Record<string, number> | null
): string | null {
  const open = editions.find((e) => e.key && canEnroll(counts, seatsLabel(e.seats, e.key, counts)))
  return open ? enrollHref(open.fullSlug, null) : null
}
