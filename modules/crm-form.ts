/**
 * Regole per i dati che i moduli pubblici del sito possono inviare a Brevo.
 *
 * L'endpoint /api/crm è pubblico: tutto ciò che arriva dal browser va trattato
 * come non affidabile. Qui si decide cosa può essere scritto nel CRM e come.
 */

// Liste che i moduli pubblici possono assegnare (configurabili da Storyblok).
// Non includono liste che danno accessi o che gestite voi a mano,
// come 42 "Studenti - diplomati" (accesso all'area studenti) o 18 "Studenti - Iscritti".
const DEFAULT_ALLOWED_LISTS = [15, 16, 17, 19, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 35]

export function getAllowedLists(): number[] {
  const fromEnv = process.env.CRM_ALLOWED_LISTS
  if (!fromEnv) return DEFAULT_ALLOWED_LISTS
  return fromEnv
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
}

// Attributi che un modulo pubblico non può mai scrivere: accessi, punteggi,
// stati gestiti dalle automazioni o dal backoffice.
const PROTECTED_ATTRIBUTES = new Set([
  'EMAIL',
  'TIPO_UTENTE',
  'MAGIC_TOKEN',
  'EXT_ID',
  'STORYBLOK_ID',
  'CV_URL',
  'LOGO_URL',
  'PORTFOLIO_URL',
  'COMPETENZE',
  'RICERCA',
  'RICERCA_ATTIVA',
  'AUTOMUNITO',
  'TRASFERTE',
  'FREELANCE',
  'REFERENTE',
  'DESCRIZIONE',
  'SITO_WEB',
  'INDIRIZZO',
  'PROVINCIA',
  'COMUNE',
  'VERIFICATO',
  'CONFERMA_CONTATTO',
  'PARTECIPAZIONE',
  'PARTECIPAZIONE_OPENDAY',
  'ISCRIZIONE',
  'INVIO_ISCRIZIONE',
  'ULTIMA_AZIONE',
  'DOUBLE_OPT-IN',
  'OPT_IN',
  'BLACKLIST',
  'READERS',
  'CLICKERS',
  'COINVOLGIMENTO',
  'INTERESSE',
  'AZIONE_ISCRIZIONE',
  'AZIONE_OPENDAY',
  'AZIONE_PROGRAMMA',
  'DOWNLOAD_MATERIALE',
  'ISCRIZIONI_OPENDAY',
  'OPENDAY_REMINDER',
  'VALIDATION',
])

const ATTRIBUTE_NAME = /^[A-Z][A-Z0-9_]{0,39}$/
const EVENT_NAME = /^submit_[a-z_]{1,30}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_TEXT = 2000
const MAX_ARRAY = 20
const MAX_PROPERTIES = 50

type Primitive = string | number | boolean

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}

/**
 * Riporta il telefono al formato internazionale salvato in Brevo (+39...).
 * Accetta spazi, trattini, punti e parentesi; "00" iniziale diventa "+".
 * Senza prefisso internazionale aggiunge +39.
 * Restituisce null se il numero non è plausibile.
 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  let phone = String(value).replace(/[\s().\-/]/g, '')
  if (!phone) return null
  if (phone.startsWith('00')) phone = '+' + phone.slice(2)
  // Prefisso duplicato generato dalla vecchia versione del modulo (+39+39...)
  phone = phone.replace(/^\+39\+39/, '+39')
  if (!phone.startsWith('+')) phone = '+39' + phone
  return /^\+\d{8,15}$/.test(phone) ? phone : null
}

function sanitizeValue(value: unknown): Primitive | Primitive[] | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const text = value.trim()
    return text ? text.slice(0, MAX_TEXT) : null
  }
  if (Array.isArray(value)) {
    const items = value
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v).trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, MAX_ARRAY)
    return items.length ? items : null
  }
  return null
}

/**
 * Tiene solo gli attributi ammessi, con valori semplici e di dimensione limitata.
 * I valori a scelta multipla vengono uniti a quelli già presenti nel contatto.
 */
export function sanitizeAttributes(
  raw: unknown,
  existing: Record<string, unknown> = {}
): Record<string, Primitive | Primitive[]> {
  const attributes: Record<string, Primitive | Primitive[]> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return attributes

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const name = key.toUpperCase()
    if (!ATTRIBUTE_NAME.test(name) || PROTECTED_ATTRIBUTES.has(name)) continue

    if (name === 'SMS') {
      const phone = normalizePhone(value)
      if (phone) attributes.SMS = phone
      continue
    }

    const clean = sanitizeValue(value)
    if (clean === null) continue

    const previous = existing[name]
    if (Array.isArray(clean) && Array.isArray(previous)) {
      attributes[name] = Array.from(new Set([...previous.map(String), ...clean.map(String)]))
    } else {
      attributes[name] = clean
    }
  }
  return attributes
}

export function sanitizeLists(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  const allowed = new Set(getAllowedLists())
  return Array.from(
    new Set(raw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && allowed.has(n)))
  )
}

export function sanitizeEventName(raw: unknown): string | null {
  return typeof raw === 'string' && EVENT_NAME.test(raw) ? raw : null
}

export function sanitizeEventProperties(raw: unknown): Record<string, Primitive> {
  const properties: Record<string, Primitive> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return properties

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(properties).length >= MAX_PROPERTIES) break
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key)) continue
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      properties[key] = value
    } else if (typeof value === 'string' && value.trim()) {
      properties[key] = value.trim().slice(0, MAX_TEXT)
    }
  }
  return properties
}

/** Il campo "validation" è nascosto: se arriva compilato, l'invio è di un bot. */
export function isBotSubmission(fields: unknown, attributes: unknown): boolean {
  const filled = (v: unknown) => v === true || (typeof v === 'string' && v.trim() !== '')
  const f = fields && typeof fields === 'object' ? (fields as Record<string, unknown>) : {}
  const a = attributes && typeof attributes === 'object' ? (attributes as Record<string, unknown>) : {}
  return filled(f.validation) || filled(a.VALIDATION)
}
