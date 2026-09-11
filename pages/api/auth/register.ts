import type { NextApiRequest, NextApiResponse } from 'next'
import { generateMagicLink, AuthPayload } from '@modules/auth'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'

interface RegisterRequestBody {
  email: string
  tipo_utente: 'Azienda' | 'Studente'
  nome?: string            // Nome Azienda o Nome Studente
  contact_person?: string  // Referente Azienda
  surname?: string         // Cognome Studente
  redirectUrl?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, tipo_utente, nome, contact_person, surname, redirectUrl }: RegisterRequestBody = req.body

  if (!email || !tipo_utente) {
    return res.status(400).json({ message: 'Email e tipo utente sono obbligatori' })
  }

  if (tipo_utente === 'Azienda' && !nome) {
    return res.status(400).json({ message: 'Il nome azienda è obbligatorio' })
  }

  try {
    // 1. Sincronizzazione anagrafica su Brevo CRM
    const attributes: Record<string, string> = {
      TIPO_UTENTE: tipo_utente,
    }

    if (tipo_utente === 'Azienda') {
      attributes.NOME_AZIENDA = nome || ''
      if (contact_person) attributes.REFERENTE = contact_person
    } else {
      if (nome) attributes.FIRSTNAME = nome
      if (surname) attributes.LASTNAME = surname
    }

    await upsertContact({
      email,
      attributes,
    })

    // 2. Costruzione del Payload per il JWT
    const payload: AuthPayload = {
      email,
      tipo_utente,
      ...(tipo_utente === 'Azienda'
        ? { company: nome, contact_person }
        : { name: nome, surname })
    }

    // 3. Generazione Magic Link (passando req, payload e redirectUrl)
    const magicLinkUrl = generateMagicLink(req, payload, redirectUrl)

    // 4. Invio dell'evento a Brevo per recapitare l'email con il Magic Link
    await trackEvent({
      eventName: 'magic_link_requested',
      email,
      properties: {
        magic_link: magicLinkUrl,
        tipo_utente,
      },
    })

    return res.status(200).json({
      message: 'Registrazione completata! Ti abbiamo inviato un\'email con il link di accesso.',
    })
  } catch (error) {
    console.error('[API Auth Register Error]', error)

    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }

    return res.status(500).json({ message: 'Errore interno durante la registrazione' })
  }
}