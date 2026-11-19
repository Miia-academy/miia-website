/**
 * Dopo la firma lo stato lo cambia la segreteria: recesso (entro i 14 giorni),
 * annullamento (fuori dal recesso, anche deciso dall'accademia) o iscrizione
 * definitiva. Ogni cambio va nel database, nel registro e in Brevo.
 */
import { syncStatusChange } from './brevo-sync'
import { romeDate } from './dates'
import { getEnrollmentById, logEvent, updateEnrollmentStatus } from './db'
import type { Enrollment, EnrollmentStatus } from './types'

/** Stati di arrivo e da quali stati ci si arriva. */
export const STATUS_CHANGES = {
  recesso: ['firmata'],
  annullata: ['firmata', 'definitiva'],
  definitiva: ['firmata'],
} as const satisfies Partial<Record<EnrollmentStatus, readonly EnrollmentStatus[]>>

export type TargetStatus = keyof typeof STATUS_CHANGES

/**
 * Come è arrivata la richiesta. Il recesso vale solo per iscritto (email a
 * iscrizione@, PEC o raccomandata: withdrawal.ts); l'annullamento può anche
 * deciderlo l'accademia.
 */
export const REQUEST_CHANNELS = {
  recesso: ['email', 'pec', 'raccomandata'],
  annullata: ['email', 'pec', 'raccomandata', 'accademia'],
  definitiva: [],
} as const satisfies Record<TargetStatus, readonly string[]>

export const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email a iscrizione@miia.it',
  pec: 'PEC',
  raccomandata: 'Raccomandata',
  accademia: 'Decisione dell’accademia',
}

export function isTargetStatus(value: unknown): value is TargetStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATUS_CHANGES, value)
}

export interface StatusRequest {
  /** Canale della richiesta (non serve per la definitiva). */
  canale?: string
  /** Giorno in cui è arrivata la richiesta, AAAA-MM-GG: per la raccomandata vale la data di spedizione. */
  data?: string
  nota?: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Controlla tempi e modalità della richiesta; null se va bene, altrimenti il motivo. */
export function checkRequest(
  row: Pick<Enrollment, 'stato' | 'firmata_il' | 'fine_recesso'>,
  to: TargetStatus,
  request: StatusRequest,
  today = romeDate()
): string | null {
  if (!(STATUS_CHANGES[to] as readonly string[]).includes(row.stato)) {
    return `Questa iscrizione è "${row.stato}": non può passare a "${to}".`
  }
  const end = row.fine_recesso ? String(row.fine_recesso).slice(0, 10) : ''
  if (to === 'definitiva') {
    return end && today <= end ? `Il recesso è aperto fino al ${end.split('-').reverse().join('/')}: si può segnare definitiva dal giorno dopo.` : null
  }
  if (!(REQUEST_CHANNELS[to] as readonly string[]).includes(request.canale || '')) {
    return 'Indica come è arrivata la richiesta.'
  }
  const data = request.data || ''
  if (!DAY.test(data)) return 'Indica il giorno in cui è arrivata la richiesta.'
  if (data > today) return 'Il giorno della richiesta non può essere nel futuro.'
  const signed = row.firmata_il ? romeDate(new Date(row.firmata_il)) : ''
  if (signed && data < signed) return 'Il giorno della richiesta è prima della firma.'
  if (to === 'recesso') {
    if (end && data > end) {
      return `La richiesta è fuori dai 14 giorni: il recesso scadeva il ${end.split('-').reverse().join('/')}. Se va accettata comunque, usa Annulla.`
    }
  }
  return null
}

export type StatusChange = { ok: true; row: Enrollment } | { ok: false; status: number; message: string }

/**
 * Applica il cambio e lo sincronizza. Se Brevo non risponde il cambio resta
 * valido nel database e il registro lo segna, così si può ripetere l'invio.
 */
export async function changeStatus(id: string, to: TargetStatus, by: string, request: StatusRequest = {}): Promise<StatusChange> {
  const current = await getEnrollmentById(id)
  if (!current) return { ok: false, status: 404, message: 'Iscrizione non trovata.' }
  const problem = checkRequest(current, to, request)
  if (problem) return { ok: false, status: 409, message: problem }

  const row = await updateEnrollmentStatus(id, STATUS_CHANGES[to], to)
  if (!row) return { ok: false, status: 409, message: 'Lo stato è appena cambiato: ricarica la pagina.' }
  let brevo = true
  try {
    await syncStatusChange(row, to)
  } catch (error) {
    brevo = false
    console.error('Brevo, cambio stato iscrizione', row.id, error)
  }
  await logEvent(row.id, to, null, null, {
    da: by,
    canale: request.canale || null,
    data_richiesta: request.data || null,
    nota: (request.nota || '').slice(0, 500),
    brevo,
  })
  return { ok: true, row }
}
