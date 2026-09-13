export type JobStatus = 'attiva' | 'chiusa' | 'eliminata' | string

export interface Job {
  id: string
  company_email: string
  title: string
  description: string
  provincia: string
  competenze: string[]
  status: JobStatus
  created_at: string
  updated_at: string
}

export interface JobWithApplicantsCount extends Job {
  applicant_count: number
}

export type CreateJobInput = {
  company_email: string
  title: string
  description: string
  provincia: string
  competenze?: string[]
}