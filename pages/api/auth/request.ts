import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getContact, trackEvent } from '@modules/brevo'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const STUDENT_LIST_ID = 25

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, redirectUrl } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Indirizzo email mancante o non valido' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
  const errorMessage = "L'email inserita non risulta tra quelle degli studenti, controlla di aver inserito la mail corretta o contatta info@miia.it."

  try {
    // 1. Verifica presenza contatto e appartenenza alla lista studenti (ID 25) tramite @modules/brevo
    let contact
    try {
      contact = await getContact({ identifier: cleanEmail })
    } catch (err) {
      return res.status(403).json({ message: errorMessage })
    }

    if (!Array.isArray(contact.listIds) || !contact.listIds.includes(STUDENT_LIST_ID)) {
      return res.status(403).json({ message: errorMessage })
    }

    // 2. Generazione JWT temporaneo (15 minuti)
    const token = jwt.sign({ email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' })

    // 3. Costruzione Magic Link con parametro di redirect (per ritornare alla pagina esatta)
    const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''
    const magicLink = `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''}`

    // 4. Invio evento a Brevo per scatenare l'email di login
    await trackEvent({
      eventName: 'submit_login',
      email: cleanEmail,
      properties: {
        magic_link: magicLink,
      },
    })

    return res.status(200).json({ message: 'Magic link inviato con successo' })

  } catch (error) {
    console.error('[AUTH REQUEST API] Errore server:', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}