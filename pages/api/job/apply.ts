// pages/api/job/apply.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { trackEvent } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 1. Verifica della sessione dello studente dal cookie JWT
  const token = req.cookies.miia_auth_token
  if (!token) {
    return res.status(401).json({ message: 'Devi essere autenticato per candidarti.' })
  }

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida.' })
  }

  const { jobTitle, companyName, companyEmail } = req.body

  if (!jobTitle || !companyEmail) {
    return res.status(400).json({ message: 'Titolo Inserzione ed Email Azienda sono obbligatori.' })
  }

  const studentStoryblokId = authData.storyblok_id || ''
  const studentEmail = authData.email

  try {
    // 2. Costruzione del link sicuro per il download del CV
    const cvDownloadUrl = studentStoryblokId
      ? `${BASE_URL}/api/job/download?studentId=${studentStoryblokId}`
      : ''

    // 3. Invio dell'evento arricchito a Brevo per la notifica email all'azienda
    await trackEvent({
      eventName: 'submit_candidatura',
      email: studentEmail,
      properties: {
        job_title: jobTitle,
        company_name: companyName || '',
        company_email: companyEmail,
        student_email: studentEmail,
        student_id: studentStoryblokId,
        cv_download_url: cvDownloadUrl,
      },
    })

    return res.status(200).json({ message: 'Candidatura inviata con successo!' })
  } catch (error: any) {
    console.error('[API Job Apply Error]', error)
    return res.status(500).json({ message: 'Errore durante l\'invio della candidatura.' })
  }
}