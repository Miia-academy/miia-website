import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact, trackEvent, BrevoError } from '@modules/brevo'
import { createStory, uploadAssetToStoryblok } from '@modules/storyblok'
import StoryblokClient from 'storyblok-js-client'

// Configurazione limite dimensione body per evitare l'errore 413 Payload Too Large
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const COMPANY_LIST_ID = Number(process.env.BREVO_COMPANY_LIST_ID) || 26
const LOGOS_FOLDER_ID = process.env.STORYBLOK_LOGOS_FOLDER_ID || 688306
const BUSINESS_FOLDER_ID = process.env.STORYBLOK_BUSINESS_FOLDER_ID || 680213142
const SPACE_ID = process.env.STORYBLOK_SPACE_ID
const MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT

const storyblok = new StoryblokClient({
  oauthToken: MANAGEMENT_TOKEN,
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const {
    nome, // Rappresenta il Nome dell'Azienda / Ragione Sociale dal form
    email,
    sms,
    settore, // 'interni' | 'moda'
    logoBase64,
    logoFileName,
    logoMimeType,
    redirectUrl,
  } = req.body

  if (!email || typeof email !== 'string' || !nome) {
    return res.status(400).json({ message: 'Email e Nome Azienda sono obbligatori' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const companyName = nome.trim()

  // Normalizzazione settore
  const rawSettore = settore === 'moda' ? 'moda' : 'interni'
  const mappedArea = rawSettore === 'moda' ? 'fashion' : 'interior'

  const origin =
    req.headers.origin ||
    `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`

  try {
    let storyblokLogoUrl = ''

    // 1. Upload Logo su Storyblok Assets (cartella 688306)
    if (logoBase64 && logoFileName) {
      try {
        const buffer = Buffer.from(
          logoBase64.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        )

        storyblokLogoUrl = await uploadAssetToStoryblok(
          buffer,
          `${Date.now()}-${logoFileName}`,
          logoMimeType || 'image/png',
          LOGOS_FOLDER_ID
        )
      } catch (sbAssetErr) {
        console.error('[API Auth Business] Errore upload Logo su Storyblok:', sbAssetErr)
      }
    }

    // Sanitizzazione del nome azienda per lo slug
    const cleanCompanySlug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')

    // Generazione di uno slug UNIVOCISSIMO per evitare errori di collisione su Storyblok:
    // Formato: "azienda-{interni/moda}-{nome-azienda}-{timestamp}"
    const uniqueSlug = `azienda-${rawSettore}-${cleanCompanySlug}-${Date.now()}`

    // 2. Controllo duplicati: verifica se esiste già la story per questa azienda
    let existingStoryId: number | string | null = null

    if (SPACE_ID) {
      try {
        const checkRes: any = await (storyblok as any).get(`spaces/${SPACE_ID}/stories`, {
          by_slugs: `${cleanCompanySlug}*`,
          folder_id: BUSINESS_FOLDER_ID,
        })
        const stories = checkRes?.data?.stories || []
        if (stories.length > 0) {
          existingStoryId = stories[0].id
        }
      } catch (checkErr) {
        console.warn('[API Auth Business] Impossibile verificare storie esistenti:', checkErr)
      }
    }

    // Nome story richiesto: "azienda {area} {nome azienda}"
    const storyName = `azienda ${rawSettore} ${companyName}`

    const businessContent: Record<string, any> = {
      component: 'business',
      title: companyName,
      contact_person: companyName,
      email: cleanEmail,
      area: mappedArea,
    }

    if (storyblokLogoUrl) {
      businessContent.logo = {
        filename: storyblokLogoUrl,
        fieldtype: 'asset',
      }
    }

    // 3. Creazione o aggiornamento della Story
    let storyResult: any = null

    if (existingStoryId && SPACE_ID) {
      // Aggiorna la story esistente senza crearne una nuova
      const updateRes: any = await (storyblok as any).put(
        `spaces/${SPACE_ID}/stories/${existingStoryId}`,
        {
          story: {
            name: storyName,
            content: businessContent,
          },
          publish: 0,
        }
      )
      storyResult = updateRes?.data?.story || updateRes?.story
    } else {
      // Crea nuova story con lo slug univoco
      storyResult = await createStory({
        name: storyName,
        slug: uniqueSlug,
        component: 'business',
        folderId: BUSINESS_FOLDER_ID,
        content: businessContent,
        publish: false,
      })
    }

    const storyblokId = storyResult ? storyResult.id : ''

    // 4. Formattazione e gestione sicura dell'SMS per Brevo
    const formattedSms = sms
      ? sms.startsWith('+39')
        ? sms
        : `+39${sms}`
      : undefined

    const brevoAttributes: Record<string, any> = {
      FIRSTNAME: companyName,
      SETTORE: rawSettore,
      COMPANY: companyName,
      TIPO_UTENTE: 'Azienda',
      LOGO_URL: storyblokLogoUrl,
    }

    if (formattedSms) {
      brevoAttributes.SMS = formattedSms
    }

    // 5. Upsert Contatto Brevo con Fallback per SMS duplicato
    try {
      await upsertContact({
        email: cleanEmail,
        listIds: [COMPANY_LIST_ID],
        attributes: brevoAttributes,
      })
    } catch (brevoErr) {
      if (
        brevoErr instanceof BrevoError &&
        brevoErr.message?.includes('SMS is already associated')
      ) {
        console.warn(
          `[API Auth Business] SMS ${formattedSms} duplicato su Brevo. Inserimento senza campo SMS per ${cleanEmail}.`
        )
        delete brevoAttributes.SMS
        await upsertContact({
          email: cleanEmail,
          listIds: [COMPANY_LIST_ID],
          attributes: brevoAttributes,
        })
      } else {
        throw brevoErr
      }
    }

    // 6. Generazione Token e Magic Link
    const token = jwt.sign({ email: cleanEmail }, JWT_SECRET, { expiresIn: '15m' })
    const encodedRedirect = redirectUrl ? encodeURIComponent(redirectUrl) : ''
    const magicLink = `${origin}/api/auth/verify?token=${token}${encodedRedirect ? `&redirect=${encodedRedirect}` : ''
      }`

    // 7. Tracciamento Evento Brevo per Magic Link (submit_login)
    await trackEvent({
      eventName: 'submit_login',
      email: cleanEmail,
      properties: {
        magic_link: magicLink,
        settore: rawSettore,
        company_name: companyName,
        logo_url: storyblokLogoUrl,
        storyblok_id: storyblokId,
      },
    })

    return res.status(200).json({
      message: 'Registrazione aziendale ricevuta! Controlla la posta per accedere.',
    })
  } catch (error: any) {
    console.error('[API AUTH BUSINESS Error]', error)
    return res.status(500).json({
      message: error?.message || 'Errore durante la registrazione dell’azienda',
    })
  }
}