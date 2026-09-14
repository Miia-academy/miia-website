import { neon } from '@neondatabase/serverless'
import type { Job, JobStatus, JobWithApplicantsCount, CreateJobInput, UpdateJobInput } from './types'

const sql = neon(process.env.DATABASE_URL!)

// 1. Recupera tutte le offerte attive per la bacheca pubblica
export async function getActiveJobs(): Promise<Job[]> {
  const rows = await sql`
    SELECT 
      id, company_email, title, description, provincie, 
      tipo_contratto, ral, orari_lavoro, 
      trasferte, grado_esperienza, competenze, lingue, status, 
      created_at, updated_at
    FROM jobs
    WHERE status = 'attiva'
    ORDER BY created_at DESC
  `
  return rows as Job[]
}

// 2. Recupera i dettagli di un singolo job tramite UUID
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await sql`
    SELECT 
      id, company_email, title, description, provincie, 
      tipo_contratto, ral, orari_lavoro, 
      trasferte, grado_esperienza, competenze, lingue, status, 
      created_at, updated_at
    FROM jobs
    WHERE id = ${id} AND status != 'eliminata'
    LIMIT 1
  `
  return (rows[0] as Job) || null
}

// 3. Recupera le inserzioni dell'azienda con il conteggio dei candidati
export async function getBusinessJobs(companyEmail: string): Promise<JobWithApplicantsCount[]> {
  const rows = await sql`
    SELECT 
      j.id, 
      j.company_email, 
      j.title, 
      j.description, 
      j.provincie, 
      j.tipo_contratto, 
      j.ral, 
      j.orari_lavoro, 
      j.trasferte, 
      j.grado_esperienza, 
      j.competenze, 
      j.lingue,
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
  // Deduplichiamo e puliamo gli array prima dell'inserimento
  const competenzeArray = data.competenze && data.competenze.length > 0
    ? Array.from(new Set(data.competenze.map(s => s.trim())))
    : []
  const provincieArray = data.provincie && data.provincie.length > 0 ? data.provincie : []
  const lingueArray = data.lingue && data.lingue.length > 0
    ? Array.from(new Set(data.lingue.map(s => s.trim())))
    : []

  const rows = await sql`
    INSERT INTO jobs (
      company_email, title, description, provincie, tipo_contratto, 
      ral, orari_lavoro, trasferte, grado_esperienza, competenze, lingue, status
    )
    VALUES (
      ${data.company_email}, ${data.title}, ${data.description}, ${provincieArray}, 
      ${data.tipo_contratto || 'indeterminato'}, ${data.ral || null}, 
      ${data.orari_lavoro || 'full_time'}, ${data.trasferte || 'no'}, 
      ${data.grado_esperienza || 'prima_esperienza'}, 
      ${competenzeArray}, ${lingueArray}, ${data.status || 'attiva'}
    )
    RETURNING *
  `
  return rows[0] as Job
}

// 5. Aggiornamento completo di un'inserzione
export async function updateJob(
  id: string,
  companyEmail: string,
  data: UpdateJobInput
): Promise<Job | null> {
  // Deduplichiamo e puliamo gli array prima dell'aggiornamento
  const competenzeArray = data.competenze && data.competenze.length > 0
    ? Array.from(new Set(data.competenze.map(s => s.trim())))
    : []
  const provincieArray = data.provincie && data.provincie.length > 0 ? data.provincie : []
  const lingueArray = data.lingue && data.lingue.length > 0
    ? Array.from(new Set(data.lingue.map(s => s.trim())))
    : []

  const rows = await sql`
    UPDATE jobs
    SET 
      title = COALESCE(${data.title}, title),
      description = COALESCE(${data.description}, description),
      provincie = ${provincieArray},
      tipo_contratto = COALESCE(${data.tipo_contratto}, tipo_contratto),
      ral = ${data.ral || null},
      orari_lavoro = COALESCE(${data.orari_lavoro}, orari_lavoro),
      trasferte = COALESCE(${data.trasferte}, trasferte),
      grado_esperienza = COALESCE(${data.grado_esperienza}, grado_esperienza),
      competenze = ${competenzeArray},
      lingue = ${lingueArray},
      updated_at = NOW()
    WHERE id = ${id} AND company_email = ${companyEmail} AND status != 'eliminata'
    RETURNING *
  `
  return (rows[0] as Job) || null
}

// Alias per retrocompatibilità se usato altrove
export const updateJobDetails = async (
  id: string,
  companyEmail: string,
  data: UpdateJobInput
): Promise<boolean> => {
  const result = await updateJob(id, companyEmail, data)
  return Boolean(result)
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

// 7. Eliminazione logica (Soft Delete)
export async function deleteJob(id: string, companyEmail: string): Promise<boolean> {
  const rows = await sql`
    UPDATE jobs
    SET status = 'eliminata', updated_at = NOW()
    WHERE id = ${id} AND company_email = ${companyEmail}
    RETURNING id
  `
  return rows.length > 0
}