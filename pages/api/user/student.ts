import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { upsertContact, BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const BREVO_LIST_STUDENTI = 42
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Verifica autenticazione tramite Cookie JWT
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato: effettua prima il login' })
  }

  let authData: AuthPayload & { iat?: number; exp?: number }
  try {
    authData = jwt.verify(token, JWT_SECRET) as any
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida' })
  }

  const { email, name, surname } = authData
  if (!email) {
    return res.status(400).json({ message: 'Email non trovata nella sessione' })
  }

  const { cvBase64, cvFileName, cvMimeType, attributes } = req.body

  try {
    let cvDownloadUrl = authData.cv_url || (authData as any).cv || ''

    // 2. Upload del CV su Google Cloud Storage Privato
    if (cvBase64 && cvFileName) {
      const buffer = Buffer.from(cvBase64.replace(/^data:application\/\w+;base64,/, ''), 'base64')
      const sanitizedFileName = `${Date.now()}-${cvFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`

      const cvUploadResult = await uploadFile({
        fileBuffer: buffer,
        fileName: sanitizedFileName,
        mimeType: cvMimeType || 'application/pdf',
        folderPath: 'cv',
        isPublic: false,
      })

      // Generazione dell'URL sicuro di download
      cvDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(cvUploadResult.id)}`
    }

    // 3. Sincronizzazione CRM Brevo (con associazione forzata alla lista #42)
    const brevoAttributes: Record<string, any> = {
      NOME: attributes?.NOME || name || '',
      COGNOME: attributes?.COGNOME || surname || '',
      SMS: attributes?.SMS || '',
      TIPO_UTENTE: 'Studente',
      CV_URL: cvDownloadUrl,
      ...(attributes || {}),
    }

    await upsertContact({
      email: email.trim().toLowerCase(),
      attributes: brevoAttributes,
      listIds: [BREVO_LIST_STUDENTI], // Assicura che lo studente sia legato alla lista #42
    })

    // 4. Pulizia e rigenerazione Sessione JWT
    const { iat, exp, ...cleanAuthData } = authData

    const competenzeArray = typeof attributes?.COMPETENZE === 'string'
      ? attributes.COMPETENZE.split(', ').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(attributes?.COMPETENZE) ? attributes.COMPETENZE : [])

    const updatedSessionPayload: Record<string, any> = {
      ...cleanAuthData,
      tipo_utente: 'Studente',
      name: brevoAttributes.NOME,
      surname: brevoAttributes.COGNOME,
      sms: brevoAttributes.SMS,
      occupazione: attributes?.OCCUPAZIONE || '',
      comune: attributes?.COMUNE || '',
      provincia: attributes?.PROVINCIA || '',
      ricerca: typeof attributes?.RICERCA === 'boolean' ? attributes.RICERCA : false,
      competenze: competenzeArray,
      cv_url: cvDownloadUrl,
      cv: cvDownloadUrl,
    }

    const updatedSessionToken = jwt.sign(updatedSessionPayload, JWT_SECRET, {
      expiresIn: AUTH_JWT_EXPIRES_IN,
    })

    const isProd = process.env.NODE_ENV === 'production'
    const encodedUserData = encodeURIComponent(JSON.stringify(updatedSessionPayload))

    res.setHeader('Set-Cookie', [
      `miia_auth_token=${updatedSessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    ])

    return res.status(200).json({
      message: 'Preferenze e Curriculum aggiornati con successo!',
      user: updatedSessionPayload,
    })
  } catch (error: any) {
    console.error('[API Student Update Error]', error)

    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }

    return res.status(500).json({
      message: error?.message || 'Errore durante l\'aggiornamento del profilo studente',
    })
  }
}