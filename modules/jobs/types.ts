export type TipoContratto = 'stage' | 'determinato' | 'indeterminato' | 'partita_iva' | 'apprendistato'
export type OrarioLavoro = 'full_time' | 'part_time' | 'ibrido'
export type GradoEsperienza = 'prima_esperienza' | 'junior' | 'intermedio' | 'senior'
export type TrasferteOption = 'no' | 'occasionali' | 'frequenti'
export type JobStatus = 'attiva' | 'chiusa' | 'eliminata'

export interface Job {
  id: string
  company_email: string
  title: string
  description: string
  provincie: string[]
  tipo_contratto: TipoContratto
  ral?: string
  orari_lavoro: OrarioLavoro
  trasferte: TrasferteOption
  grado_esperienza: GradoEsperienza
  competenze: string[]
  lingue?: string[]
  status: JobStatus
  created_at: string
  updated_at: string
}

export interface JobWithApplicantsCount extends Job {
  applicant_count: number
}

export interface CreateJobInput {
  company_email: string
  title: string
  description: string
  provincie: string[]
  tipo_contratto?: TipoContratto
  ral?: string
  orari_lavoro?: OrarioLavoro
  trasferte?: TrasferteOption
  grado_esperienza?: GradoEsperienza
  competenze?: string[]
  lingue?: string[]
  status?: JobStatus
}

export interface UpdateJobInput {
  title?: string
  description?: string
  provincie?: string[]
  tipo_contratto?: TipoContratto
  ral?: string
  orari_lavoro?: OrarioLavoro
  trasferte?: TrasferteOption
  grado_esperienza?: GradoEsperienza
  competenze?: string[]
  lingue?: string[]
  status?: JobStatus
}

// Solo Triveneto (13 Province)
export const PROVINCE_TRIVENETO = [
  // Veneto
  { key: 'BL', label: 'Belluno (BL)' },
  { key: 'PD', label: 'Padova (PD)' },
  { key: 'RO', label: 'Rovigo (RO)' },
  { key: 'TV', label: 'Treviso (TV)' },
  { key: 'VE', label: 'Venezia (VE)' },
  { key: 'VR', label: 'Verona (VR)' },
  { key: 'VI', label: 'Vicenza (VI)' },
  // Trentino-Alto Adige
  { key: 'BZ', label: 'Bolzano (BZ)' },
  { key: 'TN', label: 'Trento (TN)' },
  // Friuli-Venezia Giulia
  { key: 'GO', label: 'Gorizia (GO)' },
  { key: 'PN', label: 'Pordenone (PN)' },
  { key: 'TS', label: 'Trieste (TS)' },
  { key: 'UD', label: 'Udine (UD)' },
]

// 4 Lingue principali
export const LINGUE_STRANIERE = [
  { key: 'inglese', label: 'Inglese' },
  { key: 'tedesco', label: 'Tedesco' },
  { key: 'francese', label: 'Francese' },
  { key: 'spagnolo', label: 'Spagnolo' },
]

export const TIPO_CONTRATTO_LABELS: Record<TipoContratto, string> = {
  stage: 'Stage / Tirocinio',
  determinato: 'Tempo Determinato',
  indeterminato: 'Tempo Indeterminato',
  partita_iva: 'Partita IVA / Collaborazione',
  apprendistato: 'Apprendistato',
}

export const ORARIO_LAVORO_LABELS: Record<OrarioLavoro, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  ibrido: 'Ibrido (Presenza / Remoto)',
}

export const GRADO_ESPERIENZA_LABELS: Record<GradoEsperienza, string> = {
  prima_esperienza: 'Prima esperienza (0-1 anni)',
  junior: 'Junior (1-3 anni)',
  intermedio: 'Intermedio (3-5 anni)',
  senior: 'Senior (oltre 5 anni)',
}

export const TRASFERTE_LABELS: Record<TrasferteOption, string> = {
  no: 'Non previste',
  occasionali: 'Occasionali',
  frequenti: 'Frequenti',
}