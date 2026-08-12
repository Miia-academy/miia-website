import type { NextApiRequest, NextApiResponse } from 'next'
import { getContact, trackEvent, BrevoError } from '@modules/brevo'
import { generateMagicLink, type AuthPayload } from '@modules/auth'

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
    // 1. Verifichiamo che il contatto esista su Brevo
    const contact = await getContact({ identifier: cleanEmail })

    if (!Array.isArray(contact.listIds) || contact.listIds.length === 0) {
      return res.status(403).json({ message: errorMessage })
    }

    // 2. Token leggero: il tipo_utente e i dettagli verranno risolti da verify.ts tramite Brevo
    const tokenPayload: AuthPayload = {
      email: cleanEmail,
    }

    // 3. Generazione del Magic Link
    const magicLink = generateMagicLink(req, tokenPayload, redirectUrl)

    // 4. Invio dell'evento 'user_login' a Brevo per la spedizione dell'email
    await trackEvent({
      eventName: 'user_login',
      email: cleanEmail,
      properties: {
        magic_link: magicLink,
      },
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