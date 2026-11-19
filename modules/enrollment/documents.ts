/**
 * Foto dei documenti (passo 3). Stanno nel bucket privato, cartella
 * iscrizioni/<id>/, e non vanno mai in Brevo.
 */
import type { DatiContratto } from './validation'

export const DOCUMENT_SLOTS = ['documento_fronte', 'documento_retro', 'tessera_fronte', 'tessera_retro'] as const
export type DocumentSlot = (typeof DOCUMENT_SLOTS)[number]

export const SLOT_LABELS: Record<DocumentSlot, string> = {
  documento_fronte: 'Documento, fronte',
  documento_retro: 'Documento, retro',
  tessera_fronte: 'Tessera sanitaria, fronte',
  tessera_retro: 'Tessera sanitaria, retro',
}

/** Dopo la riduzione nel browser una foto pesa circa 0,5 MB: 10 MB lascia spazio ai PDF. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024

const TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export function isDocumentSlot(value: unknown): value is DocumentSlot {
  return typeof value === 'string' && (DOCUMENT_SLOTS as readonly string[]).includes(value)
}

/** Estensione per un tipo di file ammesso, o null. */
export function documentExtension(contentType: unknown): string | null {
  return typeof contentType === 'string' ? TYPES[contentType.toLowerCase()] ?? null : null
}

export function documentPath(enrollmentId: string, slot: DocumentSlot, ext: string, now: Date = new Date()): string {
  return `iscrizioni/${enrollmentId}/${slot}-${now.getTime()}.${ext}`
}

/** Il percorso appartiene a quell'iscrizione e a quella foto (non si accettano percorsi inventati). */
export function isOwnDocumentPath(path: unknown, enrollmentId: string, slot: DocumentSlot): path is string {
  if (typeof path !== 'string') return false
  const prefix = `iscrizioni/${enrollmentId}/${slot}-`
  return path.startsWith(prefix) && /^\d+\.(jpg|png|heic|heif|pdf)$/.test(path.slice(prefix.length))
}

/** Foto richieste: il passaporto non ha il retro. */
export function requiredSlots(documentType: DatiContratto['documento_tipo'] | string): DocumentSlot[] {
  return DOCUMENT_SLOTS.filter((s) => !(s === 'documento_retro' && documentType === 'passaporto'))
}

export interface StoredDocument {
  percorso: string
  tipo: string
  dimensione: number
  caricato_il: string
}

export function uploadedFiles(documenti: Record<string, unknown> | null | undefined): Partial<Record<DocumentSlot, StoredDocument>> {
  const files = documenti?.file
  return files && typeof files === 'object' ? (files as Partial<Record<DocumentSlot, StoredDocument>>) : {}
}

export function documentsComplete(documenti: Record<string, unknown> | null | undefined, documentType: string): boolean {
  const files = uploadedFiles(documenti)
  return requiredSlots(documentType).every((s) => !!files[s]?.percorso)
}
