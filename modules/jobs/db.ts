import { neon } from '@neondatabase/serverless'
import type { Job, JobStatus, JobWithApplicantsCount, CreateJobInput } from './types'

const sql = neon(process.env.DATABASE_URL!)

// 1. Recupera tutte le offerte attive (per la bacheca annunci pubblica)
export async function getActiveJobs(): Promise<Job[]> {
  const rows = await sql`
    SELECT id, company_email, title, description, provincia, competenze, status, created_at, updated_at
    FROM jobs
    WHERE status = 'attiva'
    ORDER BY created_at DESC
  `
  return rows as Job[]
}

// 2. Recupera i dettagli di un singolo job tramite il suo ID (UUID)
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await sql`
    SELECT id, company_email, title, description, provincia, competenze, status, created_at, updated_at
    FROM jobs
    WHERE id = ${id} AND status != 'eliminata'
    LIMIT 1
  `
  return (rows[0] as Job) || null
}

// 3. Recupera i job dell'azienda nascondendo quelli 'eliminati' (Soft Delete)
export async function getBusinessJobs(companyEmail: string): Promise<JobWithApplicantsCount[]> {
  const rows = await sql`
    SELECT 
      j.id, 
      j.company_email, 
      j.title, 
      j.description, 
      j.provincia, 
      j.competenze, 
      j.status, 
      j.created_at,
      j.updated_at,
      COUNT(a.id)::int AS applicant_count
    FROM jobs j
    LEFT JOIN applications a ON a.job_id = j.id
    WHERE j.company_email = ${companyEmail} 
      AND j.status != 'eliminata'
    GROUP BY j.id
    ORDER BY j.created_at DESC
  `
  return rows as JobWithApplicantsCount[]
}

// 4. Inserimento di una nuova offerta di lavoro
export async function createJob(data: CreateJobInput): Promise<Job> {
  const competenzeArray = data.competenze && data.competenze.length > 0 ? data.competenze : []

  const rows = await sql`
    INSERT INTO jobs (company_email, title, description, provincia, competenze, status)
    VALUES (
      ${data.company_email}, 
      ${data.title}, 
      ${data.description}, 
      ${data.provincia}, 
      ${competenzeArray}, 
      'attiva'
    )
    RETURNING id, company_email, title, description, provincia, competenze, status, created_at, updated_at
  `
  return rows[0] as Job
}

// 5. Aggiorna i dettagli completi di un'inserzione (per UpdateJobModal)
export async function updateJobDetails(
  id: string,
  companyEmail: string,
  data: { title: string; description: string; provincia: string; competenze: string[] }
): Promise<boolean> {
  const rows = await sql`
    UPDATE jobs
    SET 
      title = ${data.title},
      description = ${data.description},
      provincia = ${data.provincia},
      competenze = ${data.competenze},
      updated_at = NOW()
    WHERE id = ${id} AND company_email = ${companyEmail} AND status != 'eliminata'
    RETURNING id
  `
  return rows.length > 0
}

// 6. Cambia solo lo stato di un'offerta (es. 'attiva' <-> 'chiusa')
export async function updateJobStatus(id: string, companyEmail: string, status: JobStatus): Promise<boolean> {
  const rows = await sql`
    UPDATE jobs
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND company_email = ${companyEmail} AND status != 'eliminata'
    RETURNING id
  `
  return rows.length > 0
}

// 7. Eliminazione logica (Soft Delete): nasconde l'annuncio senza cancellarlo dal DB
export async function deleteJob(id: string, companyEmail: string): Promise<boolean> {
  const rows = await sql`
    UPDATE jobs
    SET status = 'eliminata', updated_at = NOW()
    WHERE id = ${id} AND company_email = ${companyEmail}
    RETURNING id
  `
  return rows.length > 0
}