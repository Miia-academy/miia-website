/**
 * Ciò che il browser riceve dell'iscrizione: solo i dati che la persona ha
 * inserito o verificato, e lo stato di avanzamento delle sezioni.
 */
import type { IncomingMessage } from 'node:http'
import type { Enrollment, PaymentMode, SectionId } from './types'
import { SECTIONS } from './types'
import { nextSection } from './validation'
import { uploadedFiles } from './documents'
import { suggestedSources } from './profile'

export interface EnrollmentState {
  email: string
  corso: string
  sezioni_complete: SectionId[]
  prossima: SectionId | null
  chi_sei: { nome: string; cognome: string; telefono: string }
  corso_pagamento: {
    edizione: string | null
    scopo: string | null
    modalita: PaymentMode | null
    rata: number | null
    totale: number | null
    offerta: boolean
  }
  /** Dati del passo 3 inseriti dalla persona (per riaprirli con "Modifica"). */
  dati: Record<string, unknown>
  /** Foto dei documenti già caricate (solo i nomi, mai i link ai file). */
  foto_caricate: string[]
  /** Passo 4: risposte salvate; prima del salvataggio, solo le voci suggerite di "Come ci hai conosciuto". */
  profilo: Record<string, unknown>
  /** Passo 5: le scelte date (senza le ore), per riaprirle con "Modifica". */
  consensi: Record<string, boolean | string>
}

/** Le risposte del passo 4, senza lo scopo (che è del passo 2). */
function profileAnswers(profilo: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const { scopo, ...rest } = profilo || {}
  void scopo
  return rest
}

/** Dal consenso salvato ({ valore, ora }) solo il valore; più la versione accettata. */
function consentChoices(consensi: Record<string, unknown> | null | undefined): Record<string, boolean | string> {
  const out: Record<string, boolean | string> = {}
  for (const [key, entry] of Object.entries(consensi || {})) {
    if (key === 'versione' && typeof entry === 'string') out.versione = entry
    else if (entry && typeof entry === 'object' && 'valore' in entry) {
      const v = (entry as { valore: unknown }).valore
      if (typeof v === 'boolean' || typeof v === 'string') out[key] = v
    }
  }
  return out
}

const num = (v: string | number | null) => (v === null || v === '' ? null : Number(v))

export function publicState(row: Enrollment): EnrollmentState {
  const complete = (row.sezioni_complete || []).filter((s): s is SectionId => SECTIONS.includes(s as SectionId))
  return {
    email: row.email,
    corso: row.corso,
    sezioni_complete: complete,
    prossima: nextSection(complete),
    chi_sei: { nome: row.nome || '', cognome: row.cognome || '', telefono: row.telefono || '' },
    corso_pagamento: {
      edizione: row.edizione_chiave,
      scopo: typeof row.profilo?.scopo === 'string' ? row.profilo.scopo : null,
      modalita: row.pagamento_modalita,
      rata: num(row.pagamento_rata),
      totale: num(row.pagamento_totale),
      offerta: !!row.offerta_open_day,
    },
    dati: row.dati || {},
    foto_caricate: Object.keys(uploadedFiles(row.documenti)),
    profilo: complete.includes('profilo')
      ? profileAnswers(row.profilo)
      : { come_ci_hai_conosciuto: suggestedSources(row.provenienza) },
    consensi: consentChoices(row.consensi),
  }
}

/** Corso nell'indirizzo della pagina, es. "corso-interior-design-primo-livello" (nome della cartella in Storyblok). */
export function normalizeCourseSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const slug = value.trim().toLowerCase()
  return slug.length <= 80 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? slug : null
}

export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'sconosciuto'
}

export function userAgent(req: IncomingMessage): string | null {
  const ua = req.headers['user-agent']
  return typeof ua === 'string' ? ua.slice(0, 300) : null
}
