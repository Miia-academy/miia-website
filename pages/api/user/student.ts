import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { uploadFile } from '@modules/google'
import { UserService } from '@modules/user/service'
import { withApiAuth } from '@modules/api-wrapper'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'
import { getJwtSecret } from '@modules/jwt-secret'
import { InvalidUpload, parseUpload, safeFileName } from '@modules/uploads'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb',
    },
  },
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
const MAX_CV_BYTES = 5_000_000
const MAX_PORTFOLIO_BYTES = 15_000_000
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
    portfolioBase64,
    portfolioFileName,
    attributes,
  } = req.body

  let cvDownloadUrl = authData.cv_url || ''
  let portfolioDownloadUrl = authData.portfolio_url || ''

  // CV and portfolio go to the private bucket; the type is decided from the content
  let cv, portfolio
  try {
    cv = parseUpload(cvBase64, { kinds: ['pdf'], maxBytes: MAX_CV_BYTES, label: 'CV', formats: 'un PDF' })
    portfolio = parseUpload(portfolioBase64, {
      kinds: ['pdf', 'zip'],
      maxBytes: MAX_PORTFOLIO_BYTES,
      label: 'portfolio',
      formats: 'un PDF o uno ZIP',
    })
  } catch (error) {
    if (error instanceof InvalidUpload) return res.status(400).json({ message: error.message })
    throw error
  }

  if (cv) {
    const uploadResult = await uploadFile({
      fileBuffer: cv.buffer,
      fileName: `${Date.now()}-cv-${safeFileName(cvFileName, cv.ext)}`,
      mimeType: cv.mime,
      folderPath: 'cv',
      isPublic: false,
    })
    cvDownloadUrl = `${BASE_URL}/api/job/download?file=${encodeURIComponent(uploadResult.id)}`
  }

  if (portfolio) {
    const uploadResult = await uploadFile({
      fileBuffer: portfolio.buffer,
      fileName: `${Date.now()}-portfolio-${safeFileName(portfolioFileName, portfolio.ext)}`,
      mimeType: portfolio.mime,
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
  const freelanceVal = typeof attributes?.FREELANCE === 'boolean' ? attributes.FREELANCE : false

  await UserService.syncStudentToCrm(email, {
    NOME: nomeVal,
    COGNOME: cognomeVal,
    SMS: smsVal,
    INDIRIZZO: indirizzoVal,
    PROVINCIA: provinciaVal,
    RICERCA_ATTIVA: ricercaAttivaVal,
    AUTOMUNITO: automunitoVal,
    TRASFERTE: trasferteVal,
    FREELANCE: freelanceVal,
    COMPETENZE: competenzeString,
    CV_URL: cvDownloadUrl,
    PORTFOLIO_URL: portfolioDownloadUrl,
  })

  const { iat, exp, ...cleanAuthData } = authData
  const updatedSessionPayload = {
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
    freelance: freelanceVal,
    competenze: competenzeArray,
    cv_url: cvDownloadUrl,
    portfolio_url: portfolioDownloadUrl,
  } as AuthPayload & { freelance: boolean }

  const updatedSessionToken = jwt.sign(updatedSessionPayload, getJwtSecret(), { expiresIn: SAFE_EXPIRES_IN })
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