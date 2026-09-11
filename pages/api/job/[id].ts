import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from '@modules/db'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validazione del Token HttpOnly
  const token = req.cookies.miia_auth_token
  if (!token) return res.status(401).json({ message: 'Accesso negato.' })

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida.' })
  }

  const { email, tipo_utente } = authData
  const { id } = req.query // Estraiamo l'ID dinamico dall'URL

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID inserzione non valido.' })
  }

  // 2. Metodo GET: Lettura di una singola inserzione (pubblica per utenti loggati)
  if (req.method === 'GET') {
    try {
      const job = await sql`SELECT * FROM jobs WHERE id = ${id}`
      if (job.length === 0) return res.status(404).json({ message: 'Inserzione non trovata.' })

      return res.status(200).json(job[0])
    } catch (error) {
      console.error('[API GET Job Error]', error)
      return res.status(500).json({ message: 'Errore di sistema.' })
    }
  }

  // Blocco sicurezza: PUT e DELETE sono riservati solo alle Aziende
  if (tipo_utente !== 'Azienda') {
    return res.status(403).json({ message: 'Azione non consentita.' })
  }

  // 3. Metodo PUT: Aggiornamento dell'inserzione
  if (req.method === 'PUT') {
    const { title, description, provincia, competenze, status } = req.body

    try {
      // LA MAGIA DELLA SICUREZZA: L'AND company_email = ${email} impedisce 
      // a un'azienda di modificare i job di un'altra azienda.
      const updatedJob = await sql`
        UPDATE jobs 
        SET 
          title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          provincia = COALESCE(${provincia}, provincia),
          competenze = COALESCE(${competenze}, competenze),
          status = COALESCE(${status}, status),
          updated_at = NOW()
        WHERE id = ${id} AND company_email = ${email}
        RETURNING *;
      `

      if (updatedJob.length === 0) {
        return res.status(404).json({ message: 'Inserzione non trovata o permessi insufficienti.' })
      }

      return res.status(200).json({ message: 'Aggiornamento completato.', job: updatedJob[0] })
    } catch (error) {
      console.error('[API PUT Job Error]', error)
      return res.status(500).json({ message: 'Errore durante l\'aggiornamento.' })
    }
  }

  // 4. Metodo DELETE: Eliminazione (con Cascade sulle candidature)
  if (req.method === 'DELETE') {
    try {
      const deletedJob = await sql`
        DELETE FROM jobs 
        WHERE id = ${id} AND company_email = ${email}
        RETURNING id;
      `

      if (deletedJob.length === 0) {
        return res.status(404).json({ message: 'Inserzione non trovata o permessi insufficienti.' })
      }

      return res.status(200).json({ message: 'Inserzione eliminata con successo.' })
    } catch (error) {
      console.error('[API DELETE Job Error]', error)
      return res.status(500).json({ message: 'Errore durante l\'eliminazione.' })
    }
  }

  // Fallback
  return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
}