import type { NextApiRequest, NextApiResponse } from 'next'
import { getJobById, updateJob, updateJobStatus, deleteJob } from '@modules/jobs/db'
import type { JobStatus, UpdateJobInput } from '@modules/jobs/types'
import { withApiAuth } from '@modules/api-wrapper'
import type { AuthPayload } from '@modules/auth'

const VALID_STATUSES: JobStatus[] = ['attiva', 'chiusa', 'eliminata']

// Handler protetto gestito da withApiAuth (solo PATCH, PUT, DELETE)
async function mutationHandler(req: NextApiRequest, res: NextApiResponse, authData: AuthPayload) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID annuncio non valido' })
  }

  if (req.method === 'PATCH') {
    const { status } = req.body
    if (!status || typeof status !== 'string' || !VALID_STATUSES.includes(status as JobStatus)) {
      return res.status(400).json({ message: 'Stato non valido (deve essere "attiva" o "chiusa")' })
    }

    const updated = await updateJobStatus(id, authData.email, status as JobStatus)
    if (!updated) {
      return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
    }
    return res.status(200).json({ message: 'Stato annuncio aggiornato con successo' })
  }

  if (req.method === 'PUT') {
    const updateData: UpdateJobInput = req.body
    const updatedJob = await updateJob(id, authData.email, updateData)
    if (!updatedJob) {
      return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
    }
    return res.status(200).json({ message: 'Inserzione aggiornata con successo', job: updatedJob })
  }

  if (req.method === 'DELETE') {
    const deleted = await deleteJob(id, authData.email)
    if (!deleted) {
      return res.status(404).json({ message: 'Annuncio non trovato o non sei autorizzato' })
    }
    return res.status(200).json({ message: 'Inserzione eliminata con successo' })
  }
}

// Inizializzazione del wrapper solo per le mutazioni
const protectedMutationHandler = withApiAuth(
  { allowedMethods: ['PATCH', 'PUT', 'DELETE'], allowedRoles: ['Azienda'] },
  mutationHandler
)

// Handler principale di smistamento
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET: Accesso pubblico per visualizzare l'annuncio
  if (req.method === 'GET') {
    const { id } = req.query
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ message: 'ID annuncio non valido' })
    }

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

  // Delegazione mutazioni all'handler protetto con validazione auth
  return protectedMutationHandler(req, res)
}