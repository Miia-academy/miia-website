import type { NextApiRequest, NextApiResponse } from 'next'
import { generateMagicLink, AuthPayload } from '@modules/auth'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'
import { Storage } from '@google-cloud/storage'

const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || Number(process.env.BREVO_AZIENDE_LIST_ID) || 30
const PUBLIC_BUCKET_NAME = process.env.GCS_BUCKET_PUBLIC || 'miia-public'

function getStorageClient() {
  const clientEmail = process.env.GCS_CLIENT_EMAIL
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    throw new Error('[GCS] Credenziali di servizio mancanti nelle variabili d\'ambiente')
  }

  return new Storage({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })
}

interface RegisterCompanyBody {
  email: string
  nome: string
  contact_person?: string
  sms?: string
  telefono?: string
  logoBase64?: string
  logoFileName?: string
  logoMimeType?: string
  redirectUrl?: string
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, nome, contact_person, sms, telefono, logoBase64, logoFileName, logoMimeType, redirectUrl }: RegisterCompanyBody = req.body

  if (!email || !nome) {
    return res.status(400).json({ message: 'Email e Nome Azienda sono obbligatori' })
  }

  const cleanEmail = String(email).trim().toLowerCase()
  const phoneValue = sms || telefono || ''

  let finalLogoUrl = ''

  // 1. Gestione caricamento immagine su Google Cloud Storage
  if (logoBase64 && logoFileName) {
    try {
      const storage = getStorageClient()
      const bucket = storage.bucket(PUBLIC_BUCKET_NAME)

      const safeFileName = logoFileName.replace(/[^a-zA-Z0-9.-]/g, '_')
      const uniqueFileName = `aziende/loghi/${Date.now()}-${safeFileName}`
      const file = bucket.file(uniqueFileName)

      const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')

      await file.save(buffer, {
        metadata: { contentType: logoMimeType || 'image/jpeg' },
      })

      finalLogoUrl = `https://storage.googleapis.com/${PUBLIC_BUCKET_NAME}/${uniqueFileName}`
    } catch (gcsError) {
      console.warn('[API Auth Register] Errore durante il caricamento del logo su GCS:', gcsError)
    }
  }

  try {
    // 2. Registrazione o aggiornamento contatto in Brevo
    await upsertContact({
      email: cleanEmail,
      attributes: {
        AZIENDA: nome,
        REFERENTE: contact_person || '',
        SMS: phoneValue,
        LOGO_URL: finalLogoUrl,
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
      logo_url: finalLogoUrl,
    }

    const magicLinkUrl = generateMagicLink(req, payload, redirectUrl)

    // 3. Tracciamento eventi
    await trackEvent({
      eventName: 'company_registered',
      email: cleanEmail,
      properties: {
        nome_azienda: nome,
        referente_azienda: contact_person || '',
        email_azienda: cleanEmail,
        telefono_azienda: phoneValue,
      },
    })

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