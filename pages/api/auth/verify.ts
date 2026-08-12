import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'
import { getContact } from '@modules/brevo'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { token, redirect } = req.query

  if (!token || typeof token !== 'string') {
    return res.redirect('/?error=missing_token')
  }

  try {
    // 1. Decodifica del token temporaneo
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (!decoded.email) {
      return res.redirect('/?error=invalid_payload')
    }

    const cleanEmail = decoded.email.trim().toLowerCase()

    // 2. Recupero dati e inferenza del ruolo da Brevo
    let storyblokId = decoded.storyblok_id || ''
    let storyblokUuid = decoded.storyblok_uuid || ''
    let company = decoded.company || ''
    let contactPerson = decoded.contact_person || ''
    let name = decoded.name || ''
    let surname = decoded.surname || ''
    let tipoUtente: 'Azienda' | 'Studente' = decoded.tipo_utente || 'Azienda'

    try {
      const contact = await getContact({ identifier: cleanEmail })
      const attrs = contact.attributes || {}

      storyblokId = String(attrs.STORYBLOK_ID || attrs.storyblok_id || storyblokId)
      storyblokUuid = String(attrs.STORYBLOK_UUID || attrs.storyblok_uuid || storyblokUuid)

      // 🔍 DEDUZIONE RUOLO SOLIDA: Se esiste l'attributo AZIENDA, è un'Azienda, altrimenti uno Studente
      const aziendaName = attrs.AZIENDA || attrs.azienda || company
      if (aziendaName && aziendaName.trim() !== '') {
        tipoUtente = 'Azienda'
        company = aziendaName
        contactPerson = attrs.NOME ? `${attrs.NOME} ${attrs.COGNOME || ''}`.trim() : contactPerson
      } else {
        tipoUtente = 'Studente'
        name = attrs.NOME || attrs.nome || ''
        surname = attrs.COGNOME || attrs.cognome || ''
      }
    } catch (brevoErr) {
      console.warn('[VERIFY API] Impossibile recuperare il contatto da Brevo, uso i dati di fallback del token:', brevoErr)
    }

    // 3. Ricostruzione del sessionPayload completo
    const sessionPayload: AuthPayload = {
      email: cleanEmail,
      storyblok_id: storyblokId,
      storyblok_uuid: storyblokUuid,
      tipo_utente: tipoUtente,
      company,
      contact_person: contactPerson,
      name,
      surname,
    }

    // 4. Generazione Token di Sessione
    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: AUTH_JWT_EXPIRES_IN,
    })

    const encodedUserData = encodeURIComponent(JSON.stringify(sessionPayload))
    const isProd = process.env.NODE_ENV === 'production'

    // 5. Impostazione DOPPIO COOKIE (HttpOnly + Frontend UI)
    res.setHeader('Set-Cookie', [
      `miia_auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    ])

    const destination =
      typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'
    return res.redirect(destination)
  } catch (error) {
    console.error('[VERIFY API] Token non valido o scaduto:', error)
    return res.redirect('/?error=token_expired_or_invalid')
  }
}