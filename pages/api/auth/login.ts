// pages/api/auth/login.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { getContact, trackEvent, BrevoError } from '@modules/brevo'
import { generateMagicLink } from '@modules/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, redirectUrl } = req.body

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'Indirizzo email mancante o non valido' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const errorMessage =
    "L'email inserita non risulta tra quelle registrate, controlla di aver inserito la mail corretta o contatta info@miia.it."

  try {
    const contact = await getContact({ identifier: cleanEmail })

    if (!Array.isArray(contact.listIds) || contact.listIds.length === 0) {
      return res.status(403).json({ message: errorMessage })
    }

    const magicLink = generateMagicLink(req, cleanEmail, redirectUrl)

    await trackEvent({
      eventName: 'submit_login',
      email: cleanEmail,
      properties: { magic_link: magicLink },
    })

    return res.status(200).json({ message: 'Magic link inviato con successo!' })
  } catch (err: any) {
    if (err instanceof BrevoError && err.status === 404) {
      return res.status(403).json({ message: errorMessage })
    }
    console.error('[API AUTH LOGIN Error]', err)
    return res.status(500).json({ message: 'Errore durante la procedura di login' })
  }
}