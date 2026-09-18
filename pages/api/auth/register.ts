import type { NextApiRequest, NextApiResponse } from 'next'
import { generateMagicLink, AuthPayload } from '@modules/auth'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'

const BREVO_LIST_AZIENDE = 30

interface RegisterCompanyBody {
  email: string
  nome: string             // Nome Azienda
  contact_person?: string  // Referente
  sms?: string             // Numero cellulare per SMS / Telefono
  telefono?: string        // Fallback da form client
  logo_url?: string        // URL Logo Aziendale
  redirectUrl?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, nome, contact_person, sms, telefono, logo_url, redirectUrl }: RegisterCompanyBody = req.body

  if (!email || !nome) {
    return res.status(400).json({ message: 'Email e Nome Azienda sono obbligatori' })
  }

  const cleanEmail = String(email).trim().toLowerCase()
  const phoneValue = sms || telefono || ''

  try {
    await upsertContact({
      email: cleanEmail,
      attributes: {
        AZIENDA: nome,
        REFERENTE: contact_person || '',
        SMS: phoneValue,
        LOGO_URL: logo_url || '',
        TIPO_UTENTE: 'Azienda',
      },
      listIds: [BREVO_LIST_AZIENDE],
    })

    const payload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: 'Azienda',
      azienda: nome,
      referente: contact_person || '',
      sms: phoneValue,
      logo_url: logo_url || '',
    }

    const magicLinkUrl = generateMagicLink(req, payload, redirectUrl)

    // Tracciamento registrazione con payload form completo
    await trackEvent({
      eventName: 'company_registered',
      email: cleanEmail,
      properties: {
        azienda: nome,
        referente: contact_person || '',
        sms: phoneValue,
        logo_url: logo_url || '',
      },
    })

    // Tracciamento richiesta Magic Link
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