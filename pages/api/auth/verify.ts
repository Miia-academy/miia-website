import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'
import { getContact } from '@modules/brevo'

const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || 30
const BREVO_LIST_STUDENTI = Number(process.env.BREVO_STUDENT_LIST_ID) || 42
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' })
  }

  const { token, redirect } = req.query

  if (!token || typeof token !== 'string') {
    return res.redirect('/?error=missing_token')
  }

  try {
    // 1. Decodifica e verifica del token temporaneo del Magic Link
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (!decoded || !decoded.email) {
      return res.redirect('/?error=invalid_payload')
    }

    const cleanEmail = decoded.email.trim().toLowerCase()

    // 2. Recupero del profilo aggiornato da Brevo CRM
    let tipoUtente: 'Azienda' | 'Studente' = decoded.tipo_utente || 'Studente'
    let company = decoded.company || ''
    let contactPerson = decoded.contact_person || ''
    let name = decoded.name || ''
    let surname = decoded.surname || ''
    let cvUrl = decoded.cv_url || ''

    try {
      const contact = await getContact({ identifier: cleanEmail })
      const attrs = contact.attributes || {}
      const listIds: number[] = Array.isArray(contact.listIds) ? contact.listIds : []

      if (listIds.includes(BREVO_LIST_AZIENDE) || attrs.TIPO_UTENTE === 'Azienda') {
        tipoUtente = 'Azienda'
        company = attrs.NOME_AZIENDA || attrs.AZIENDA || attrs.COMPANY || company
        contactPerson = attrs.REFERENTE || attrs.CONTACT_PERSON || attrs.NOME || contactPerson
      } else if (listIds.includes(BREVO_LIST_STUDENTI) || attrs.TIPO_UTENTE === 'Studente') {
        tipoUtente = 'Studente'
        name = attrs.FIRSTNAME || attrs.NOME || name
        surname = attrs.LASTNAME || attrs.COGNOME || surname
        cvUrl = attrs.CV_URL || attrs.CV || cvUrl
      }
    } catch (brevoErr) {
      console.warn('[VERIFY API] Impossibile recuperare dati aggiornati da Brevo. Uso i dati del token:', brevoErr)
    }

    // 3. Generazione del payload di sessione pulito
    const sessionPayload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: tipoUtente,
      ...(tipoUtente === 'Azienda'
        ? { company, contact_person: contactPerson }
        : { name, surname, cv_url: cvUrl })
    }

    // 4. Generazione del JWT di sessione definitivo
    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: AUTH_JWT_EXPIRES_IN,
    })

    const encodedUserData = encodeURIComponent(JSON.stringify(sessionPayload))
    const isProd = process.env.NODE_ENV === 'production'

    // 5. Scrittura dei Cookie di Sessione (30 giorni)
    res.setHeader('Set-Cookie', [
      `miia_auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    ])

    // 6. Destinazione dinamica per ruolo con protezione Open Redirect
    const defaultDestination = tipoUtente === 'Azienda' ? '/aziende/profilo' : '/studenti/profilo'
    let destination = defaultDestination

    if (
      typeof redirect === 'string' &&
      redirect.startsWith('/') &&
      !redirect.startsWith('//') &&
      redirect !== '/'
    ) {
      destination = redirect
    }

    return res.redirect(destination)

  } catch (error) {
    console.error('[VERIFY API] Errore durante la verifica del token:', error)
    return res.redirect('/?error=token_expired_or_invalid')
  }
}