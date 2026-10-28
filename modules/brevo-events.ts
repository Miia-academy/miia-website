/**
 * Event names and properties shared by GTM and Brevo (Ambito 3 spec, 22/10).
 *
 * The same name goes to the GTM dataLayer and to Brevo: submit_{event}_form.
 * Brevo events are light: only the data of that action, from a fixed list.
 * Everything else lives on the contact.
 */

export const EVENTS = {
  brochure: 'submit_brochure_form',
  news: 'submit_news_form',
  info: 'submit_info_form',
  openday: 'submit_openday_form',
  presence: 'submit_presence_form',
  answer: 'submit_answer_form',
  enrollment: 'submit_enrollment_form',
  signature: 'submit_signature_form',
} as const

/**
 * Storyblok "tracking" values before the switch to main: the forms still say
 * download, contact and open_day until the content is migrated
 * (scripts/storyblok-ambito3.mjs). Both old and new values give the new name.
 */
const LEGACY_TRACKING: Record<string, string> = {
  download: 'brochure',
  contact: 'info',
  open_day: 'openday',
}

/** Tracking value of a Storyblok form, with old names mapped to the new ones. */
export function normalizeTracking(tracking: unknown): string | undefined {
  const value = Array.isArray(tracking) ? tracking[0] : tracking
  if (typeof value !== 'string' || !value.trim()) return undefined
  const clean = value.trim()
  return LEGACY_TRACKING[clean] || clean
}

/** Event name of a form, the same for GTM and Brevo. */
export function formEventName(tracking: unknown): string {
  return `submit_${normalizeTracking(tracking) || 'form'}_form`
}

/** Properties every event may carry: the data of the action and where the visit came from. */
export const EVENT_PROPERTIES = [
  'area',
  'programma',
  'corso',
  'openday',
  'openday_data',
  'openday_codice',
  'openday_docenti',
  'openday_prezzo',
  'ultima_sorgente',
  'ultima_mezzo',
  'ultima_campagna',
  'ultima_pagina',
] as const

/** Extra properties of the events the server sends on its own. */
export const SERVER_EVENT_PROPERTIES: Record<string, readonly string[]> = {
  [EVENTS.presence]: ['ritardo'],
  [EVENTS.answer]: ['tipo', 'valore'],
  [EVENTS.signature]: ['sede', 'inizio', 'modalita', 'offerta_open_day'],
}

type Primitive = string | number | boolean

/** Keeps only the properties allowed for that event, dropping empty values. */
export function pickEventProperties(
  eventName: string,
  raw: Record<string, unknown>
): Record<string, Primitive> {
  const allowed = new Set<string>([...EVENT_PROPERTIES, ...(SERVER_EVENT_PROPERTIES[eventName] || [])])
  const properties: Record<string, Primitive> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) continue
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) {
      properties[key] = value
    } else if (typeof value === 'string' && value.trim()) {
      properties[key] = value.trim().slice(0, 500)
    }
  }
  return properties
}

/** The visit source sent with an event: only the ultima_* properties in the list. */
export function sourceEventProperties(raw: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of ['ultima_sorgente', 'ultima_mezzo', 'ultima_campagna', 'ultima_pagina']) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) result[key] = value.trim()
  }
  return result
}
