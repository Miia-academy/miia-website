// pages/api/user/business.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { UserService } from '@modules/user/service'
import { withApiAuth } from '@modules/api-wrapper'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
const SAFE_MAX_AGE = AUTH_COOKIE_MAX_AGE || 604800
const SAFE_EXPIRES_IN = AUTH_JWT_EXPIRES_IN || '7d'

async function businessHandler(req: NextApiRequest, res: NextApiResponse, authData: AuthPayload & { iat?: number; exp?: number }) {
  const { email } = authData
  const { azienda, referente, sms, indirizzo, sito_web, descrizione, logoBase64, logoFileName, logoMimeType } = req.body

  let logoUrl = authData.logo_url || ''

  // Upload Logo su Google Cloud Storage se fornito un nuovo file
  if (logoBase64 && logoFileName) {
    const buffer = Buffer.from(logoBase64.replace(/^data:.*;base64,/, ''), 'base64')
    const sanitizedFileName = `${Date.now()}-logo-${logoFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`
    const uploadResult = await uploadFile({
      fileBuffer: buffer,
      fileName: sanitizedFileName,
      mimeType: logoMimeType || 'image/png',
      folderPath: 'logos',
      isPublic: true,
    })
    logoUrl = uploadResult.publicUrl || `${BASE_URL}/api/job/download?file=${encodeURIComponent(uploadResult.id)}`
  }

  // Sincronizzazione CRM Brevo con attributi standardizzati
  await UserService.syncBusinessToCrm(email, {
    AZIENDA: azienda || '',
    NOME_AZIENDA: azienda || '',
    REFERENTE: referente || '',
    SMS: sms || '',
    TELEFONO: sms || '',
    INDIRIZZO: indirizzo || '',
    SITO_WEB: sito_web || '',
    DESCRIZIONE: descrizione || '',
    LOGO_URL: logoUrl,
  })

  // Rigenerazione Sessione con payload tipizzato e allineato
  const { iat, exp, ...cleanAuthData } = authData
  const updatedSessionPayload: AuthPayload = {
    ...cleanAuthData,
    email,
    tipo_utente: 'Azienda',
    azienda: azienda !== undefined ? azienda : cleanAuthData.azienda || '',
    referente: referente !== undefined ? referente : cleanAuthData.referente || '',
    sms: sms !== undefined ? sms : cleanAuthData.sms || '',
    indirizzo: indirizzo !== undefined ? indirizzo : cleanAuthData.indirizzo || '',
    sito_web: sito_web !== undefined ? sito_web : cleanAuthData.sito_web || '',
    descrizione: descrizione !== undefined ? descrizione : cleanAuthData.descrizione || '',
    logo_url: logoUrl,
  }

  const updatedSessionToken = jwt.sign(updatedSessionPayload, JWT_SECRET, { expiresIn: SAFE_EXPIRES_IN })
  const encodedUserData = encodeURIComponent(JSON.stringify(updatedSessionPayload))

  // Protocol & Cookie Signature coerente con verify.ts e logout.ts
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const isSecure = process.env.NODE_ENV === 'production' || protocol === 'https'
  const cookieOptions = `Path=/; SameSite=Lax; Max-Age=${SAFE_MAX_AGE}${isSecure ? '; Secure' : ''}`

  res.setHeader('Set-Cookie', [
    `miia_auth_token=${updatedSessionToken}; HttpOnly; ${cookieOptions}`,
    `miia_user=${encodedUserData}; ${cookieOptions}`,
  ])

  return res.status(200).json({
    message: 'Profilo aziendale aggiornato con successo',
    user: updatedSessionPayload,
  })
}

export default withApiAuth({ allowedMethods: ['POST', 'PUT'], allowedRoles: ['Azienda'] }, businessHandler)