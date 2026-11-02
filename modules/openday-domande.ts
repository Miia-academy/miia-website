/**
 * Domande della pagina miia.it/open-day/accedi/<codice>, prima di entrare nell'open day.
 *
 * Le domande stanno in Storyblok in un modulo (content type "form") fatto come gli altri
 * moduli in moduli/: ogni campo "Selezione" o "Selezione multipla" è una domanda, e l'ID del
 * campo è il nome dell'attributo Brevo in minuscolo (interesse_inizio → INTERESSE_INIZIO).
 *
 * - Modulo: quello scelto nel campo "Modulo di accesso" dell'evento; se vuoto vale il modulo
 *   generale moduli/accesso-open-day.
 * - Si chiedono solo le domande il cui attributo è vuoto sul contatto, più quelle con la spunta
 *   "Chiedi sempre", al massimo MAX_DOMANDE, nell'ordine del modulo.
 * - Le risposte si salvano sul contatto quando la persona entra (l'ultima risposta vince,
 *   una domanda senza risposta non cancella mai un valore) e vanno nell'evento submit_presence_form.
 */
import { getStoryblokVersion } from '@config/version'
import { BrevoError, brevoFetch, getContact } from '@modules/brevo'
import { isFormWritableAttribute } from '@modules/crm-form'

export const MAX_DOMANDE = 3
export const MODULO_GENERALE = 'moduli/accesso-open-day'

