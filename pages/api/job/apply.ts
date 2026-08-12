// pages/api/job/apply.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'

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
  } catch {
    return res.status(401).json({ message: 'Sessione non valida o scaduta' })
  }

  const { job_title, company_name, company_email } = req.body

  if (!company_email || !job_title) {
    return res.status(400).json({ message: 'Dati inserzione mancanti (company_email, job_title)' })
  }

  // 2. Costruzione del Nome Studente e CV URL
  const studentName = `${authData.name || ''} ${authData.surname || ''}`.trim() || authData.email
  const cvUrl = authData.cv_url || ''

  try {
    // 3. Invio Evento a Brevo tramite la nostra rotta /api/crm
    // Inviando company_email come identifiers, l'email di Brevo partirà verso l'AZIENDA!
    const crmResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/crm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          identifiers: { email_id: company_email.trim().toLowerCase() },
          event_name: 'job_apply',
          event_properties: {
            company_name: company_name || '',
            job_title: job_title || '',
            student_name: studentName,
            cv_url: cvUrl,
            student_email: authData.email,
          },
        },
      }),
    })

    if (!crmResponse.ok) {
      throw new Error('Errore durante l\'invio del tracciamento a Brevo')
    }

    return res.status(200).json({ message: 'Candidatura inviata con successo!' })
  } catch (error: any) {
    console.error('[API Job Apply Error]', error)
    return res.status(500).json({ message: 'Errore durante l\'invio della candidatura' })
  }
}