import type { PaymentMode, PriceList, Quote } from './types'
import { romeDate } from './dates'

const INSTALLMENTS: Record<PaymentMode, number> = {
  unica: 1,
  '5_rate': 5,
  '10_rate': 10,
}

/**
 * L'offerta open day vale se OFFERTA_SCADENZA_DATA (attributo Brevo, data di
 * partecipazione + 14 giorni) è oggi o nel futuro, contando i giorni in Italia.
 */
export function isOfferValid(scadenza: unknown, now: Date = new Date()): boolean {
  if (typeof scadenza !== 'string' || !scadenza.trim()) return false
  const day = scadenza.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) return false
  return day >= romeDate(now)
}

function fullTotal(list: PriceList, mode: PaymentMode): number {
  if (mode === '5_rate') return list.rata5 * 5
  if (mode === '10_rate') return list.rata10 * 10
  return list.unica
}

/**
 * Calcola rata e totale per una modalità di pagamento.
 * Con l'offerta open day tutte le modalità costano il prezzo dell'offerta:
 * cambia solo come si divide. I centesimi che avanzano vanno sulla prima rata.
 */
export function quote(list: PriceList, mode: PaymentMode, offer: boolean): Quote {
  const rate = INSTALLMENTS[mode]
  const pieno = fullTotal(list, mode)
  const totale = offer ? list.offerta : pieno

  const cents = Math.round(totale * 100)
  const base = Math.floor(cents / rate)
  const first = base + (cents - base * rate)

  return {
    modalita: mode,
    rate,
    rata: base / 100,
    prima_rata: first / 100,
    totale,
    totale_pieno: pieno,
    offerta: offer,
  }
}

/** Controlla che il listino letto da Storyblok sia completo e sensato. */
export function isPriceListValid(list: Partial<PriceList> | null | undefined): list is PriceList {
  if (!list) return false
  const values = [list.unica, list.rata5, list.rata10, list.offerta, list.esame]
  return values.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
}
