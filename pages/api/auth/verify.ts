import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'
import { getContact } from '@modules/brevo'

const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || 30
const BREVO_LIST_STUDENTI = Number(process.env.BREVO_STUDENT_LIST_ID) || 42
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

const SAFE_MAX_AGE = AUTH_COOKIE_MAX_AGE || 604800
const SAFE_EXPIRES_IN = AUTH_JWT_EXPIRES_IN || '7d'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo non consentito' })
  }

  const { token, redirect } = req.query

  if (!token || typeof token !== 'string') {
    console.error('[VERIFY API] Token mancante nella query string.')
    return res.redirect('/aziende/login?error=missing_token')
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (!decoded || !decoded.email) {
      console.error('[VERIFY API] Payload del token non valido o email mancante.')
      return res.redirect('/aziende/login?error=invalid_payload')
    }

    const cleanEmail = decoded.email.trim().toLowerCase()

    // Estensione del tipo per supportare 'Admin' ed evitare l'errore TypeScript
    let tipoUtente: 'Azienda' | 'Studente' | 'Admin' = decoded.tipo_utente || 'Studente'
    let company = decoded.company || ''
    let contactPerson = decoded.contact_person || ''
    let name = decoded.name || ''
    let surname = decoded.surname || ''
    let cvUrl = decoded.cv_url || ''

    try {
      const contact = await getContact({ identifier: cleanEmail })
      const attrs = contact?.attributes || {}

      const rawListIds: any[] = Array.isArray(contact?.listIds) ? contact.listIds : []
      const listIds = rawListIds.map((id) => Number(id))

      const isAziendaList = listIds.includes(BREVO_LIST_AZIENDE) || attrs.TIPO_UTENTE === 'Azienda'
      const isStudenteList = listIds.includes(BREVO_LIST_STUDENTI) || attrs.TIPO_UTENTE === 'Studente'

      if (decoded.tipo_utente === 'Azienda' || isAziendaList) {
        tipoUtente = 'Azienda'
        company = attrs.NOME_AZIENDA || attrs.AZIENDA || attrs.COMPANY || company
        contactPerson = attrs.REFERENTE || attrs.CONTACT_PERSON || attrs.NOME || contactPerson
      } else if (isStudenteList) {
        tipoUtente = 'Studente'
        name = attrs.FIRSTNAME || attrs.NOME || name
        surname = attrs.LASTNAME || attrs.COGNOME || surname
        cvUrl = attrs.CV_URL || attrs.CV || cvUrl
      }
    } catch (brevoErr) {
      console.warn('[VERIFY API] Errore fetch Brevo, uso fallback token:', brevoErr)
    }

    const sessionPayload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: tipoUtente,
      ...(tipoUtente === 'Azienda'
        ? { company, contact_person: contactPerson }
        : { name, surname, cv_url: cvUrl }),
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

    console.log(`[VERIFY API] Login completato con successo per ${cleanEmail}. Redirect a: ${destination}`)
    return res.redirect(destination)

  } catch (error) {
    console.error('[VERIFY API Error]:', error)
    return res.redirect('/aziende/login?error=token_expired_or_invalid')
  }
}