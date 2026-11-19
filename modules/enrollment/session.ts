/**
 * Cookie dell'iscrizione: dice al server quale bozza appartiene a chi ha
 * verificato l'email. È separato dal login di studenti e aziende.
 */
import jwt from 'jsonwebtoken'
import type { IncomingMessage } from 'node:http'
import { getJwtSecret } from '@modules/jwt-secret'

export const SESSION_COOKIE = 'miia_iscrizione'
const MAX_AGE = 7 * 24 * 60 * 60
const AUDIENCE = 'iscrizione'

export interface EnrollmentSession {
  id: string
  email: string
  corso: string
}

export function signSession(session: EnrollmentSession): string {
  return jwt.sign({ ...session }, getJwtSecret(), { expiresIn: MAX_AGE, audience: AUDIENCE })
}

export function verifySession(token: string | undefined): EnrollmentSession | null {
  if (!token) return null
  try {
    const data = jwt.verify(token, getJwtSecret(), { audience: AUDIENCE }) as Partial<EnrollmentSession>
    if (typeof data.id !== 'string' || typeof data.email !== 'string' || typeof data.corso !== 'string') return null
    return { id: data.id, email: data.email, corso: data.corso }
  } catch {
    return null
  }
}

export function readSession(req: { cookies?: Partial<Record<string, string>> }): EnrollmentSession | null {
  return verifySession(req.cookies?.[SESSION_COOKIE])
}

function isSecure(req: IncomingMessage): boolean {
  return process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https'
}

export function sessionCookie(token: string, req: IncomingMessage): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${isSecure(req) ? '; Secure' : ''}`
}
