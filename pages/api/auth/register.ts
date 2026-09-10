import type { NextApiRequest, NextApiResponse } from 'next'
import { createCompanyStory, uploadAssetToStoryblok } from '@modules/storyblok'
import { upsertContact, trackEvent } from '@modules/brevo'
import { generateMagicLink, type AuthPayload } from '@modules/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  const {
    nome,
    contact_person,
    email,
    sms = false,
    newsletter = false,
    logoBase64,
    logoFileName,
    logoMimeType,
    redirectUrl,
  } = req.body

  if (!nome || !email) {
    return res.status(400).json({ message: 'Nome Azienda ed Email sono obbligatori' })
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    let logoUrl = ''

    // 1. Upload Logo su Storyblok (se fornito)
    if (logoBase64 && logoFileName) {
      const buffer = Buffer.from(logoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      logoUrl = await uploadAssetToStoryblok(buffer, logoFileName, logoMimeType || 'image/png')
    }

    // 2. Creazione della Story Azienda su Storyblok
    const newStory = await createCompanyStory({
      companyName: nome,
      contactName: contact_person || '',
      contactEmail: cleanEmail,
      settore: 'interni',
      logoUrl,
    })

    const storyblokId = String(newStory.id)
    const storyblokUuid = String(newStory.uuid)

    // 3. Costruzione Payload Utente per il Magic Link
    const tokenPayload: AuthPayload = {
      email: cleanEmail,
      company: nome,
      contact_person: contact_person || '',
      storyblok_id: storyblokId,
      storyblok_uuid: storyblokUuid,
      tipo_utente: 'Azienda',
    }

    // 4. Generazione del Magic Link
    const magicLink = generateMagicLink(req, tokenPayload, redirectUrl)

    // 5. Estrazione Nome e Cognome del referente
    let firstName = contact_person || nome
    let lastName = ''
    if (contact_person && contact_person.trim().includes(' ')) {
      const parts = contact_person.trim().split(/\s+/)
      firstName = parts[0]
      lastName = parts.slice(1).join(' ')
    }

    // 6. Sync Anagrafica Brevo con gli attributi ufficiali dello schema
    try {
      await upsertContact({
        email: cleanEmail,
        attributes: {
          NOME: firstName,
          COGNOME: lastName,
          AZIENDA: nome, // 👈 Usa AZIENDA invece di RAGIONE_SOCIALE
          STORYBLOK_ID: storyblokId,
          STORYBLOK_UUID: storyblokUuid,
          ISCRIZIONE_NEWSLETTER: Boolean(newsletter), // 👈 Attributo ufficiale della tua lista
        },
      })

      await trackEvent({
        eventName: 'register_business',
        email: cleanEmail,
        properties: {
          company_name: nome,
          contact_person: contact_person || '',
          storyblok_id: storyblokId,
          storyblok_uuid: storyblokUuid,
          magic_link: magicLink,
          opt_in_newsletter: Boolean(newsletter),
        },
      })
    } catch (brevoError) {
      console.error('[Brevo Sync Error]', brevoError)
    }

    return res.status(200).json({
      message: 'Registrazione avvenuta con successo! Ti abbiamo inviato una e-mail con il link per accedere.',
    })
  } catch (error: any) {
    console.error('[API Register Error]', error)
    return res.status(500).json({
      message: error?.message || 'Errore durante la registrazione aziendale',
    })
  }
}