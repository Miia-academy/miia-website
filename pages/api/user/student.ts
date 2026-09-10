// pages/api/user/student.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { upsertContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Check autenticazione JWT
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

  const {
    cvBase64,
    cvFileName,
    cvMimeType,
    attributes // Gli attributi dal frontend (NOME, COGNOME, SMS, OCCUPAZIONE, COMUNE, PROVINCIA, RICERCA, COMPETENZE)
  } = req.body

  if (!email) {
    return res.status(400).json({ message: 'Email non trovata nella sessione' })
  }

  try {
    let cvDownloadUrl = authData.cv_url || (authData as any).cv || ''

    // 2. Upload del CV su GCS Privato (se fornito un nuovo file)
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

      // Costruiamo l'URL sicuro che passa dalla nostra API di download
      cvDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(cvUploadResult.id)}`
    }

    // 3. Sync CRM Brevo
    const brevoAttributes: Record<string, any> = {
      NOME: attributes?.NOME || name || '',
      COGNOME: attributes?.COGNOME || surname || '',
      SMS: attributes?.SMS || '',
      TIPO_UTENTE: 'Studente',
      CV_URL: cvDownloadUrl,
      ...(attributes || {})
    }

    await upsertContact({
      email: email.trim().toLowerCase(),
      attributes: brevoAttributes,
    })

    // 4. Pulizia metadati JWT ed Estrazione delle competenze come array per la sessione
    const { iat, exp, ...cleanAuthData } = authData

    const competenzeArray = typeof attributes?.COMPETENZE === 'string'
      ? attributes.COMPETENZE.split(', ').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(attributes?.COMPETENZE) ? attributes.COMPETENZE : [])

    // 💡 SALVIAMO TUTTI I DATI NEL PAYLOAD DEL COOKIE!
    const updatedSessionPayload: Record<string, any> = {
      ...cleanAuthData,
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
      expiresIn: '30d',
    })

    const isProd = process.env.NODE_ENV === 'production'
    const encodedUserData = encodeURIComponent(JSON.stringify(updatedSessionPayload))

    res.setHeader('Set-Cookie', [
      `miia_auth_token=${updatedSessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=2592000; ${isProd ? 'Secure;' : ''}`,
    ])

    return res.status(200).json({
      message: 'Preferenze e Curriculum aggiornati con successo!',
      user: updatedSessionPayload,
    })
  } catch (error: any) {
    console.error('[API Student Update Error]', error)
    return res.status(500).json({
      message: error?.message || 'Errore durante l\'aggiornamento del profilo studente',
    })
  }
}