const CDN = 'https://api.storyblok.com/v2/cdn'
const ID = /^[a-z][a-z0-9_]{0,39}$/
// Protetti per i moduli pubblici, ma qui il valore è sempre una delle opzioni del modulo in Storyblok:
// la domanda "Cosa vuoi scoprire oggi?" scrive lo stesso attributo dei link nelle email (/api/openday/risposta).
const AMMESSI_QUI = new Set(['OPENDAY_DOMANDA'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface Opzione {
  label: string
  value: string
}

export interface Domanda {
  /** ID del campo, cioè l'attributo Brevo in minuscolo */
  id: string
  label: string
  multipla: boolean
  sempre: boolean
  opzioni: Opzione[]
}

/** Quello che arriva al browser: testi del modulo e domande da fare, mai i valori del contatto. */
export interface Accesso {
  titolo: string
  testo: string
  domande: Domanda[]
}

export type Risposte = Record<string, string[]>

interface CampoStoryblok {
  id?: string
  input?: string
  label?: string
  options?: unknown
  hidden?: boolean
  ask_always?: boolean
}

export interface ModuloStoryblok {
  title?: string
  message?: string
  fields?: CampoStoryblok[]
}

/** Opzioni nella sintassi del campo Storyblok: "Etichetta:valore", una per riga. */
export function parseOpzioni(options: unknown): Opzione[] {
  if (typeof options !== 'string') return []
  const opzioni: Opzione[] = []
  for (const riga of options.split('\n')) {
    const i = riga.lastIndexOf(':')
    if (i <= 0) continue
    const label = riga.slice(0, i).trim()
    const value = riga.slice(i + 1).trim()
    if (label && value && !opzioni.some((o) => o.value === value)) opzioni.push({ label, value })
  }
  return opzioni
}

/** Le domande di un modulo: solo campi a scelta, visibili, con opzioni e un attributo scrivibile. */
export function domandeDelModulo(modulo: ModuloStoryblok | null | undefined): Domanda[] {
  const domande: Domanda[] = []
  for (const campo of modulo?.fields || []) {
    const id = (campo.id || '').trim().toLowerCase()
    if (!ID.test(id) || campo.hidden) continue
    if (campo.input !== 'select' && campo.input !== 'multiple') continue
    if (!isFormWritableAttribute(id.toUpperCase()) && !AMMESSI_QUI.has(id.toUpperCase())) continue
    const opzioni = parseOpzioni(campo.options)
    if (!opzioni.length || domande.some((d) => d.id === id)) continue
    domande.push({
      id,
      label: (campo.label || '').trim(),
      multipla: campo.input === 'multiple',
      sempre: campo.ask_always === true,
      opzioni,
    })
  }
  return domande
}

function vuoto(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return !value.trim()
  if (Array.isArray(value)) return !value.some((v) => String(v ?? '').trim())
  return false
}

/** Le domande da fare a questo contatto: attributo vuoto oppure "Chiedi sempre". */
export function daChiedere(domande: Domanda[], attributi: Record<string, unknown> = {}): Domanda[] {
  return domande.filter((d) => d.sempre || vuoto(attributi[d.id.toUpperCase()])).slice(0, MAX_DOMANDE)
}

/** Tiene solo risposte a domande del modulo, con valori tra le opzioni previste. */
export function risposteValide(domande: Domanda[], raw: unknown): Risposte {
  const risposte: Risposte = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return risposte
  for (const domanda of domande) {
    const valore = (raw as Record<string, unknown>)[domanda.id]
    const lista = (Array.isArray(valore) ? valore : [valore]).map((v) => (typeof v === 'string' ? v.trim() : ''))
    const ammessi = domanda.opzioni.map((o) => o.value)
    const scelti = Array.from(new Set(lista.filter((v) => ammessi.includes(v))))
    if (!scelti.length) continue
    risposte[domanda.id] = domanda.multipla ? scelti : scelti.slice(0, 1)
  }
  return risposte
}

/**
 * Attributi Brevo dalle risposte: lista per gli attributi a scelta multipla, testo per quelli
 * di testo. Gli altri tipi (categoria, data, numero...) non si scrivono da qui.
 */
export function attributiDaRisposte(
  risposte: Risposte,
  tipi: Record<string, string>,
): Record<string, string | string[]> {
  const attributi: Record<string, string | string[]> = {}
  for (const [id, valori] of Object.entries(risposte)) {
    const nome = id.toUpperCase()
    if (!valori.length) continue
    if (tipi[nome] === 'multiple-choice') attributi[nome] = valori
    else if (tipi[nome] === 'text') attributi[nome] = valori.join(', ')
  }
  return attributi
}

/** Proprietà dell'evento submit_presence_form: una per risposta, con il nome del campo. */
export function proprietaDaRisposte(risposte: Risposte): Record<string, string> {
  return Object.fromEntries(Object.entries(risposte).map(([id, valori]) => [id, valori.join(', ')]))
}

let tipiCache: { at: number; tipi: Record<string, string> } | null = null
const TIPI_DURATA = 10 * 60 * 1000

/** Tipo di ogni attributo Brevo (text, multiple-choice...), tenuto 10 minuti. */
export async function tipiAttributi(): Promise<Record<string, string>> {
  if (tipiCache && Date.now() - tipiCache.at < TIPI_DURATA) return tipiCache.tipi
  const data = await brevoFetch<{ attributes?: Array<{ name: string; type?: string; category?: string }> }>(
    '/contacts/attributes',
  )
  const tipi: Record<string, string> = {}
  for (const a of data.attributes || []) {
    if (a.category === 'normal' && a.type) tipi[a.name] = a.type
  }
  tipiCache = { at: Date.now(), tipi }
  return tipi
}

/** Solo per i test. */
export function svuotaCacheTipi() {
  tipiCache = null
}

async function storia(percorso: string): Promise<ModuloStoryblok | null> {
  const token = process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW
  if (!token) throw new Error('NEXT_PUBLIC_STORYBLOK_PREVIEW mancante')
  const query = new URLSearchParams({ token, version: getStoryblokVersion() })
  if (UUID.test(percorso)) query.set('find_by', 'uuid')
  const res = await fetch(`${CDN}/stories/${percorso}?${query}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Storyblok story ${percorso}: ${res.status}`)
  const data = (await res.json()) as { story?: { content?: ModuloStoryblok } }
  return data.story?.content || null
}

/** Il modulo di accesso dell'evento (uuid dal campo "Modulo di accesso"), o quello generale. */
export async function loadModuloAccesso(uuid?: string): Promise<ModuloStoryblok | null> {
  if (uuid && UUID.test(uuid)) {
    const scelto = await storia(uuid)
    if (scelto) return scelto
  }
  return storia(MODULO_GENERALE)
}

/** Testi e domande da mostrare a un contatto (attributi vuoti se l'email non è in Brevo). */
export function accessoPer(modulo: ModuloStoryblok | null, attributi: Record<string, unknown> = {}): Accesso {
  return {
    titolo: (modulo?.title || '').trim(),
    testo: (modulo?.message || '').trim(),
    domande: daChiedere(domandeDelModulo(modulo), attributi),
  }
}

/** Attributi del contatto in Brevo; vuoti se l'email non è un contatto. */
export async function attributiContatto(email: string): Promise<Record<string, unknown>> {
  try {
    const contact = await getContact({ identifier: email })
    return ((contact as { attributes?: Record<string, unknown> })?.attributes || {}) as Record<string, unknown>
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return {}
    throw error
  }
}
