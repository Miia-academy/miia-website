import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, password } = req.body
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env

  // Verifica ferrea contro il file .env
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {

    const payload = {
      email,
      tipo_utente: 'Admin',
      name: 'Amministratore'
    }

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
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