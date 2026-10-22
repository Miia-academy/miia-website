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

/**
 * Il modulo di richiesta iscrizione (tracking "enroll"). Il tracking può stare nel
 * modulo collegato (alias) o nel blocco della pagina, e in alcune pagine è salvato
 * come elenco (["enroll"]).
 */
export function isEnrollForm(form: { tracking?: unknown; alias?: unknown }): boolean {
  const alias = form.alias as { content?: { tracking?: unknown } } | null | undefined
  const tracking = alias?.content?.tracking || form.tracking
  return (Array.isArray(tracking) ? tracking[0] : tracking) === 'enroll'
}

/** Where a Storyblok action points to: the URL, or the story path. */
export function actionHref(action: { link?: unknown }): string | null {
  const link = action.link as { url?: unknown; cached_url?: unknown; linktype?: unknown } | null | undefined
  if (!link) return null
  const url = typeof link.url === 'string' && link.url.trim() ? link.url.trim() : ''
  const cached = typeof link.cached_url === 'string' && link.cached_url.trim() ? link.cached_url.trim() : ''
  const target = url || cached
  if (!target) return null
  return /^(https?:|mailto:|tel:|\/|#)/.test(target) ? target : `/${target}`
}

/**
 * The enrollment button in the aside: a Storyblok action with link
 * /iscrizione/<course> (it replaces the enrollment request form).
 */
export function isEnrollAction(blok: { component?: unknown; link?: unknown; [k: string]: unknown }): boolean {
  if (blok.component !== 'action') return false
  const href = actionHref(blok)
  return !!href && /^\/iscrizione\/[a-z0-9-]+\/?(\?.*)?$/.test(href)
}
