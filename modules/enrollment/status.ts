/**
 * Dopo la firma lo stato lo cambia la segreteria: recesso (entro i 14 giorni),
 * annullamento (fuori dal recesso) o iscrizione definitiva. Ogni cambio va nel
 * database, nel registro e in Brevo.
 */
import { syncStatusChange } from './brevo-sync'
import { logEvent, updateEnrollmentStatus } from './db'
import type { Enrollment, EnrollmentStatus } from './types'

/** Stati di arrivo e da quali stati ci si arriva. */
export const STATUS_CHANGES = {
  recesso: ['firmata'],
  annullata: ['firmata', 'definitiva'],
  definitiva: ['firmata'],
} as const satisfies Partial<Record<EnrollmentStatus, readonly EnrollmentStatus[]>>

export type TargetStatus = keyof typeof STATUS_CHANGES

export function isTargetStatus(value: unknown): value is TargetStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(STATUS_CHANGES, value)
}

export type StatusChange = { ok: true; row: Enrollment } | { ok: false; message: string }

/**
 * Applica il cambio e lo sincronizza. Se Brevo non risponde il cambio resta
 * valido nel database e il registro lo segna, così si può ripetere l'invio.
 */
export async function changeStatus(
  id: string,
  to: TargetStatus,
  by: string,
  note = ''
): Promise<StatusChange> {
  const row = await updateEnrollmentStatus(id, STATUS_CHANGES[to], to)
  if (!row) return { ok: false, message: `Questa iscrizione non può passare a "${to}" dallo stato attuale.` }
  let brevo = true
  try {
    await syncStatusChange(row, to)
  } catch (error) {
    brevo = false
    console.error('Brevo, cambio stato iscrizione', row.id, error)
  }
  await logEvent(row.id, to, null, null, { da: by, nota: note.slice(0, 500), brevo })
  return { ok: true, row }
}
