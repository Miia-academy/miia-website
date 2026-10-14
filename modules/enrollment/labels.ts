/** Etichette in italiano condivise tra pagina, PDF del contratto ed email. */
import type { PaymentMode } from './types'

export const SCOPO_LABELS: Record<string, string> = {
  aggiornare_competenze: 'Aggiornare le mie competenze',
  cambiare_ruolo: 'Cambiare ruolo nel mio lavoro',
  cambiare_settore: 'Cambiare settore',
  professione: 'Farne una professione',
  curiosita: 'Passione e curiosità',
}

export const MODE_LABELS: Record<PaymentMode, string> = {
  unica: 'Soluzione unica',
  '5_rate': '5 rate',
  '10_rate': '10 rate',
}

export const DOCUMENT_LABELS: Record<string, string> = {
  carta_identita: "Carta d'identità",
  passaporto: 'Passaporto',
  patente: 'Patente',
}

export const euro = (n: number) =>
  n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })

/** "7 novembre 2026" da AAAA-MM-GG, senza sorprese di fuso orario. */
export function longDate(day: string): string {
  const date = new Date(`${day.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(date.valueOf())) return day
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

/** "14 ottobre 2026 alle 10:32" nell'ora italiana. */
export function romeDateTime(at: Date): string {
  const date = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }).format(at)
  const time = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(at)
  return `${date} alle ${time}`
}
