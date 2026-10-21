import type { NextApiRequest, NextApiResponse } from 'next'
import { getJobById } from '@modules/jobs/db'
import { createApplication } from '@modules/applications/db'
import { trackEvent, getContact } from '@modules/brevo'
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

  // The CV comes only from the student's own profile (session, or Brevo if the session is behind),
  // never from the request: otherwise a link to someone else's file would end up in the application.
  let cvUrl = authData.cv_url || ''
  if (!cvUrl) {
    try {
      const contact = await getContact({ identifier: authData.email })
      cvUrl = contact?.attributes?.CV_URL || ''
    } catch (crmError) {
      console.warn('[API Job Apply] CV non letto dal profilo Brevo:', crmError)
    }
  }
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
  const jobUrl = `${baseUrl}/lavoro/inserzioni/${job.id}`

  let nomeAzienda = company_name || ''
  let telefonoAzienda = ''
  try {
    const companyContact = await getContact({ identifier: job.company_email })
    const attrs = companyContact?.attributes || {}
    nomeAzienda = attrs.AZIENDA || nomeAzienda
    telefonoAzienda = attrs.SMS || attrs.TELEFONO || ''
  } catch (crmFetchError) {
    console.warn('[API Job Apply] Impossibile recuperare anagrafica azienda per tracciamento:', crmFetchError)
  }

  try {
    await trackEvent({
      eventName: 'job_applied',
      email: cleanStudentEmail,
      properties: {
        nome_studente: studentName,
        email_studente: cleanStudentEmail,
        telefono_studente: authData.sms || '',
        link_studente: cvUrl,
        titolo_inserzione: job.title,
        sede_lavoro: Array.isArray(job.provincie) ? job.provincie.join(', ') : '',
        nome_azienda: nomeAzienda,
        email_azienda: job.company_email,
        telefono_azienda: telefonoAzienda,
        link_inserzione: jobUrl,
      },
    })
  } catch (crmError) {
    console.warn('[API Job Apply] Tracciamento Brevo fallito per job_applied:', crmError)
  }

  return res.status(200).json({ message: 'Candidatura inviata con successo!', application })
}

export default withApiAuth({ allowedMethods: ['POST'], allowedRoles: ['Studente'] }, applyHandler)