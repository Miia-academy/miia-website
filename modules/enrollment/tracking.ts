/**
 * Evento per GTM quando un'iscrizione viene firmata. Il nome non inizia per
 * "submit_", quindi non attiva i tag dei moduli (contatto/Lead): GA4, Google Ads
 * e Meta lo ricevono solo con i tag dedicati (pacchetto GTM B).
 * Si manda una volta sola, dalla risposta della firma: ricaricando la pagina
 * di conferma non riparte.
 */
import type { Enrollment } from './types'

export const SIGNED_EVENT = 'iscrizione_firmata'

export interface SignedEvent {
  event: typeof SIGNED_EVENT
  /** Id dell'iscrizione: GA4 e Google Ads scartano un secondo invio con lo stesso id. */
  transaction_id: string
  value: number
  currency: 'EUR'
  course: string
  sede: string
  modalita: string
  offerta_open_day: boolean
  /** Inizio dell'edizione (AAAA-MM-GG). */
  inizio: string
}

export function signedEvent(row: Pick<Enrollment, 'id' | 'corso' | 'pagamento_totale' | 'pagamento_modalita' | 'offerta_open_day'>, edizione: { sede?: string | null; inizio?: string | null }): SignedEvent {
  const value = Number(row.pagamento_totale)
  return {
    event: SIGNED_EVENT,
    transaction_id: row.id,
    value: Number.isFinite(value) ? value : 0,
    currency: 'EUR',
    course: row.corso,
    sede: edizione.sede || '',
    modalita: row.pagamento_modalita || '',
    offerta_open_day: row.offerta_open_day,
    inizio: edizione.inizio || '',
  }
}
