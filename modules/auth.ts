import jwt from 'jsonwebtoken'
import type { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export interface AuthPayload {
  email: string
  tipo_utente: 'Azienda' | 'Studente' | 'Admin'

  // Dati Azienda (Allineati 1:1 con attributi Brevo)
  azienda?: string
  referente?: string
  sms?: string             // Usato per il Telefono
  indirizzo?: string
  sito_web?: string
  descrizione?: string
  logo_url?: string

  // Dati Studente (Allineati 1:1 con attributi Brevo)
  nome?: string
  cognome?: string
  provincia?: string
  ricerca_attiva?: boolean
  automunito?: boolean
  trasferte?: boolean
  competenze?: string[]    // In Brevo è stringa CSV, nel JWT è Array
  cv_url?: string
  portfolio_url?: string
}

export function generateMagicLink(
  req: NextApiRequest,
  payload: AuthPayload,
  redirectUrl?: string
): string {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:9080'
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https')
  const origin = `${protocol}://${host}`

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' })
  const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''

  return `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''}`
}

export function getAuthenticatedEmail(req: NextApiRequest): string | null {
  const token = req.cookies.miia_auth_token
  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    return decoded.email || null
  } catch {
    return null
  }
}