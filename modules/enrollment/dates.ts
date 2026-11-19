/** Giorni per il recesso dalla firma (Codice del Consumo). */
export const WITHDRAWAL_DAYS = 14

/** Data del calendario italiano (AAAA-MM-GG) per un istante. */
export function romeDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

/** Aggiunge giorni a una data AAAA-MM-GG, senza effetti dell'ora legale. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Ultimo giorno in cui si può recedere: data della firma (in Italia) + 14 giorni. */
export function withdrawalEnd(signedAt: Date): string {
  return addDays(romeDate(signedAt), WITHDRAWAL_DAYS)
}
