import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const token = req.cookies['miia_auth_token']
  if (!token) return res.status(401).json({ message: 'Non autenticato' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (decoded.tipo_utente !== 'Admin') {
      return res.status(403).json({ message: 'Accesso negato' })
    }

    const rawEmail = req.query.email as string
    if (!rawEmail) return res.status(400).json({ message: 'Email mancante' })

    const cleanEmail = decodeURIComponent(rawEmail).trim().toLowerCase()

    const parseBoolean = (val: any): boolean | null => {
      if (val === undefined || val === null || val === '') return null
      if (val === true || val === 'true') return true
      if (val === false || val === 'false') return false
      return null
    }

    let studentInfo = {
      email: cleanEmail,
      nome: '',
      cognome: '',
      sms: '',
      indirizzo: '',
      provincia: '',
      ricerca_attiva: null as boolean | null,
      automunito: null as boolean | null,
      trasferte: null as boolean | null,
      cv_url: '',
      portfolio_url: '',
      competenze: [] as string[],
    }

    try {
      const contact = await getContact({ identifier: cleanEmail })
      const attrs = contact?.attributes || {}

      const rawSkills = attrs.COMPETENZE || ''
      const skillsArray = typeof rawSkills === 'string'
        ? rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(rawSkills) ? rawSkills : []

      studentInfo = {
        email: cleanEmail,
        nome: attrs.NOME || attrs.FIRSTNAME || '',
        cognome: attrs.COGNOME || attrs.LASTNAME || '',
        sms: attrs.SMS || attrs.TELEFONO || '',
        indirizzo: attrs.INDIRIZZO || '',
        provincia: attrs.PROVINCIA || '',
        ricerca_attiva: parseBoolean(attrs.RICERCA_ATTIVA),
        automunito: parseBoolean(attrs.AUTOMUNITO),
        trasferte: parseBoolean(attrs.TRASFERTE),
        cv_url: attrs.CV_URL || '',
        portfolio_url: attrs.PORTFOLIO_URL || '',
        competenze: skillsArray,
      }
    } catch (e) {
      console.warn('[Admin Student API Warning] Errore Brevo:', e)
    }

    return res.status(200).json(studentInfo)
  } catch {
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}