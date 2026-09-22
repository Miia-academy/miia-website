import { neon } from '@neondatabase/serverless'
import type { Application, CreateApplicationInput, ApplicationStatus } from './types'

const sql = neon(process.env.DATABASE_URL!)

// 1. Controlla se uno studente si è già candidato a un'inserzione
export async function hasStudentApplied(jobId: string, studentEmail: string): Promise<boolean> {
  const cleanEmail = studentEmail.trim().toLowerCase()
  const rows = await sql`
    SELECT id 
    FROM applications
    WHERE job_id = ${jobId} AND LOWER(student_email) = ${cleanEmail}
    LIMIT 1
  `
  return rows.length > 0
}

// 2. Inserisce una nuova candidatura
export async function createApplication(data: CreateApplicationInput): Promise<Application | null> {
  const cleanEmail = data.student_email.trim().toLowerCase()
  const rows = await sql`
    INSERT INTO applications (job_id, student_email, cv_url, status)
    VALUES (${data.job_id}, ${cleanEmail}, ${data.cv_url}, 'in_revisione')
    ON CONFLICT (job_id, student_email) DO NOTHING
    RETURNING id, job_id, student_email, cv_url, status, applied_at, viewed_at, cv_downloaded_at
  `
  return (rows[0] as Application) || null
}

// 3. Recupera le candidature per un'inserzione (aziende proprietarie) comprese le metriche di lettura
export async function getApplicationsByJobId(jobId: string, companyEmail: string): Promise<Application[]> {
  const cleanEmail = companyEmail.trim().toLowerCase()
  const rows = await sql`
    SELECT 
      a.id, 
      a.job_id, 
      a.student_email, 
      a.cv_url, 
      a.status, 
      a.applied_at,
      a.viewed_at,
      a.cv_downloaded_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.job_id = ${jobId} 
      AND LOWER(j.company_email) = ${cleanEmail}
      AND a.status IN ('validata', 'letta')
    ORDER BY a.applied_at DESC
  `
  return rows as Application[]
}

// 4. Traccia la prima visualizzazione della scheda candidato da parte dell'azienda
export async function markApplicationAsViewed(applicationId: string, companyEmail: string) {
  const cleanEmail = companyEmail.trim().toLowerCase()
  const rows = await sql`
    UPDATE applications a
    SET 
      viewed_at = COALESCE(a.viewed_at, NOW()),
      status = CASE WHEN a.status = 'validata' THEN 'letta' ELSE a.status END
    FROM jobs j
    WHERE a.id = ${applicationId} 
      AND a.job_id = j.id 
      AND LOWER(j.company_email) = ${cleanEmail}
    RETURNING a.id, a.viewed_at, a.status
  `
  return rows[0] || null
}

// 5. Traccia il primo download del CV da parte dell'azienda con flag di controllo multiplo
export async function markCvDownloaded(applicationId: string) {
  const check = await sql`
    SELECT cv_downloaded_at 
    FROM applications 
    WHERE id = ${applicationId}
  `

  if (check.length === 0) return null

  const isFirstDownload = check[0].cv_downloaded_at === null

  if (isFirstDownload) {
    const rows = await sql`
      UPDATE applications
      SET cv_downloaded_at = NOW()
      WHERE id = ${applicationId}
      RETURNING id, cv_downloaded_at
    `
    return { ...rows[0], is_first_download: true }
  }

  return { id: applicationId, cv_downloaded_at: check[0].cv_downloaded_at, is_first_download: false }
}

// 6. Recupera le candidature per studente
export async function getStudentApplications(studentEmail: string) {
  const cleanEmail = studentEmail.trim().toLowerCase()

  const rows = await sql`
    SELECT 
      a.id AS application_id,
      a.job_id,
      a.status,
      a.applied_at,
      a.viewed_at,
      a.cv_downloaded_at,
      j.title,
      j.provincie,
      j.status AS job_status
    FROM applications a
    INNER JOIN jobs j ON a.job_id = j.id
    WHERE LOWER(a.student_email) = ${cleanEmail}
    ORDER BY a.applied_at DESC
  `

  return rows
}

// 7. Aggiorna lo stato di una singola candidatura
export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application | null> {
  const rows = await sql`
    UPDATE applications
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, job_id, student_email, cv_url, status, applied_at, viewed_at, cv_downloaded_at
  `
  return (rows[0] as Application) || null
}

// 8. Recupera tutte le candidature per il Backoffice Admin con metrica visite e download
export async function getAllApplications(): Promise<any[]> {
  const rows = await sql`
    SELECT 
      a.id AS application_id, 
      a.job_id,
      a.status, 
      a.applied_at, 
      a.viewed_at,
      a.cv_downloaded_at,
      a.student_email,
      a.cv_url,
      j.title AS job_title, 
      j.company_email
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    ORDER BY a.applied_at DESC
  `
  return rows
}