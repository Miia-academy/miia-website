/**
 * Regole per i dati che i moduli pubblici del sito possono inviare a Brevo.
 *
 * L'endpoint /api/crm è pubblico: tutto ciò che arriva dal browser va trattato
 * come non affidabile. Qui si decide cosa può essere scritto nel CRM e come.
 */

// Liste che i moduli pubblici possono assegnare (configurabili da Storyblok).
// Non includono liste che danno accessi o che gestite voi a mano,
// come 42 "Studenti - diplomati" (accesso all'area studenti) o 18 "Studenti - Iscritti".
const DEFAULT_ALLOWED_LISTS = [15, 16, 17, 19, 23, 24, 25, 26, 28, 29, 30, 31, 32, 33, 35, 43]

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
  // Open day: presence, reserved price and texts are written only by the server
  'OD_RITARDO',
  'OD_VALIDO',
  'SCADENZA_OFFERTA',
  'DATA_PRESENZA',
  'OD_SCADENZA_TESTO',
  'OD_DATA_TESTO',
  'OD_PARTENZA',
  'OD_CALENDARIO',
  'OD_DOCENTI',
  'PROSSIMO_OD_TESTO',
])

// Gli attributi di provenienza li scrive solo il server, da sanitizeAttribution.
const SOURCE_ATTRIBUTE = /^(ORIGINE|ULTIMA)_(SORGENTE|MEZZO|CAMPAGNA|CONTENUTO|TERMINE|CLICK_ID|PAGINA|DATA)$/

// Prices come from the Storyblok price list, never from a form.
const PRICE_ATTRIBUTE = /^PREZZO_/
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
  // Senza "+": 39 seguito da 9-10 cifre è già internazionale (così lo restituisce
  // Brevo, es. 393331234567); un numero italiano nazionale non ha mai 11-12 cifre
  // che iniziano per 39.
  if (!phone.startsWith('+')) phone = /^39\d{9,10}$/.test(phone) ? '+' + phone : '+39' + phone
  if (phone.startsWith('+39') && !/^\+39\d{6,11}$/.test(phone)) return null
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
    if (!ATTRIBUTE_NAME.test(name) || PROTECTED_ATTRIBUTES.has(name) || SOURCE_ATTRIBUTE.test(name) || PRICE_ATTRIBUTE.test(name)) continue

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

const TOUCH_FIELDS: Array<[string, string]> = [
  ['source', 'SORGENTE'],
  ['medium', 'MEZZO'],
  ['campaign', 'CAMPAGNA'],
  ['content', 'CONTENUTO'],
  ['term', 'TERMINE'],
  ['click_id', 'CLICK_ID'],
  ['landing', 'PAGINA'],
]

function touchAttributes(raw: unknown, prefix: 'ORIGINE' | 'ULTIMA'): Record<string, string> {
  const result: Record<string, string> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  const touch = raw as Record<string, unknown>
  for (const [key, suffix] of TOUCH_FIELDS) {
    const value = touch[key]
    if (typeof value === 'string' && value.trim()) {
      result[`${prefix}_${suffix}`] = value.trim().slice(0, 150)
    }
  }
  if (typeof touch.date === 'string') {
    const date = new Date(touch.date)
    if (!Number.isNaN(date.valueOf())) result[`${prefix}_DATA`] = date.toISOString().slice(0, 10)
  }
  return result
}

/** Gli attributi di provenienza si scrivono solo se sono stati creati in Brevo. */
export function isSourceTrackingEnabled(): boolean {
  return process.env.CRM_SOURCE_ATTRIBUTES === 'on'
}

/**
 * Provenienza del contatto inviata dal modulo (vedi @modules/attribution).
 * ORIGINE_* è il primo contatto: si scrive solo se in Brevo è ancora vuoto.
 * ULTIMA_* è la provenienza di questo invio e si aggiorna ogni volta.
 */
export function sanitizeAttribution(
  raw: unknown,
  existing: Record<string, unknown> = {}
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const { first, last } = raw as { first?: unknown; last?: unknown }
  const hasOrigin = Object.keys(existing).some((k) => k.startsWith('ORIGINE_') && !!existing[k])
  return {
    ...(hasOrigin ? {} : touchAttributes(first || last, 'ORIGINE')),
    ...touchAttributes(last || first, 'ULTIMA'),
  }
}

/**
 * La stessa provenienza per l'evento Brevo che avvia le automazioni, con i nomi
 * in minuscolo (per esempio `ultima_campagna`). Qui `origine_*` è sempre il
 * primo contatto noto al browser, anche se in Brevo il contatto ne ha già uno.
 */
export function attributionEventProperties(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const { first, last } = raw as { first?: unknown; last?: unknown }
  const properties: Record<string, string> = {}
  const all = { ...touchAttributes(first || last, 'ORIGINE'), ...touchAttributes(last || first, 'ULTIMA') }
  for (const [key, value] of Object.entries(all)) properties[key.toLowerCase()] = value
  return properties
}
