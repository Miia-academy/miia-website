import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import { getJobById } from '@modules/jobs/db'
import { createApplication } from '@modules/applications/db'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 1. Validazione sessione Studente
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Devi essere loggato per candidarti' })
  }

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (authData.tipo_utente !== 'Studente') {
      return res.status(403).json({ message: 'Solo gli studenti possono inviare candidature' })
    }
  } catch {
    return res.status(401).json({ message: 'Sessione non valida o scaduta' })
  }

  // 2. Riceviamo l'ID dell'inserzione
  const { jobId, company_name } = req.body

  if (!jobId) {
    return res.status(400).json({ message: 'ID inserzione mancante' })
  }

  try {
    // 3. Recuperiamo i dettagli dell'inserzione dal DB (MOLTO PIÙ SICURO!)
    const job = await getJobById(jobId)
    if (!job) {
      return res.status(404).json({ message: 'Inserzione non trovata o chiusa' })
    }

    const cvUrl = authData.cv_url || req.body.cv_url || ''
    if (!cvUrl) {
      return res.status(400).json({ message: 'CV mancante nel profilo. Aggiorna il tuo profilo prima di candidarti.' })
    }

    // 4. Salvataggio su Neon DB (Gestisce nativamente i duplicati)
    const application = await createApplication({
      job_id: jobId,
      student_email: authData.email,
      cv_url: cvUrl,
    })

    if (!application) {
      return res.status(409).json({ message: 'Ti sei già candidato a questa inserzione in precedenza.' })
    }

    // 5. Costruzione del Nome Studente
    const studentName = `${authData.name || ''} ${authData.surname || ''}`.trim() || authData.email

    // 6. Invio Evento a Brevo (Inviato SOLO se l'inserimento a DB ha avuto successo)
    const crmResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/crm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          identifiers: { email_id: job.company_email }, // <-- Presa sicura dal DB!
          event_name: 'job_apply',
          event_properties: {
            company_name: company_name || '',
            job_title: job.title, // <-- Preso dal DB!
            student_name: studentName,
            cv_url: cvUrl,
            student_email: authData.email,
          },
        },
      }),
    })

    if (!crmResponse.ok) {
      console.warn('[API Job Apply] Candidatura salvata su DB, ma tracciamento Brevo fallito.')
    }

    return res.status(200).json({ message: 'Candidatura inviata con successo!', application })
  } catch (error: any) {
    console.error('[API Job Apply Error]', error)
    return res.status(500).json({ message: 'Errore durante l\'invio della candidatura' })
  }
}