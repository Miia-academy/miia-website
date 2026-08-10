// pages/api/auth/student.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertContact, trackEvent } from '@modules/brevo'
import { generateMagicLink } from '@modules/auth'

const STUDENT_LIST_ID = 25

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, nome, cognome, sms, area, redirectUrl } = req.body

  if (!email || typeof email !== 'string' || !nome || !cognome) {
    return res.status(400).json({ message: 'Email, nome e cognome sono obbligatori' })
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    const magicLink = generateMagicLink(req, cleanEmail, redirectUrl)

    await Promise.all([
      upsertContact({
        email: cleanEmail,
        listIds: [STUDENT_LIST_ID],
        attributes: {
          FIRSTNAME: nome,
          LASTNAME: cognome,
          SMS: sms ? (sms.startsWith('+39') ? sms : `+39${sms}`) : undefined,
          AREA: area || 'interni',
          TIPO_UTENTE: 'Studente',
        },
      }),
      trackEvent({
        eventName: 'submit_student_registration',
        email: cleanEmail,
        properties: {
          magic_link: magicLink,
          area: area || 'interni',
        },
      }),
    ])

    return res.status(200).json({
      message: 'Iscrizione completata! Ti abbiamo inviato un link di accesso via email.',
    })
  } catch (error: any) {
    console.error('[API AUTH STUDENT Error]', error)
    return res.status(500).json({ message: 'Errore durante la registrazione dello studente' })
  }
}