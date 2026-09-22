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

async function studentHandler(req: NextApiRequest, res: NextApiResponse, authData: AuthPayload & { iat?: number; exp?: number }) {
  const { email } = authData
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

  let cvDownloadUrl = authData.cv_url || ''
  let portfolioDownloadUrl = authData.portfolio_url || ''

  if (cvBase64 && cvFileName) {
    const buffer = Buffer.from(cvBase64.replace(/^data:.*;base64,/, ''), 'base64')
    const sanitizedFileName = `${Date.now()}-cv-${cvFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`
    const uploadResult = await uploadFile({
      fileBuffer: buffer,
      fileName: sanitizedFileName,
      mimeType: cvMimeType || 'application/pdf',
      folderPath: 'cv',
      isPublic: false,
    })
    cvDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(uploadResult.id)}`
  }

  if (portfolioBase64 && portfolioFileName) {
    const buffer = Buffer.from(portfolioBase64.replace(/^data:.*;base64,/, ''), 'base64')
    const sanitizedName = `${Date.now()}-portfolio-${portfolioFileName.toLowerCase().replace(/[^a-z0-9.]/g, '-')}`
    const uploadResult = await uploadFile({
      fileBuffer: buffer,
      fileName: sanitizedName,
      mimeType: portfolioMimeType || 'application/pdf',
      folderPath: 'portfolio',
      isPublic: false,
    })
    portfolioDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(uploadResult.id)}`
  }

  const rawCompetenze = attributes?.COMPETENZE
  const competenzeString = Array.isArray(rawCompetenze)
    ? rawCompetenze.join(', ')
    : typeof rawCompetenze === 'string'
      ? rawCompetenze
      : ''
  const competenzeArray = competenzeString ? competenzeString.split(',').map((s) => s.trim()).filter(Boolean) : []

  const nomeVal = attributes?.NOME || authData.nome || ''
  const cognomeVal = attributes?.COGNOME || authData.cognome || ''
  const smsVal = attributes?.SMS || authData.sms || ''
  const indirizzoVal = attributes?.INDIRIZZO || authData.indirizzo || ''
  const provinciaVal = attributes?.PROVINCIA || authData.provincia || ''
  const ricercaAttivaVal = typeof attributes?.RICERCA_ATTIVA === 'boolean' ? attributes.RICERCA_ATTIVA : true
  const automunitoVal = typeof attributes?.AUTOMUNITO === 'boolean' ? attributes.AUTOMUNITO : false
  const trasferteVal = typeof attributes?.TRASFERTE === 'boolean' ? attributes.TRASFERTE : (typeof attributes?.DISPONIBILE_TRASFERTE === 'boolean' ? attributes.DISPONIBILE_TRASFERTE : false)

  await UserService.syncStudentToCrm(email, {
    NOME: nomeVal,
    COGNOME: cognomeVal,
    SMS: smsVal,
    INDIRIZZO: indirizzoVal,
    PROVINCIA: provinciaVal,
    RICERCA_ATTIVA: ricercaAttivaVal,
    AUTOMUNITO: automunitoVal,
    TRASFERTE: trasferteVal,
    COMPETENZE: competenzeString,
    CV_URL: cvDownloadUrl,
    PORTFOLIO_URL: portfolioDownloadUrl,
  })

  const { iat, exp, ...cleanAuthData } = authData
  const updatedSessionPayload: AuthPayload = {
    ...cleanAuthData,
    email,
    tipo_utente: 'Studente',
    nome: nomeVal,
    cognome: cognomeVal,
    sms: smsVal,
    indirizzo: indirizzoVal,
    provincia: provinciaVal,
    ricerca_attiva: ricercaAttivaVal,
    automunito: automunitoVal,
    trasferte: trasferteVal,
    competenze: competenzeArray,
    cv_url: cvDownloadUrl,
    portfolio_url: portfolioDownloadUrl,
  }

  const updatedSessionToken = jwt.sign(updatedSessionPayload, JWT_SECRET, { expiresIn: SAFE_EXPIRES_IN })
  const encodedUserData = encodeURIComponent(JSON.stringify(updatedSessionPayload))

  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const isSecure = process.env.NODE_ENV === 'production' || protocol === 'https'
  const cookieOptions = `Path=/; SameSite=Lax; Max-Age=${SAFE_MAX_AGE}${isSecure ? '; Secure' : ''}`

  res.setHeader('Set-Cookie', [
    `miia_auth_token=${updatedSessionToken}; HttpOnly; ${cookieOptions}`,
    `miia_user=${encodedUserData}; ${cookieOptions}`,
  ])

  return res.status(200).json({
    message: 'Profilo studente aggiornato con successo!',
    user: updatedSessionPayload,
    cv_url: cvDownloadUrl,
    portfolio_url: portfolioDownloadUrl,
  })
}

export default withApiAuth({ allowedMethods: ['POST'], allowedRoles: ['Studente'] }, studentHandler)