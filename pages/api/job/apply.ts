import type { NextApiRequest, NextApiResponse } from 'next'
import { getJobById } from '@modules/jobs/db'
import { createApplication } from '@modules/applications/db'
import { trackEvent } from '@modules/brevo'
import { withApiAuth } from '@modules/api-wrapper'
import type { AuthPayload } from '@modules/auth'

async function applyHandler(req: NextApiRequest, res: NextApiResponse, authData: AuthPayload) {
  const { jobId, company_name } = req.body

  if (!jobId) {
    return res.status(400).json({ message: 'ID inserzione mancante' })
  }

  const job = await getJobById(jobId)
  if (!job) {
    return res.status(404).json({ message: 'Inserzione non trovata o chiusa' })
  }

  const cvUrl = authData.cv_url || req.body.cv_url || ''
  if (!cvUrl) {
    return res.status(400).json({ message: 'CV mancante nel profilo. Aggiorna il tuo profilo prima di candidarti.' })
  }

  const cleanStudentEmail = authData.email.trim().toLowerCase()

  const application = await createApplication({
    job_id: jobId,
    student_email: cleanStudentEmail,
    cv_url: cvUrl,
  })

  if (!application) {
    return res.status(409).json({ message: 'Ti sei già candidato a questa inserzione in precedenza.' })
  }

  const studentName = `${authData.nome || ''} ${authData.cognome || ''}`.trim() || cleanStudentEmail

  try {
    // 1. Tracciamento sul contatto dello STUDENTE (Storico attività)
    await trackEvent({
      eventName: 'job_applied',
      email: cleanStudentEmail,
      properties: {
        job_id: jobId,
        job_title: job.title,
        company_name: company_name || '',
      },
    })

    // 2. Tracciamento sul contatto dell'AZIENDA (Ricezione nuova candidatura)
    await trackEvent({
      eventName: 'candidate_received',
      email: job.company_email,
      properties: {
        job_id: jobId,
        job_title: job.title,
        student_name: studentName,
        student_email: cleanStudentEmail,
        cv_url: cvUrl,
      },
    })
  } catch (crmError) {
    console.warn('[API Job Apply] Candidatura salvata su DB, ma tracciamento Brevo fallito:', crmError)
  }

  return res.status(200).json({ message: 'Candidatura inviata con successo!', application })
}

export default withApiAuth({ allowedMethods: ['POST'], allowedRoles: ['Studente'] }, applyHandler)