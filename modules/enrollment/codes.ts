/**
 * Codici a 6 cifre per verificare l'email (e, più avanti, per la firma).
 * Nel database si salva solo l'impronta del codice, legata a email e scopo.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { getJwtSecret } from '@modules/jwt-secret'

export type CodePurpose = 'email' | 'firma'

export const CODE_TTL_MINUTES = 10
export const CODE_MAX_ATTEMPTS = 5
/** Invii per email in un'ora. */
export const CODE_MAX_PER_EMAIL = 3
/** Invii per IP in un'ora: più largo, perché un ufficio o una scuola condividono l'IP. */
export const CODE_MAX_PER_IP = 10
/** Attesa minima prima di "Mandalo di nuovo". */
export const CODE_RESEND_SECONDS = 30

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function hashCode(email: string, purpose: CodePurpose, code: string): string {
  return createHmac('sha256', getJwtSecret()).update(`${purpose}:${email}:${code}`).digest('hex')
}

export function codeMatches(hash: string, email: string, purpose: CodePurpose, code: string): boolean {
  const expected = Buffer.from(hashCode(email, purpose, code), 'hex')
  const actual = Buffer.from(hash, 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/** Accetta il codice anche con spazi (incollato dall'email); null se non sono 6 cifre. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const code = String(value).replace(/\s/g, '')
  return /^\d{6}$/.test(code) ? code : null
}

export interface RecentSends {
  perEmail: number
  perIp: number
  lastAt: Date | null
}

/** Secondi da attendere prima di poter chiedere un nuovo codice (0 = si può). */
export function sendWaitSeconds(recent: RecentSends, now: Date = new Date()): number {
  if (recent.perEmail >= CODE_MAX_PER_EMAIL || recent.perIp >= CODE_MAX_PER_IP) return 3600
  if (!recent.lastAt) return 0
  const elapsed = (now.getTime() - recent.lastAt.getTime()) / 1000
  return Math.max(0, Math.ceil(CODE_RESEND_SECONDS - elapsed))
}
