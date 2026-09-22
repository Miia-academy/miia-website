import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { brevoFetch, BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // Controllo di sicurezza
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato: effettua il login' })
  }

  try {
    // Validazione token
    jwt.verify(token, JWT_SECRET) as AuthPayload

    // Chiamata all'endpoint Brevo che restituisce lo SCHEMA di tutti gli attributi dell'account
    const schema = await brevoFetch('/contacts/attributes', { method: 'GET' })

    return res.status(200).json({
      success: true,
      total_attributes: schema.attributes?.length || 0,
      attributes_list: schema.attributes
    })

  } catch (error: any) {
    console.error('[API Brevo Attributes Error]', error)
    if (error instanceof BrevoError) {
      return res.status(error.status).json({
        message: error.message,
        brevo_error_data: error.data
      })
    }

    return res.status(500).json({ message: 'Errore interno del server', error: String(error) })
  }
}