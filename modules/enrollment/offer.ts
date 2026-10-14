/**
 * Passo 2: edizioni con i posti rimasti e i tre importi già calcolati.
 * Tutto si decide sul server: il browser mostra, non calcola.
 */
import type { Edition } from './catalog'
import { editionAvailability, type EditionAvailability } from './editions'
import { isOfferValid, quote } from './pricing'
import { PAYMENT_MODES, type PaymentMode, type PriceList, type Quote } from './types'

export type EditionOption = Edition & EditionAvailability

export interface CourseOffer {
  edizioni: EditionOption[]
  /** null se il listino in Storyblok manca o è incompleto: il passo 2 non si può completare. */
  prezzi: Record<PaymentMode, Quote> | null
  quota_esame: number | null
  offerta: boolean
  scadenza_offerta: string | null
}

export function buildOffer(
  editions: Edition[],
  signed: Record<string, number>,
  list: PriceList | null,
  scadenza: string | null,
  now: Date = new Date()
): CourseOffer {
  const offerta = !!list && isOfferValid(scadenza, now)
  return {
    edizioni: editions.map((e) => ({ ...e, ...editionAvailability(e.posti, signed[e.chiave] || 0) })),
    prezzi: list
      ? (Object.fromEntries(PAYMENT_MODES.map((m) => [m, quote(list, m, offerta)])) as Record<PaymentMode, Quote>)
      : null,
    quota_esame: list?.esame ?? null,
    offerta,
    scadenza_offerta: offerta ? scadenza : null,
  }
}

/** Chiavi delle edizioni che si possono ancora scegliere. */
export function openEditions(offer: CourseOffer): string[] {
  return offer.edizioni.filter((e) => e.stato !== 'completa').map((e) => e.chiave)
}
