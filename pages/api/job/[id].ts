import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { getJobById, updateJob, updateJobStatus, deleteJob } from '@modules/jobs/db'
import type { JobStatus, UpdateJobInput } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

// Lista dei valori consentiti per la Type Guard
const VALID_STATUSES: JobStatus[] = ['attiva', 'chiusa', 'eliminata']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID annuncio non valido' })
  }

  // GET: Recupera i dettagli dell'inserzione
  if (req.method === 'GET') {
    try {
      const job = await getJobById(id)
      if (!job) {
        return res.status(404).json({ message: 'Annuncio non trovato' })
      }
      return res.status(200).json(job)
    } catch (error) {
      console.error('[API Job GET Error]', error)
      return res.status(500).json({ message: 'Errore interno del server' })
    }
  }

  // ==========================================
  // AUTENTICAZIONE PER LE MUTAZIONI (PATCH, PUT, DELETE)
  // ==========================================
  const token = req.cookies['miia_auth_token']
  if (!token) {
    return res.status(401).json({ message: 'Non autorizzato: Sessione mancante' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (decoded.tipo_utente !== 'Azienda') {
      return res.status(403).json({ message: 'Accesso negato: Operazione riservata alle aziende' })
    }

    // PATCH: Aggiorna solo lo stato (attiva / chiusa)
    if (req.method === 'PATCH') {
      const { status } = req.body

      // Validazione e Type-Cast sicuro a JobStatus
      if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status as JobStatus)) {
        return res.status(400).json({ message: 'Stato non valido (deve essere "attiva" o "chiusa")' })
      }

      const jobStatus = status as JobStatus
      const updated = await updateJobStatus(id, decoded.email, jobStatus)

      if (!updated) {
        return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
      }

      return res.status(200).json({ message: 'Stato annuncio aggiornato con successo' })
    }

    // PUT: Aggiorna l'intera inserzione (usato da JobFormModal)
    if (req.method === 'PUT') {
      const updateData: UpdateJobInput = req.body

      const updatedJob = await updateJob(id, decoded.email, updateData)

      if (!updatedJob) {
        return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
      }

      return res.status(200).json({ message: 'Inserzione aggiornata con successo', job: updatedJob })
    }

    // DELETE: Eliminazione logica dell'inserzione
    if (req.method === 'DELETE') {
      const deleted = await deleteJob(id, decoded.email)

      if (!deleted) {
        return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
      }

      return res.status(200).json({ message: 'Inserzione eliminata con successo' })
    }

    // Se la richiesta usa un metodo non gestito (es. POST su questa rotta)
    res.setHeader('Allow', ['GET', 'PATCH', 'PUT', 'DELETE'])
    return res.status(405).json({ message: `Metodo ${req.method} non consentito` })

  } catch (error: any) {
    console.error('[API Job Mutation Error]', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}