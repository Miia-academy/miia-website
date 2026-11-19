/**
 * GTM event when an enrollment is signed: submit_signature_form, the same name
 * as the Brevo event. The GTM triggers of the forms list their events one by one
 * (container file of 22/10), so this one fires only the purchase tags
 * (GA4, Google Ads, Meta) and is not counted twice by the generic GA4 tag.
 * Sent once, from the signing response: reloading the confirmation page does not resend it.
 */
import { EVENTS } from '@modules/brevo-events'
import type { Enrollment } from './types'

export const SIGNED_EVENT = EVENTS.signature

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
