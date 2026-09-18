import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { updateApplicationStatus } from '@modules/applications/db'
import { getJobById } from '@modules/jobs/db'
import { trackEvent } from '@modules/brevo'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const token = req.cookies['miia_auth_token']

  if (!token) {
    return res.status(401).json({ message: 'Autenticazione mancante' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any

    if (decoded.tipo_utente !== 'Admin') {
      return res.status(403).json({ message: 'Accesso negato: Privilegi insufficienti' })
    }

    const applicationId = req.query.id as string
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ message: 'Nuovo stato mancante nel payload' })
    }

    // 1. Aggiornamento nel Database
    const application = await updateApplicationStatus(applicationId, status)

    // 2. Tracciamento eventi su Brevo
    if (application) {
      try {
        const job = await getJobById(application.job_id)

        if (job) {
          const isAccepted = status === 'validata'
          const eventToStudent = isAccepted ? 'application_accepted' : 'application_rejected'

          // Evento verso lo Studente: Esito candidatura
          await trackEvent({
            eventName: eventToStudent,
            email: application.student_email,
            properties: {
              job_title: job.title,
              status: status,
            },
          })

          // Evento verso l'Azienda: Candidatura ricevuta (solo se approvata dall'Admin)
          if (isAccepted) {
            await trackEvent({
              eventName: 'candidate_received',
              email: job.company_email,
              properties: {
                job_id: application.job_id,
                job_title: job.title,
                student_email: application.student_email,
                cv_url: application.cv_url,
              },
            })
          }
        }
      } catch (crmError) {
        console.warn('[API Admin Application] Errore tracciamento Brevo:', crmError)
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Stato candidatura aggiornato con successo',
      application
    })

  } catch (error) {
    console.error('❌ Errore API update application:', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}