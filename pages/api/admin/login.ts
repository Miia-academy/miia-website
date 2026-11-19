import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { timingSafeEqual } from 'crypto'
import { getJwtSecret } from '@modules/jwt-secret'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, password } = req.body ?? {}
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

  // Without both variables nobody gets in (an empty request must never match two missing values)
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('[ADMIN] ADMIN_EMAIL or ADMIN_PASSWORD not set: admin login disabled.')
    return res.status(401).json({ message: 'Credenziali non valide' })
  }

  if (sameText(email, ADMIN_EMAIL) && sameText(password, ADMIN_PASSWORD)) {

    const payload = {
      email,
      tipo_utente: 'Admin',
      name: 'Amministratore'
    }

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' })
    const encodedUserData = encodeURIComponent(JSON.stringify(payload))

    // 1. Allineamento logica Secure esatta come in verify.ts e logout.ts
    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const isSecure = process.env.NODE_ENV === 'production' || protocol === 'https'

    // 28800 secondi = 8 ore
    const cookieOptions = `Path=/; SameSite=Lax; Max-Age=28800${isSecure ? '; Secure' : ''}`

    // 2. Rilascio di entrambi i cookie per uniformità di stato
    res.setHeader('Set-Cookie', [
      `miia_auth_token=${token}; HttpOnly; ${cookieOptions}`,
      `miia_user=${encodedUserData}; ${cookieOptions}`
    ])

    return res.status(200).json({ success: true })
  }

  return res.status(401).json({ message: 'Credenziali non valide' })
}
/** Constant-time comparison, so the response time does not reveal how much of the value is right. */
function sameText(value: unknown, expected: string): boolean {
  if (typeof value !== 'string') return false
  const a = Buffer.from(value)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
