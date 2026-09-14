import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { upsertContact, BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || 43
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Authenticate Session
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato' })
  }

  let authData: AuthPayload & { iat?: number; exp?: number }
  try {
    authData = jwt.verify(token, JWT_SECRET) as any
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta' })
  }

  if (authData.tipo_utente !== 'Azienda') {
    return res.status(403).json({ message: 'Accesso negato: rotta riservata alle aziende' })
  }

  const { email } = authData
  const {
    companyName,
    contactPerson,
    telefono,
    indirizzo,
    website,
    description,
    logoBase64,
    logoFileName,
    logoMimeType,
  } = req.body

  try {
    let logoUrl = (authData as any).logo_url || ''

    // 2. Upload Logo se fornito
    if (logoBase64 && logoFileName) {
      const buffer = Buffer.from(logoBase64.replace(/^data:.*;base64,/, ''), 'base64')
      const sanitizedFileName = `${Date.now()}-logo-${logoFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`

      const logoUploadResult = await uploadFile({
        fileBuffer: buffer,
        fileName: sanitizedFileName,
        mimeType: logoMimeType || 'image/png',
        folderPath: 'logos',
        isPublic: true,
      })

      logoUrl = logoUploadResult.publicUrl || `${BASE_URL}/api/job/download?file=${encodeURIComponent(logoUploadResult.id)}`
    }

    // 3. Sync CRM Brevo
    const brevoAttributes: Record<string, any> = {
      NOME_AZIENDA: companyName || '',
      REFERENTE: contactPerson || '',
      SMS: telefono || '',
      TELEFONO: telefono || '',
      INDIRIZZO: indirizzo || '',
      SITO_WEB: website || '',
      DESCRIZIONE: description || '',
      LOGO_URL: logoUrl,
      TIPO_UTENTE: 'Azienda',
    }

    await upsertContact({
      email: email.trim().toLowerCase(),
      attributes: brevoAttributes,
      listIds: [BREVO_LIST_AZIENDE],
    })

    // 4. Rigenerazione Token JWT e Cookie
    const { iat, exp, ...cleanAuthData } = authData

    const updatedSessionPayload: Record<string, any> = {
      ...cleanAuthData,
      tipo_utente: 'Azienda',
      company: brevoAttributes.NOME_AZIENDA,
      contactPerson: brevoAttributes.REFERENTE,
      telefono: brevoAttributes.TELEFONO,
      indirizzo: brevoAttributes.INDIRIZZO,
      website: brevoAttributes.SITO_WEB,
      description: brevoAttributes.DESCRIZIONE,
      logo_url: logoUrl,
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
      message: 'Profilo aziendale aggiornato con successo',
      user: updatedSessionPayload,
    })
  } catch (error: any) {
    console.error('[API Business Update Error]', error)
    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }
    return res.status(500).json({ message: 'Errore durante l\'aggiornamento del profilo aziendale' })
  }
}