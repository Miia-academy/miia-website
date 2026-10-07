import type { Application } from './types'
import { getCompanyApplication, findCompanyApplicationByCvFile } from './db'
import { getContact } from '@modules/brevo'

const DOWNLOAD_PATH = '/api/job/download'

/**
 * Percorso del file in un link di download del sito (es. .../api/job/download?file=cv%2F123-cv-mario.pdf).
 * Restituisce null se l'indirizzo non è un link di download.
 */
export function filePathFromUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null

  try {
    const parsed = new URL(url, 'https://sito.invalid')
    if (parsed.pathname !== DOWNLOAD_PATH) return null
    return parsed.searchParams.get('file')
  } catch {
    return null
  }
}

async function filesInProfile(email: string): Promise<Array<string | null>> {
  try {
    const contact = await getContact({ identifier: email })
    const attributes = contact?.attributes || {}
    return [filePathFromUrl(attributes.CV_URL), filePathFromUrl(attributes.PORTFOLIO_URL)]
  } catch {
    return []
  }
}

/**
 * Candidatura che dà all'azienda il diritto di vedere la scheda di uno studente:
 * deve essere di un suo annuncio, già validata, e dello studente richiesto.
 */
export async function getCompanyApplicationForStudent(
  applicationId: string,
  companyEmail: string,
  studentEmail: string
): Promise<Application | null> {
  if (!applicationId) return null

  const application = await getCompanyApplication(applicationId, companyEmail)
  if (!application) return null

  const sameStudent = application.student_email.trim().toLowerCase() === studentEmail.trim().toLowerCase()
  return sameStudent ? application : null
}

/**
 * Candidatura che dà all'azienda il diritto di scaricare un file.
 * - Con l'identificativo della candidatura (pulsanti della scheda): il file deve essere il CV della
 *   candidatura oppure un file del profilo di quello studente (CV aggiornato, portfolio).
 * - Senza (link diretti nelle email): serve una candidatura validata dell'azienda che usi quel file come CV.
 */
export async function getCompanyApplicationForFile(
  companyEmail: string,
  filePath: string,
  applicationId?: string
): Promise<Application | null> {
  if (applicationId) {
    const application = await getCompanyApplication(applicationId, companyEmail)
    if (!application) return null

    if (filePathFromUrl(application.cv_url) === filePath) return application

    const profileFiles = await filesInProfile(application.student_email)
    return profileFiles.includes(filePath) ? application : null
  }

  const candidates = await findCompanyApplicationByCvFile(companyEmail, `file=${encodeURIComponent(filePath)}`)
  return candidates.find((application) => filePathFromUrl(application.cv_url) === filePath) || null
}

/** Uno studente può scaricare solo i propri file (CV e portfolio). */
export async function studentOwnsFile(
  student: { email: string; cv_url?: string; portfolio_url?: string },
  filePath: string
): Promise<boolean> {
  const inSession = [filePathFromUrl(student.cv_url), filePathFromUrl(student.portfolio_url)]
  if (inSession.includes(filePath)) return true

  // La sessione può essere indietro rispetto al profilo: si controlla anche il CRM
  const inProfile = await filesInProfile(student.email)
  return inProfile.includes(filePath)
}
