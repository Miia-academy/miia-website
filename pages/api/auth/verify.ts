import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'
import { getContact } from '@modules/brevo'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const SAFE_MAX_AGE = AUTH_COOKIE_MAX_AGE || 604800
const SAFE_EXPIRES_IN = AUTH_JWT_EXPIRES_IN || '7d'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' })
  }

  const { token, redirect } = req.query

  if (!token || typeof token !== 'string') {
    return res.redirect('/aziende/login?error=missing_token')
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (!decoded || !decoded.email || !decoded.tipo_utente) {
      return res.redirect('/aziende/login?error=invalid_payload')
    }

    const cleanEmail = decoded.email.trim().toLowerCase()
    const tipoUtente = decoded.tipo_utente

    const sessionPayload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: tipoUtente,
    }

    try {
      const contact = await getContact({ identifier: cleanEmail })
      const attrs = contact?.attributes || {}

      if (tipoUtente === 'Azienda') {
        sessionPayload.azienda = attrs.AZIENDA || attrs.NOME_AZIENDA || decoded.azienda || ''
        sessionPayload.referente = attrs.REFERENTE || decoded.referente || ''
        sessionPayload.sms = attrs.SMS || attrs.TELEFONO || decoded.sms || ''
        sessionPayload.indirizzo = attrs.INDIRIZZO || decoded.indirizzo || ''
        sessionPayload.sito_web = attrs.SITO_WEB || decoded.sito_web || ''
        sessionPayload.descrizione = attrs.DESCRIZIONE || decoded.descrizione || ''
        sessionPayload.logo_url = attrs.LOGO_URL || decoded.logo_url || ''
      } else if (tipoUtente === 'Studente') {
        sessionPayload.nome = attrs.NOME || attrs.FIRSTNAME || decoded.nome || ''
        sessionPayload.cognome = attrs.COGNOME || attrs.LASTNAME || decoded.cognome || ''
        sessionPayload.sms = attrs.SMS || attrs.TELEFONO || decoded.sms || ''
        sessionPayload.indirizzo = attrs.INDIRIZZO || decoded.indirizzo || ''
        sessionPayload.provincia = attrs.PROVINCIA || decoded.provincia || ''
        sessionPayload.ricerca_attiva = typeof attrs.RICERCA_ATTIVA === 'boolean' ? attrs.RICERCA_ATTIVA : (decoded.ricerca_attiva ?? true)
        sessionPayload.automunito = typeof attrs.AUTOMUNITO === 'boolean' ? attrs.AUTOMUNITO : (decoded.automunito ?? false)
        sessionPayload.trasferte = typeof attrs.TRASFERTE === 'boolean' ? attrs.TRASFERTE : (decoded.trasferte ?? false)
        sessionPayload.cv_url = attrs.CV_URL || decoded.cv_url || ''
        sessionPayload.portfolio_url = attrs.PORTFOLIO_URL || decoded.portfolio_url || ''

        const competenzeStr = attrs.COMPETENZE || ''
        sessionPayload.competenze = competenzeStr ? competenzeStr.split(',').map((s: string) => s.trim()).filter(Boolean) : (decoded.competenze || [])
      }
    } catch (brevoErr) {
      console.warn('[VERIFY API] Errore fetch Brevo, uso fallback token:', brevoErr)
      if (tipoUtente === 'Azienda') {
        sessionPayload.azienda = decoded.azienda || ''
        sessionPayload.referente = decoded.referente || ''
        sessionPayload.sms = decoded.sms || ''
        sessionPayload.indirizzo = decoded.indirizzo || ''
        sessionPayload.sito_web = decoded.sito_web || ''
        sessionPayload.descrizione = decoded.descrizione || ''
        sessionPayload.logo_url = decoded.logo_url || ''
      } else if (tipoUtente === 'Studente') {
        sessionPayload.nome = decoded.nome || ''
        sessionPayload.cognome = decoded.cognome || ''
        sessionPayload.sms = decoded.sms || ''
        sessionPayload.indirizzo = decoded.indirizzo || ''
        sessionPayload.provincia = decoded.provincia || ''
        sessionPayload.ricerca_attiva = decoded.ricerca_attiva ?? true
        sessionPayload.automunito = decoded.automunito ?? false,
          sessionPayload.trasferte = decoded.trasferte ?? false
        sessionPayload.cv_url = decoded.cv_url || ''
        sessionPayload.portfolio_url = decoded.portfolio_url || ''
        sessionPayload.competenze = decoded.competenze || []
      }
    }

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: SAFE_EXPIRES_IN,
    })

    const encodedUserData = encodeURIComponent(JSON.stringify(sessionPayload))

    const protocol = req.headers['x-forwarded-proto'] || 'http'
    const isSecure = process.env.NODE_ENV === 'production' || protocol === 'https'
    const cookieOptions = `Path=/; SameSite=Lax; Max-Age=${SAFE_MAX_AGE}${isSecure ? '; Secure' : ''}`

    res.setHeader('Set-Cookie', [
      `miia_auth_token=${sessionToken}; HttpOnly; ${cookieOptions}`,
      `miia_user=${encodedUserData}; ${cookieOptions}`,
    ])

    let destination = tipoUtente === 'Azienda' ? '/aziende/profilo' : '/studenti/profilo'

    if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//') && redirect !== '/') {
      destination = redirect
    }

    return res.redirect(destination)

  } catch (error) {
    return res.redirect('/aziende/login?error=token_expired_or_invalid')
  }
}