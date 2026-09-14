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
    const token = jwt.sign(
      {
        email,
        tipo_utente: 'Admin',
        name: 'Amministratore'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    // Soluzione nativa: costruiamo la stringa del cookie a mano
    const isProd = process.env.NODE_ENV === 'production'
    const cookieString = `miia_auth_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax${isProd ? '; Secure' : ''}`

    // Impostiamo l'header nativamente
    res.setHeader('Set-Cookie', cookieString)

    return res.status(200).json({ success: true })
  }

  return res.status(401).json({ message: 'Credenziali non valide' })
}