import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN, AUTH_REFRESH_THRESHOLD } from '@config/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const token = req.cookies.miia_auth_token

  if (!token) {
    return res.status(401).json({ message: 'Nessuna sessione attiva' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const exp = decoded.exp as number
    const now = Math.floor(Date.now() / 1000)

    if (exp - now < AUTH_REFRESH_THRESHOLD) {
      delete decoded.iat
      delete decoded.exp

      const newSessionToken = jwt.sign(decoded, JWT_SECRET, { expiresIn: AUTH_JWT_EXPIRES_IN })
      const encodedUserData = encodeURIComponent(JSON.stringify(decoded))
      const isProd = process.env.NODE_ENV === 'production'

      res.setHeader('Set-Cookie', [
        `miia_auth_token=${newSessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
        `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`
      ])

      return res.status(200).json({ refreshed: true })
    }

    return res.status(200).json({ refreshed: false })
  } catch (err) {
    return res.status(401).json({ message: 'Sessione non valida o scaduta' })
  }
}