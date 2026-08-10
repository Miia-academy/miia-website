import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60 // 604800s

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { token, redirect } = req.query

  if (!token || typeof token !== 'string') {
    return res.redirect('/?error=missing_token')
  }

  try {
    // 1. Verifica del token temporaneo
    const decoded = jwt.verify(token, JWT_SECRET) as { email?: string }

    if (!decoded.email) {
      return res.redirect('/?error=invalid_payload')
    }

    // 2. Generazione Token di Sessione a 7 Giorni
    const sessionToken = jwt.sign(
      { email: decoded.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // 3. Preparazione dati utente per il cookie UI (non sensibile)
    const userDataUI = JSON.stringify({ email: decoded.email })
    const encodedUserData = encodeURIComponent(userDataUI)

    const isProd = process.env.NODE_ENV === 'production'

    // 4. Impostazione DOPPIO COOKIE
    res.setHeader('Set-Cookie', [
      // Cookie A: Sicurezza Backend (HttpOnly - Invisibile a JS)
      `miia_auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SEVEN_DAYS_IN_SECONDS}; ${isProd ? 'Secure;' : ''}`,

      // Cookie B: UI Hint Frontend (Leggibile da JS - Nessuna chiamata API necessaria)
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${SEVEN_DAYS_IN_SECONDS}; ${isProd ? 'Secure;' : ''}`
    ])

    // 5. Redirect alla pagina di destinazione
    const destination = typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
    return res.redirect(destination)

  } catch (error) {
    console.error('[VERIFY API] Token non valido o scaduto:', error)
    return res.redirect('/?error=token_expired_or_invalid')
  }
}