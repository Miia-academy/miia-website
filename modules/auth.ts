import jwt from 'jsonwebtoken'
import type { NextApiRequest } from 'next'
import { AUTH_JWT_EXPIRES_IN } from '@config/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export interface AuthPayload {
  email: string
  storyblok_id?: string      // Numeric ID (es. "680213142") per Management API
  storyblok_uuid?: string    // UUID (es. "b6a76843-...") per relazioni (job.business)
  company?: string           // Nome Azienda
  contact_person?: string    // Persona di riferimento
  tipo_utente?: 'Azienda' | 'Studente' | 'Admin'
  name?: string              // Nome Studente
  surname?: string           // Cognome Studente
  cv_url?: string            // URL del Curriculum caricato su GCS
}

/**
 * Genera l'URL del Magic Link integrando l'intero AuthPayload nel JWT
 */
export function generateMagicLink(
  req: NextApiRequest,
  payload: AuthPayload,
  redirectUrl?: string
): string {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:9080'

  // Rilevamento dinamico del protocollo (HTTP per localhost, HTTPS per Vercel/Prod)
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
  const protocol = req.headers['x-forwarded-proto'] || (isLocalhost ? 'http' : 'https')
  const origin = `${protocol}://${host}`

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' })
  const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''

  return `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''}`
}

/**
 * Legge l'email dell'utente autenticato dal cookie HttpOnly
 */
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