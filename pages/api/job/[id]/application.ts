// pages/api/job/[id]/application.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getApplicationsByJobId } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID inserzione non valido' })
  }

  try {
    const token = req.cookies['miia_auth_token']
    if (!token) return res.status(401).json({ message: 'Non autorizzato' })

    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Azienda') {
      return res.status(403).json({ message: 'Accesso negato: Solo le aziende possono visualizzare i candidati' })
    }

    // Il layer DB si assicura che l'azienda sia effettivamente la proprietaria dell'annuncio
    const applications = await getApplicationsByJobId(id, decoded.email)

    return res.status(200).json(applications)
  } catch (error: any) {
    console.error('[API Get Application Error]', error)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Sessione scaduta' })
    }
    return res.status(500).json({ message: 'Errore nel recupero delle candidature' })
  }
}