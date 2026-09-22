import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { markCvDownloaded } from '@modules/applications/db'
import { getJobByApplicationId } from '@modules/jobs/db'
import { trackEvent, getContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { file, application_id } = req.query
  const filePath = typeof file === 'string' ? file.trim() : ''

  if (!filePath) {
    return res.status(400).json({ message: 'Parametro file mancante o non valido.' })
  }

  const token = req.cookies['miia_auth_token']

  if (token && typeof application_id === 'string' && application_id.trim()) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

      if (decoded.tipo_utente === 'Azienda' || decoded.tipo_utente === 'Admin') {
        // 1. Aggiornamento DB e controllo primo download
        const updateResult = await markCvDownloaded(application_id.trim())

        // 2. Tracciamento CRM (solo Azienda e solo al primo download)
        if (decoded.tipo_utente === 'Azienda' && updateResult?.is_first_download) {
          try {
            const jobInfo = await getJobByApplicationId(application_id.trim())

            if (jobInfo) {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
              const linkInserzione = `${baseUrl}/lavoro/inserzioni/${jobInfo.job_id}`

              // Recupero e normalizzazione dati Azienda completi
              let nomeAzienda = decoded.azienda || ''
              let telefonoAzienda = ''
              let indirizzoAzienda = ''
              let referenteAzienda = ''

              try {
                const companyContact = await getContact({ identifier: jobInfo.company_email })
                const attrs = companyContact?.attributes || {}

                nomeAzienda = attrs.AZIENDA || nomeAzienda || jobInfo.company_email
                telefonoAzienda = attrs.SMS || attrs.TELEFONO || ''
                indirizzoAzienda = attrs.INDIRIZZO || ''
                referenteAzienda = attrs.REFERENTE || `${attrs.NOME || ''} ${attrs.COGNOME || ''}`.trim() || ''
              } catch {
                nomeAzienda = nomeAzienda || jobInfo.company_email
              }

              // Recupero Nome Studente
              let nomeStudente = jobInfo.student_email
              try {
                const studentContact = await getContact({ identifier: jobInfo.student_email })
                const attrs = studentContact?.attributes || {}
                nomeStudente = `${attrs.NOME || ''} ${attrs.COGNOME || ''}`.trim() || jobInfo.student_email
              } catch {
                // Errore recupero studente silenziato
              }

              // Invio evento a Brevo verso la mail dello studente
              await trackEvent({
                eventName: 'cv_downloaded',
                email: jobInfo.student_email,
                properties: {
                  nome_studente: nomeStudente,
                  nome_inserzione: jobInfo.title,
                  nome_azienda: nomeAzienda,
                  referente_azienda: referenteAzienda,
                  email_azienda: jobInfo.company_email,
                  telefono_azienda: telefonoAzienda,
                  indirizzo_azienda: indirizzoAzienda,
                  link_inserzione: linkInserzione,
                },
              })
            }
          } catch (fetchErr) {
            console.warn('[API Job Download] Impossibile eseguire tracking CV scaricato:', fetchErr)
          }
        }
      }
    } catch (authErr) {
      console.warn('[API Job Download] Token non valido per tracciamento download:', authErr)
    }
  }

  // 3. Redirect istantaneo all'URL originale passatogli
  return res.redirect(302, filePath)
}