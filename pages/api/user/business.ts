import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact, BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { AUTH_COOKIE_MAX_AGE, AUTH_JWT_EXPIRES_IN } from '@config/auth'

const BREVO_LIST_AZIENDE = 30
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
  }

  // 1. Autenticazione JWT tramite Cookie
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

  const { email: currentEmail } = authData
  const { nome, contact_person, email, address, website, description, area } = req.body

  const targetEmail = (email || currentEmail || '').trim().toLowerCase()
  const companyName = nome || authData.company || ''

  if (!targetEmail) {
    return res.status(400).json({ message: 'Email non trovata nella sessione o nel body' })
  }

  try {
    // 2. Sync Anagrafica Azienda unicamente su Brevo CRM (Lista #30, Senza Storyblok)
    await upsertContact({
      email: targetEmail,
      attributes: {
        NOME_AZIENDA: companyName,
        AZIENDA: companyName,
        REFERENTE: contact_person || authData.contact_person || '',
        NOME: contact_person || companyName,
        INDIRIZZO: address || '',
        SITO_WEB: website || '',
        SETTORE: area || '',
        DESCRIZIONE: description || '',
        TIPO_UTENTE: 'Azienda',
      },
      listIds: [BREVO_LIST_AZIENDE], // Assegna o mantiene l'azienda nella lista #30
    })

    // 3. Pulizia metadata e generazione nuovo Payload JWT
    const { iat, exp, ...cleanAuthData } = authData

    const updatedPayload: AuthPayload = {
      ...cleanAuthData,
      company: companyName,
      contact_person: contact_person || authData.contact_person,
      email: targetEmail,
      tipo_utente: 'Azienda',
    }

    // 4. Rigenerazione Token e Scrittura Cookie HttpOnly + User Cookie
    const updatedToken = jwt.sign(updatedPayload, JWT_SECRET, {
      expiresIn: AUTH_JWT_EXPIRES_IN,
    })

    const isProd = process.env.NODE_ENV === 'production'
    const encodedUserData = encodeURIComponent(JSON.stringify(updatedPayload))

    res.setHeader('Set-Cookie', [
      `miia_auth_token=${updatedToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
      `miia_user=${encodedUserData}; Path=/; SameSite=Lax; Max-Age=${AUTH_COOKIE_MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    ])

    return res.status(200).json({
      message: 'Profilo aziendale aggiornato con successo!',
      user: updatedPayload,
    })
  } catch (error: any) {
    console.error('[API Business Update Error]', error)

    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }

    return res.status(500).json({
      message: error?.message || 'Errore durante l\'aggiornamento del profilo aziendale',
    })
  }
}