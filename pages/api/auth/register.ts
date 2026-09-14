import type { NextApiRequest, NextApiResponse } from 'next'
import { generateMagicLink, AuthPayload } from '@modules/auth'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'

const BREVO_LIST_AZIENDE = 30

interface RegisterCompanyBody {
  email: string
  nome: string             // Nome Azienda
  contact_person?: string  // Referente
  telefono?: string        // Nuovo campo telefono
  redirectUrl?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, nome, contact_person, telefono, redirectUrl }: RegisterCompanyBody = req.body

  // 1. Validazione input (esclusiva per Aziende)
  if (!email || !nome) {
    return res.status(400).json({ message: 'Email e Nome Azienda sono obbligatori' })
  }

  const cleanEmail = String(email).trim().toLowerCase()

  try {
    // 2. Sincronizzazione CRM Brevo + Assegnazione alla Lista #30
    await upsertContact({
      email: cleanEmail,
      attributes: {
        NOME_AZIENDA: nome,
        REFERENTE: contact_person || '',
        TELEFONO: telefono || '', // Salvataggio del telefono
        SMS: telefono || '',      // Duplicato su SMS per compatibilità nativa con Brevo
        TIPO_UTENTE: 'Azienda',
      },
      listIds: [BREVO_LIST_AZIENDE], // Inserimento forzato nella lista Aziende (#30)
    })

    // 3. Payload e Magic Link per la sessione Azienda
    const payload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: 'Azienda',
      company: nome,
      contact_person: contact_person || '',
    }

    const magicLinkUrl = generateMagicLink(req, payload, redirectUrl)

    // 4. Invio evento Brevo per l'invio dell'email transazionale
    await trackEvent({
      eventName: 'magic_link_requested',
      email: cleanEmail,
      properties: {
        magic_link: magicLinkUrl,
        tipo_utente: 'Azienda',
      },
    })

    return res.status(200).json({
      message: 'Registrazione aziendale completata! Controlla la tua email per accedere.',
    })

  } catch (error: any) {
    console.error('[API Auth Register Business Error]', error)

    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }

    return res.status(500).json({ message: 'Errore interno durante la registrazione' })
  }
}