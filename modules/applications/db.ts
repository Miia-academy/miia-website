import { neon } from '@neondatabase/serverless'
import type { Application, CreateApplicationInput, ApplicationStatus } from './types'

const sql = neon(process.env.DATABASE_URL!)

// 1. Controlla se uno studente si è già candidato a un'inserzione
export async function hasStudentApplied(jobId: string, studentEmail: string): Promise<boolean> {
  const rows = await sql`
    SELECT id 
    FROM applications
    WHERE job_id = ${jobId} AND student_email = ${studentEmail}
    LIMIT 1
  `
  return rows.length > 0
}

// 2. Inserisce una nuova candidatura (gestendo il vincolo UNIQUE in modo nativo)
export async function createApplication(data: CreateApplicationInput): Promise<Application | null> {
  const rows = await sql`
    INSERT INTO applications (job_id, student_email, cv_url, status)
    VALUES (${data.job_id}, ${data.student_email}, ${data.cv_url}, 'in_revisione')
    ON CONFLICT (job_id, student_email) DO NOTHING
    RETURNING id, job_id, student_email, cv_url, status, applied_at
  `
  return (rows[0] as Application) || null
}

// 3. Recupera le candidature per una specifica inserzione assicurandosi che l'azienda sia proprietaria
export async function getApplicationsByJobId(jobId: string, companyEmail: string): Promise<Application[]> {
  const rows = await sql`
    SELECT a.id, a.job_id, a.student_email, a.cv_url, a.status, a.applied_at
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.job_id = ${jobId} 
      AND j.company_email = ${companyEmail}
      AND a.status IN ('validata', 'letta')
    ORDER BY a.applied_at DESC
  `
  return rows as Application[]
}

// 4. Recupera le candidature per studente
export async function getStudentApplications(studentEmail: string): Promise<any[]> {
  const rows = await sql`
    SELECT 
      a.id AS application_id, 
      a.status, 
      a.applied_at, 
      j.id AS job_id, 
      j.title, 
      j.provincia,
      j.status AS job_status
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    WHERE a.student_email = ${studentEmail}
    ORDER BY a.applied_at DESC
  `
  return rows
}

// 5. [NUOVO] Aggiorna lo stato di una singola candidatura (per uso Admin/Azienda)
export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application | null> {
  const rows = await sql`
    UPDATE applications
    SET status = ${status}
    WHERE id = ${id}
    RETURNING id, job_id, student_email, cv_url, status, applied_at
  `
  return (rows[0] as Application) || null
}

export async function getAllApplications(): Promise<any[]> {
  const rows = await sql`
    SELECT 
      a.id AS application_id, 
      a.job_id,
      a.status, 
      a.applied_at, 
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

export interface CreateJobByAdminInput {
  title: string
  company_email: string
  provincia: string
  status?: string
}

export async function createJobByAdmin(data: CreateJobByAdminInput) {
  const rows = await sql`
    INSERT INTO jobs (title, company_email, provincia, status)
    VALUES (${data.title}, ${data.company_email}, ${data.provincia}, ${data.status || 'attiva'})
    RETURNING id, title, company_email, provincia, status, created_at
  `
  return rows[0]
}