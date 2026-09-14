import { NextApiRequest, NextApiResponse } from 'next'
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

    const email = req.query.email as string
    if (!email) return res.status(400).json({ message: 'Email mancante' })

    let studentInfo = {
      nome: '',
      cognome: '',
      telefono: '',
      provincia: '',
      competenze: [] as string[],
    }

    try {
      const contact = await getContact({ identifier: email })
      const attrs = contact?.attributes || {}

      const rawSkills = attrs.COMPETENZE || attrs.SKILLS || ''
      const skillsArray = typeof rawSkills === 'string'
        ? rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean)
        : Array.isArray(rawSkills) ? rawSkills : []

      studentInfo = {
        nome: attrs.NOME || attrs.FIRSTNAME || '',
        cognome: attrs.COGNOME || attrs.LASTNAME || '',
        telefono: attrs.TELEFONO || attrs.SMS || '',
        provincia: attrs.PROVINCIA || attrs.CITTA || '',
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