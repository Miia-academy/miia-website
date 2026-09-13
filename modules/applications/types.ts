export type ApplicationStatus = 'in_revisione' | 'letta' | 'rifiutata' | string

export interface Application {
  id: string
  job_id: string
  student_email: string
  cv_url: string
  status: ApplicationStatus
  applied_at: string
}

export interface CreateApplicationInput {
  job_id: string
  student_email: string
  cv_url: string
}