import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { upsertContact, BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb', // Allineato al limite hardcapped delle Vercel Serverless Functions
    },
  },
}

const BREVO_LIST_STUDENTI = Number(process.env.BREVO_STUDENT_LIST_ID) || 42
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Authenticate JWT Session
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

  // Guardia di Ruolo
  if (authData.tipo_utente !== 'Studente') {
    return res.status(403).json({ message: 'Accesso negato: rotta riservata agli studenti' })
  }

  const { email, name, surname } = authData
  if (!email) {
    return res.status(400).json({ message: 'Email non trovata nella sessione' })
  }

  const {
    cvBase64,
    cvFileName,
    cvMimeType,
    portfolioBase64,
    portfolioFileName,
    portfolioMimeType,
    attributes,
  } = req.body

  try {
    let cvDownloadUrl = authData.cv_url || (authData as any).cv || ''
    let portfolioDownloadUrl = (authData as any).portfolio_url || ''

    // 2. Upload CV su Google Cloud Storage
    if (cvBase64 && cvFileName) {
      const buffer = Buffer.from(cvBase64.replace(/^data:.*;base64,/, ''), 'base64')
      const sanitizedFileName = `${Date.now()}-cv-${cvFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`

      const cvUploadResult = await uploadFile({
        fileBuffer: buffer,
        fileName: sanitizedFileName,
        mimeType: cvMimeType || 'application/pdf',
        folderPath: 'cv',
        isPublic: false,
      })

      cvDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(cvUploadResult.id)}`
    }

    // 3. Upload Portfolio su Google Cloud Storage
    if (portfolioBase64 && portfolioFileName) {
      const buffer = Buffer.from(portfolioBase64.replace(/^data:.*;base64,/, ''), 'base64')
      const sanitizedPortfolioName = `${Date.now()}-portfolio-${portfolioFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`

      const portfolioUploadResult = await uploadFile({
        fileBuffer: buffer,
        fileName: sanitizedPortfolioName,
        mimeType: portfolioMimeType || 'application/pdf',
        folderPath: 'portfolio',
        isPublic: false,
      })

      portfolioDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(portfolioUploadResult.id)}`
    }

    // 4. Sincronizzazione CRM Brevo (attributi corretti e unificati)
    const brevoAttributes: Record<string, any> = {
      ...(attributes || {}),
      NOME: attributes?.NOME || name || '',
      COGNOME: attributes?.COGNOME || surname || '',
      SMS: attributes?.SMS || '',
      TIPO_UTENTE: 'Studente',
      INDIRIZZO: attributes?.INDIRIZZO || '',
      PROVINCIA: attributes?.PROVINCIA || '',
      RICERCA_ATTIVA: typeof attributes?.RICERCA_ATTIVA === 'boolean' ? attributes.RICERCA_ATTIVA : true,
      AUTOMUNITO: typeof attributes?.AUTOMUNITO === 'boolean' ? attributes.AUTOMUNITO : false,
      DISPONIBILE_TRASFERTE: typeof attributes?.DISPONIBILE_TRASFERTE === 'boolean' ? attributes.DISPONIBILE_TRASFERTE : false,
      CV_URL: cvDownloadUrl,
      PORTFOLIO_URL: portfolioDownloadUrl,
    }

    await upsertContact({
      email: email.trim().toLowerCase(),
      attributes: brevoAttributes,
      listIds: [BREVO_LIST_STUDENTI],
    })

    // 5. Rigenerazione Sessione JWT
    const { iat, exp, ...cleanAuthData } = authData

    const competenzeArray = typeof attributes?.COMPETENZE === 'string'
      ? attributes.COMPETENZE.split(',').map((s: string) => s.trim()).filter(Boolean)
      : (Array.isArray(attributes?.COMPETENZE) ? attributes.COMPETENZE : [])

    const updatedSessionPayload: Record<string, any> = {
      ...cleanAuthData,
      tipo_utente: 'Studente',
      name: brevoAttributes.NOME,
      surname: brevoAttributes.COGNOME,
      sms: brevoAttributes.SMS,
      indirizzo: brevoAttributes.INDIRIZZO,
      provincia: brevoAttributes.PROVINCIA,
      ricerca_attiva: brevoAttributes.RICERCA_ATTIVA,
      automunito: brevoAttributes.AUTOMUNITO,
      disponibile_trasferte: brevoAttributes.DISPONIBILE_TRASFERTE,
      competenze: competenzeArray,
      cv_url: cvDownloadUrl,
      portfolio_url: portfolioDownloadUrl,
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
      message: 'Profilo studente aggiornato con successo!',
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