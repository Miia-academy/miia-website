import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { markCvDownloaded } from '@modules/applications/db'
import {
  filePathFromUrl,
  getCompanyApplicationForFile,
  studentOwnsFile,
} from '@modules/applications/access'
import type { Application } from '@modules/applications/types'
import { getJobByApplicationId } from '@modules/jobs/db'
import { trackEvent, getContact } from '@modules/brevo'
import { getSignedFileUrl } from '@modules/google'
import type { AuthPayload } from '@modules/auth'
import { getJwtSecret } from '@modules/jwt-secret'

// Nel bucket privato ci sono solo i CV e i portfolio degli studenti
const ALLOWED_PREFIXES = ['cv/', 'portfolio/']

// Primo download del CV da parte di un'azienda: avvisa lo studente
async function notifyFirstCvDownload(application: Application, companyName: string) {
  const jobInfo = await getJobByApplicationId(application.id)
  if (!jobInfo) return

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://miia.it'
  const linkInserzione = `${baseUrl}/lavoro/inserzioni/${jobInfo.job_id}`

  // Recupero e normalizzazione dati Azienda completi
  let nomeAzienda = companyName
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { file, application_id } = req.query
  const filePath = typeof file === 'string' ? file.trim() : ''

  if (
    !filePath ||
    filePath.length > 300 ||
    filePath.includes('..') ||
    !ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  ) {
    return res.status(400).json({ message: 'Parametro file mancante o non valido.' })
  }

  // 1. Serve una sessione valida. Chi arriva da un link (per esempio da un'email) senza sessione
  //    passa dal login e poi torna al file.
  const goToLogin = () =>
    res.redirect(302, `/aziende/login?redirectUrl=${encodeURIComponent(req.url || '/')}`)

  const token = req.cookies['miia_auth_token']
  if (!token) return goToLogin()

  let decoded: AuthPayload
  try {
    decoded = jwt.verify(token, getJwtSecret()) as AuthPayload
  } catch {
    return goToLogin()
  }

  // 2. Ognuno scarica solo quello a cui ha diritto
  const applicationId = typeof application_id === 'string' ? application_id.trim() : ''
  let companyApplication: Application | null = null
  let allowed = false

  try {
    if (decoded.tipo_utente === 'Admin') {
      allowed = true
    } else if (decoded.tipo_utente === 'Studente') {
      allowed = await studentOwnsFile(decoded, filePath)
    } else if (decoded.tipo_utente === 'Azienda') {
      companyApplication = await getCompanyApplicationForFile(decoded.email, filePath, applicationId || undefined)
      allowed = !!companyApplication
    }
  } catch (accessErr) {
    console.error('[API Job Download] Errore nel controllo di accesso:', accessErr)
    return res.status(500).json({ message: 'Errore durante la verifica dei permessi.' })
  }

  if (!allowed) {
    return res.status(403).json({ message: 'Non hai accesso a questo file.' })
  }

  // 3. Tracciamento del download del CV (le aziende e il backoffice)
  const isCvOfApplication = !!companyApplication && filePathFromUrl(companyApplication.cv_url) === filePath
  const applicationToTrack =
    decoded.tipo_utente === 'Admin' ? applicationId : isCvOfApplication ? companyApplication!.id : ''

  if (applicationToTrack) {
    try {
      const updateResult = await markCvDownloaded(applicationToTrack)

      if (decoded.tipo_utente === 'Azienda' && companyApplication && updateResult?.is_first_download) {
        await notifyFirstCvDownload(companyApplication, decoded.azienda || '')
      }
    } catch (trackErr) {
      console.warn('[API Job Download] Impossibile eseguire tracking CV scaricato:', trackErr)
    }
  }

  // 4. Generazione Signed URL e Redirect
  try {
    const signedUrl = await getSignedFileUrl(filePath, false)
    return res.redirect(302, signedUrl)
  } catch (storageErr) {
    console.error('[API Job Download] Errore generazione Signed URL:', storageErr)
    return res.status(500).json({ message: 'Errore durante la generazione del link di download.' })
  }
}
