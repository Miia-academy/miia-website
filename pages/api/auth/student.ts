import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const STUDENT_LIST_ID = Number(process.env.BREVO_STUDENT_LIST_ID) || 25

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, nome, cognome, sms, area, redirectUrl } = req.body

  if (!email || typeof email !== 'string' || !nome || !cognome) {
    return res.status(400).json({ message: 'Email, nome e cognome sono obbligatori' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const cleanNome = nome.trim()
  const cleanCognome = cognome.trim()
  const rawArea = area === 'moda' ? 'moda' : 'interni'

  const origin =
    req.headers.origin ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  try {
    // 1. Formattazione sicura dell'SMS per Brevo
    const formattedSms = sms
      ? sms.startsWith('+39')
        ? sms
        : `+39${sms}`
      : undefined

    // 2. Preparazione Attributi Contatto Brevo (usando le chiavi ufficiali in italiano)
    const brevoAttributes: Record<string, any> = {
      NOME: cleanNome,
      COGNOME: cleanCognome,
      AREA: rawArea,
      TIPO_UTENTE: 'Studente',
    }

    if (formattedSms) {
      brevoAttributes.SMS = formattedSms
    }

    // 3. Upsert Contatto Brevo con Fallback per SMS duplicato
    try {
      await upsertContact({
        email: cleanEmail,
        listIds: [STUDENT_LIST_ID],
        attributes: brevoAttributes,
      })
    } catch (brevoErr) {
      if (
        brevoErr instanceof BrevoError &&
        brevoErr.message?.includes('SMS is already associated')
      ) {
        console.warn(
          `[API Auth Student] SMS ${formattedSms} duplicato su Brevo. Inserimento senza campo SMS per ${cleanEmail}.`
        )
        delete brevoAttributes.SMS
        await upsertContact({
          email: cleanEmail,
          listIds: [STUDENT_LIST_ID],
          attributes: brevoAttributes,
        })
      } else {
        throw brevoErr
      }
    }

    // 4. Generazione JWT e Magic Link per l'accesso istantaneo
    const token = jwt.sign({ email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' })
    const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''
    const magicLink = `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''
      }`

    // 5. Tracciamento Evento Brevo per l'invio della mail
    await trackEvent({
      eventName: 'submit_student_registration',
      email: cleanEmail,
      properties: {
        magic_link: magicLink,
        nome: cleanNome,
        cognome: cleanCognome,
        area: rawArea,
      },
    })

    return res.status(200).json({
      message: 'Iscrizione completata! Ti abbiamo inviato un link di accesso via email.',
    })
  } catch (error: any) {
    console.error('[API AUTH STUDENT Error]', error)
    return res.status(500).json({
      message: error?.message || 'Errore durante la registrazione dello studente',
    })
  }
}