import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getContact, upsertContact, BrevoError } from '@modules/brevo'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const STUDENT_LIST_ID = Number(process.env.BREVO_STUDENT_LIST_ID) || 25

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { email, redirect } = req.query

  const destination =
    typeof redirect === 'string' && redirect.startsWith('/') ? redirect : '/'

  if (!email || typeof email !== 'string') {
    return res.redirect(destination)
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    let storyblokId = ''
    let storyblokUuid = ''
    let companyName = ''
    let tipoUtente: 'Azienda' | 'Studente' = 'Studente'

    try {
      const contact = await getContact({ identifier: cleanEmail })
      if (contact) {
        const currentLists = Array.isArray(contact.listIds) ? contact.listIds : []

        if (currentLists.length === 0) {
          await upsertContact({
            email: cleanEmail,
            listIds: [STUDENT_LIST_ID],
            attributes: {
              TIPO_UTENTE: contact.attributes?.TIPO_UTENTE || 'Studente',
            },
          })
        }

        tipoUtente = (contact.attributes?.TIPO_UTENTE || contact.attributes?.tipo_utente || 'Studente') as 'Azienda' | 'Studente'
        storyblokId = contact.attributes?.STORYBLOK_ID || contact.attributes?.storyblok_id || ''
        storyblokUuid = contact.attributes?.STORYBLOK_UUID || contact.attributes?.storyblok_uuid || ''
        companyName = contact.attributes?.COMPANY || contact.attributes?.NOME || ''
      }
    } catch (brevoErr) {
      if (brevoErr instanceof BrevoError && brevoErr.status === 404) {
        return res.redirect(destination)
      }
    }

    const sessionPayload: AuthPayload = {
      email: cleanEmail,
      storyblok_id: storyblokId,
      storyblok_uuid: storyblokUuid,
      tipo_utente: tipoUtente,
      company: companyName,
    }

    const sessionToken = jwt.sign(sessionPayload, JWT_SECRET, {
      expiresIn: AUTH_JWT_EXPIRES_IN,
    })

    const encodedUserData = encodeURIComponent(JSON.stringify(sessionPayload))
    const isProd = process.env.NODE_ENV === 'production'

    res.setHeader('Set-Cookie', [
      `miia_auth_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    ])

    return res.redirect(destination)
  } catch (error) {
    console.error('[API DIRECT Error]', error)
    return res.redirect(destination)
  }
}