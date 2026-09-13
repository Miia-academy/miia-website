import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getJobById, updateJobStatus, deleteJob } from '@modules/jobs/db'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID annuncio non valido' })
  }

  // GET pubblica o protetta per leggere il singolo job
  if (req.method === 'GET') {
    try {
      const job = await getJobById(id)
      if (!job) {
        return res.status(404).json({ message: 'Annuncio non trovato' })
      }
      return res.status(200).json(job)
    } catch (error) {
      console.error('[API Get Job Error]', error)
      return res.status(500).json({ message: 'Errore durante il recupero dell\'annuncio' })
    }
  }

  // Le operazioni di PATCH e DELETE richiedono autenticazione Azienda
  const token = req.cookies['miia_auth_token']
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato: Sessione mancante' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (decoded.tipo_utente !== 'Azienda') {
      return res.status(403).json({ message: 'Accesso negato: Operazione riservata alle aziende' })
    }

    // PATCH: Aggiorna lo stato (es. chiudi o riattiva annuncio)
    if (req.method === 'PATCH') {
      const { status } = req.body
      if (!status || typeof status !== 'string') {
        return res.status(400).json({ message: 'Stato non valido' })
      }

      const updated = await updateJobStatus(id, decoded.email, status)
      if (!updated) {
        return res.status(440).json({ message: 'Annuncio non trovato o non autorizzato' })
      }

      return res.status(200).json({ message: 'Stato annuncio aggiornato con successo' })
    }

    // DELETE: Rimuovi l'annuncio
    if (req.method === 'DELETE') {
      const deleted = await deleteJob(id, decoded.email)
      if (!deleted) {
        return res.status(404).json({ message: 'Annuncio non trovato o non autorizzato' })
      }

      return res.status(200).json({ message: 'Annuncio eliminato con successo' })
    }

    return res.status(405).json({ message: 'Metodo non consentito' })
  } catch (error: any) {
    console.error('[API Job Mutation Error]', error)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Sessione non valida o scaduta' })
    }
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}