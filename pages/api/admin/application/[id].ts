import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { updateApplicationStatus } from '@modules/applications/db'
import { getJobById } from '@modules/jobs/db'
import { trackEvent, getContact } from '@modules/brevo'

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

    const application = await updateApplicationStatus(applicationId, status)

    if (application) {
      try {
        const job = await getJobById(application.job_id)

        if (job) {
          const isAccepted = status === 'validata'
          const statoPayload = isAccepted ? 'accettata' : 'rifiutata'
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
          const jobUrl = `${baseUrl}/lavoro/inserzioni/${job.id}`

          let nomeStudente = application.student_email
          let telefonoStudente = ''
          try {
            const studentContact = await getContact({ identifier: application.student_email })
            const attrs = studentContact?.attributes || {}
            nomeStudente = `${attrs.NOME || ''} ${attrs.COGNOME || ''}`.trim() || application.student_email
            telefonoStudente = attrs.SMS || attrs.TELEFONO || ''
          } catch (fetchErr) {
            console.warn('[API Admin Application] Impossibile recuperare info studente', fetchErr)
          }

          let nomeAzienda = job.company_email
          let telefonoAzienda = ''
          try {
            const compContact = await getContact({ identifier: job.company_email })
            const attrs = compContact?.attributes || {}
            nomeAzienda = attrs.AZIENDA || job.company_email
            telefonoAzienda = attrs.SMS || attrs.TELEFONO || ''
          } catch (fetchErr) {
            console.warn('[API Admin Application] Impossibile recuperare info azienda', fetchErr)
          }

          await trackEvent({
            eventName: 'application_updated',
            email: application.student_email,
            properties: {
              stato_candidatura: statoPayload,
              titolo_inserzione: job.title,
              sede_lavoro: Array.isArray(job.provincie) ? job.provincie.join(', ') : '',
              livello_esperienza: job.grado_esperienza || '',
              tipo_contratto: job.tipo_contratto || '',
              orario_lavoro: job.orari_lavoro || '',
              frequenza_trasferte: job.trasferte || '',
              compenso_lavoro: job.ral || '',
              competenze_richieste: Array.isArray(job.competenze) ? job.competenze.join(', ') : '',
              nome_studente: nomeStudente,
              email_studente: application.student_email,
              telefono_studente: telefonoStudente,
              link_studente: application.cv_url,
              nome_azienda: nomeAzienda,
              email_azienda: job.company_email,
              telefono_azienda: telefonoAzienda,
              link_inserzione: jobUrl,
            },
          })
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