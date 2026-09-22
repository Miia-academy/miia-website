import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getApplicationsByJobId, markApplicationAsViewed } from '@modules/applications/db'
import { getContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID inserzione non valido' })
  }

  const token = req.cookies['miia_auth_token']
  if (!token) return res.status(401).json({ message: 'Non autorizzato' })

  let decoded: AuthPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida' })
  }

  if (decoded.tipo_utente !== 'Azienda') {
    return res.status(403).json({ message: 'Accesso negato: Solo le aziende possono visualizzare i candidati' })
  }

  // GET: Recupera la lista delle candidature approvate arricchite con Nome e Cognome
  if (req.method === 'GET') {
    try {
      const rawApplications = await getApplicationsByJobId(id, decoded.email)

      const enrichedApplications = await Promise.all(
        rawApplications.map(async (app) => {
          try {
            const contact = await getContact({ identifier: app.student_email })
            const attrs = contact?.attributes || {}
            return {
              ...app,
              nome: attrs.NOME || attrs.FIRSTNAME || '',
              cognome: attrs.COGNOME || attrs.LASTNAME || '',
            }
          } catch {
            return {
              ...app,
              nome: '',
              cognome: '',
            }
          }
        })
      )

      return res.status(200).json(enrichedApplications)
    } catch (error) {
      console.error('[API Get Application Error]', error)
      return res.status(500).json({ message: 'Errore nel recupero delle candidature' })
    }
  }

  // POST: Registra la visualizzazione della scheda candidato
  if (req.method === 'POST') {
    const { applicationId } = req.body
    if (!applicationId || typeof applicationId !== 'string') {
      return res.status(400).json({ message: 'ID candidatura mancante' })
    }

    try {
      const result = await markApplicationAsViewed(applicationId, decoded.email)
      if (!result) {
        return res.status(404).json({ message: 'Candidatura non trovata o non autorizzata' })
      }
      return res.status(200).json({ message: 'Visualizzazione registrata con successo', application: result })
    } catch (error) {
      console.error('[API View Application Error]', error)
      return res.status(500).json({ message: 'Errore durante la registrazione della visualizzazione' })
    }
  }

  return res.status(405).json({ message: 'Metodo non consentito' })
}