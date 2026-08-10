// modules/auth.ts
import jwt from 'jsonwebtoken'
import type { NextApiRequest } from 'next'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

/**
 * Genera il Magic Link per la verifica e l'impostazione della sessione
 */
export function generateMagicLink(
  req: NextApiRequest,
  email: string,
  redirectUrl?: string
): string {
  const origin =
    req.headers.origin ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '15m' })
  const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''

  return `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''
    }`
}

/**
 * Legge l'email dell'utente autenticato dal cookie HttpOnly miia_auth_token
 */
export function getAuthenticatedEmail(req: NextApiRequest): string | null {
  const token = req.cookies.miia_auth_token
  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email?: string }
    return decoded.email || null
  } catch {
    return null
  }
}