import type { NextApiRequest, NextApiResponse } from 'next'
import { randomUUID } from 'crypto'
import { Storage } from '@google-cloud/storage'
import { getContact, createContact, upsertContact, trackEvent, BrevoError } from '@modules/brevo'
import { normalizePhone } from '@modules/crm-form'
import { IMAGE_KINDS, InvalidUpload, parseUpload, type ParsedUpload } from '@modules/uploads'

// Aziende APPROVATE: la lista dà accesso all'area riservata e la gestiscono solo i referenti MIIA da Brevo.
const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || Number(process.env.BREVO_AZIENDE_LIST_ID) || 30
// Richieste di accesso in attesa di approvazione: qui finisce chi si registra dal sito.
const BREVO_LIST_RICHIESTE = Number(process.env.BREVO_BUSINESS_REQUESTS_LIST_ID) || 8
const PUBLIC_BUCKET_NAME = process.env.GCS_BUCKET_PUBLIC || 'miia-public'

const MAX_LOGO_BYTES = 1_000_000
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// La risposta è identica per contatti nuovi o già presenti: non rivela chi è in archivio.
const RICHIESTA_RICEVUTA =
  'Richiesta ricevuta. Verificheremo i dati dell’azienda e ti scriveremo non appena l’account sarà approvato.'

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

async function uploadLogo(logo: ParsedUpload): Promise<string> {
  try {
    const bucket = getStorageClient().bucket(PUBLIC_BUCKET_NAME)
    const fileName = `aziende/loghi/${Date.now()}-${randomUUID()}.${logo.ext}`

    await bucket.file(fileName).save(logo.buffer, { metadata: { contentType: logo.mime } })

    return `https://storage.googleapis.com/${PUBLIC_BUCKET_NAME}/${fileName}`
  } catch (gcsError) {
    console.warn('[API Auth Register] Errore durante il caricamento del logo su GCS:', gcsError)
    return ''
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { email, nome, contact_person, sms, telefono, logoBase64 } = req.body ?? {}

  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const companyName = typeof nome === 'string' ? nome.trim().slice(0, 120) : ''
  const referente = typeof contact_person === 'string' ? contact_person.trim().slice(0, 120) : ''
  const phone = normalizePhone(sms || telefono) || ''

  if (!cleanEmail || !companyName) {
    return res.status(400).json({ message: 'Email e Nome Azienda sono obbligatori' })
  }

  if (cleanEmail.length > 254 || !EMAIL_REGEX.test(cleanEmail)) {
    return res.status(400).json({ message: 'Indirizzo email non valido' })
  }

  try {
    // Il logo si valida prima di tutto: gli errori sono gli stessi per contatti nuovi e già presenti.
    // The logo goes to a public bucket: only real images, type decided from the content
    const logo = parseUpload(logoBase64, { kinds: IMAGE_KINDS, maxBytes: MAX_LOGO_BYTES, label: 'logo', formats: 'PNG, JPG o WebP' })

    // 1. Il contatto esiste già? In quel caso i suoi dati non si toccano.
    let existing: any = null
    try {
      existing = await getContact({ identifier: cleanEmail })
    } catch (e) {
      if (!(e instanceof BrevoError && e.status === 404)) throw e
    }

    if (!existing) {
      // 2a. Contatto nuovo: si crea con i dati della richiesta, in attesa di approvazione.
      const logoUrl = logo ? await uploadLogo(logo) : ''

      try {
        await createContact({
          email: cleanEmail,
          attributes: {
            AZIENDA: companyName,
            REFERENTE: referente,
            SMS: phone,
            LOGO_URL: logoUrl,
            TIPO_UTENTE: 'Azienda',
          },
          listIds: [BREVO_LIST_RICHIESTE],
        })
      } catch (e) {
        // Creato nel frattempo da un'altra richiesta, oppure telefono già associato a un altro contatto:
        // si registra comunque la richiesta senza modificare nessun dato.
        if (e instanceof BrevoError && e.status === 400 && e.data?.code === 'duplicate_parameter') {
          await upsertContact({ email: cleanEmail, listIds: [BREVO_LIST_RICHIESTE] })
        } else {
          throw e
        }
      }
    } else {
      // 2b. Contatto già presente: solo la richiesta di accesso, nessun attributo modificato.
      const listIds: number[] = Array.isArray(existing.listIds) ? existing.listIds : []

      if (!listIds.includes(BREVO_LIST_AZIENDE) && !listIds.includes(BREVO_LIST_RICHIESTE)) {
        await upsertContact({ email: cleanEmail, listIds: [BREVO_LIST_RICHIESTE] })
      }
    }

    // 3. L'evento porta con sé i dati inseriti: serve per valutare la richiesta, anche se il contatto esisteva.
    try {
      await trackEvent({
        eventName: 'company_registered',
        email: cleanEmail,
        properties: {
          nome_azienda: companyName,
          referente_azienda: referente,
          email_azienda: cleanEmail,
          telefono_azienda: phone,
        },
      })
    } catch (eventError) {
      console.error('[API Auth Register Business] Evento company_registered non inviato:', eventError)
    }

    return res.status(200).json({ message: RICHIESTA_RICEVUTA })
  } catch (error: any) {
    if (error instanceof InvalidUpload) {
      return res.status(400).json({ message: error.message })
    }

    console.error('[API Auth Register Business Error]', error)

    if (error instanceof BrevoError) {
      return res.status(502).json({ message: 'Servizio momentaneamente non disponibile. Riprova più tardi.' })
    }

    return res.status(500).json({ message: 'Errore interno durante la registrazione' })
  }
}
