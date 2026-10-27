/**
 * Controlli lato server delle sezioni dell'iscrizione.
 * Ogni funzione riceve quello che arriva dal browser e restituisce i valori
 * puliti oppure gli errori da mostrare sotto i campi.
 */
import { canBeForeign, documentNumberError, isDocumentType, normalizeDocumentNumber, type DocumentType } from './document-number'
import { normalizeEmail, normalizePhone } from '@modules/crm-form'
import { codiceFiscaleError, normalizeCodiceFiscale } from './codice-fiscale'
import { romeDate } from './dates'
import { PAYMENT_MODES, SECTIONS, type PaymentMode, type SectionId } from './types'

export type SectionResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> }

type Input = Record<string, unknown>

const REQUIRED = 'Il campo è obbligatorio'

// I limiti di lunghezza di text() servono contro i testi enormi: i campi con un
// formato fisso (CAP, provincia, P.IVA) si controllano dopo, senza tagliarli.

function text(input: Input, key: string, max = 120): string {
  const value = input[key]
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function result<T>(value: T, errors: Record<string, string>): SectionResult<T> {
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value }
}

function personName(value: string, label: string): string | null {
  if (!value) return REQUIRED
  if (value.length < 2) return `${label} deve avere almeno 2 caratteri`
  if (/\d/.test(value)) return `${label} non può contenere numeri`
  return null
}

// --- 1. Chi sei ---

export interface ChiSei {
  email: string
  nome: string
  cognome: string
  telefono: string
}

export function validateChiSei(input: Input): SectionResult<ChiSei> {
  const errors: Record<string, string> = {}
  const email = normalizeEmail(input.email)
  const nome = text(input, 'nome', 60)
  const cognome = text(input, 'cognome', 60)
  const telefono = normalizePhone(input.telefono)

  if (!email) errors.email = "L'indirizzo email non è valido"
  const nomeError = personName(nome, 'Il nome')
  if (nomeError) errors.nome = nomeError
  const cognomeError = personName(cognome, 'Il cognome')
  if (cognomeError) errors.cognome = cognomeError
  if (!telefono) errors.telefono = 'Il numero di cellulare non è valido'

  return result({ email: email || '', nome, cognome, telefono: telefono || '' }, errors)
}

// --- 2. Corso e pagamento ---

export const SCOPI = [
  'aggiornare_competenze',
  'cambiare_ruolo',
  'cambiare_settore',
  'professione',
  'curiosita',
] as const

export interface CorsoPagamento {
  edizione: string
  scopo: (typeof SCOPI)[number]
  modalita: PaymentMode
}

/** availableEditions: chiavi delle edizioni con posti liberi, lette da Storyblok e dal database. */
export function validateCorso(input: Input, availableEditions: readonly string[]): SectionResult<CorsoPagamento> {
  const errors: Record<string, string> = {}
  const edizione = text(input, 'edizione', 120)
  const scopo = text(input, 'scopo', 40) as CorsoPagamento['scopo']
  const modalita = text(input, 'modalita', 20) as PaymentMode

  if (!edizione) errors.edizione = "Scegli un'edizione"
  else if (!availableEditions.includes(edizione)) errors.edizione = "Questa edizione non è più disponibile: scegline un'altra"
  if (!SCOPI.includes(scopo)) errors.scopo = 'Scegli cosa ti aspetti dal corso'
  if (!PAYMENT_MODES.includes(modalita)) errors.modalita = 'Scegli come preferisci pagare'

  return result({ edizione, scopo, modalita }, errors)
}

// --- 3. Dati e documenti ---

export { DOCUMENT_TYPES } from './document-number'

export interface Azienda {
  ragione_sociale: string
  via: string
  cap: string
  partita_iva: string
  codice_fiscale: string
  pec: string
  sdi: string
}

export interface DatiContratto {
  data_nascita: string
  luogo_nascita: string
  codice_fiscale: string
  via: string
  comune: string
  provincia: string
  cap: string
  documento_tipo: DocumentType
  documento_numero: string
  /** Solo per carta elettronica e passaporto: rilasciato da un altro paese. */
  documento_estero: boolean
  documento_paese: string
  documenti: 'caricati' | 'dopo'
  azienda: Azienda | null
}

function ageOn(birth: string, today: string): number {
  const [by, bm, bd] = birth.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export function validateDati(
  input: Input,
  { documentiCaricati, now = new Date() }: { documentiCaricati: boolean; now?: Date }
): SectionResult<DatiContratto> {
  const errors: Record<string, string> = {}
  const data_nascita = text(input, 'data_nascita', 20)
  const luogo_nascita = text(input, 'luogo_nascita', 80)
  const codice_fiscale = normalizeCodiceFiscale(input.codice_fiscale)
  const via = text(input, 'via', 120)
  const comune = text(input, 'comune', 80)
  const provincia = text(input, 'provincia', 20).toUpperCase()
  const cap = text(input, 'cap', 20)
  const documento_tipo = text(input, 'documento_tipo', 40) as DatiContratto['documento_tipo']
  const documento_numero = normalizeDocumentNumber(input.documento_numero)
  const documento_estero = input.documento_estero === true && canBeForeign(documento_tipo)
  const documento_paese = documento_estero ? text(input, 'documento_paese', 60) : ''
  const documenti = input.documenti_dopo === true ? 'dopo' : 'caricati'

  const validBirth = /^\d{4}-\d{2}-\d{2}$/.test(data_nascita) && !Number.isNaN(Date.parse(data_nascita))
  if (!data_nascita) errors.data_nascita = REQUIRED
  else if (!validBirth) errors.data_nascita = 'La data di nascita non è valida'
  else if (ageOn(data_nascita, romeDate(now)) < 18) errors.data_nascita = 'Le iscrizioni sono aperte solo ai maggiorenni'

  if (!luogo_nascita) errors.luogo_nascita = REQUIRED
  const cfError = codiceFiscaleError(codice_fiscale, validBirth ? data_nascita : undefined)
  if (cfError) errors.codice_fiscale = cfError
  if (!via) errors.via = REQUIRED
  if (!comune) errors.comune = REQUIRED
  if (!/^[A-Z]{2}$/.test(provincia)) errors.provincia = 'Scrivi la sigla della provincia (es. TV)'
  if (!/^\d{5}$/.test(cap)) errors.cap = 'Il CAP ha 5 cifre'
  if (!isDocumentType(documento_tipo)) errors.documento_tipo = 'Scegli il tipo di documento'
  else {
    const numberError = documentNumberError(documento_tipo, documento_numero, documento_estero)
    if (numberError) errors.documento_numero = numberError
    if (documento_estero && !documento_paese) errors.documento_paese = 'Scrivi il paese che ha rilasciato il documento'
  }
  if (documenti === 'caricati' && !documentiCaricati) {
    errors.documenti = 'Carica le foto dei documenti, oppure scegli "Li carico dopo"'
  }

  let azienda: Azienda | null = null
  if (input.fatturazione_azienda === true) {
    const raw = (input.azienda && typeof input.azienda === 'object' ? input.azienda : {}) as Input
    azienda = {
      ragione_sociale: text(raw, 'ragione_sociale', 120),
      via: text(raw, 'via', 120),
      cap: text(raw, 'cap', 20),
      partita_iva: text(raw, 'partita_iva', 30).replace(/\s/g, ''),
      codice_fiscale: text(raw, 'codice_fiscale', 30).toUpperCase().replace(/\s/g, ''),
      pec: normalizeEmail(raw.pec) || '',
      sdi: text(raw, 'sdi', 20).toUpperCase(),
    }
    if (!azienda.ragione_sociale) errors['azienda.ragione_sociale'] = REQUIRED
    if (!azienda.via) errors['azienda.via'] = REQUIRED
    if (!/^\d{5}$/.test(azienda.cap)) errors['azienda.cap'] = 'Il CAP ha 5 cifre'
    if (!/^\d{11}$/.test(azienda.partita_iva)) errors['azienda.partita_iva'] = 'La partita IVA ha 11 cifre'
    if (azienda.codice_fiscale && !/^(\d{11}|[A-Z0-9]{16})$/.test(azienda.codice_fiscale)) {
      errors['azienda.codice_fiscale'] = 'Il codice fiscale non è valido'
    }
    if (azienda.sdi && !/^[A-Z0-9]{7}$/.test(azienda.sdi)) errors['azienda.sdi'] = 'Il codice SDI ha 7 caratteri'
    if (!azienda.pec && !azienda.sdi) errors['azienda.pec'] = 'Serve la PEC o il codice SDI'
  }

  return result(
    {
      data_nascita,
      luogo_nascita,
      codice_fiscale,
      via,
      comune,
      provincia,
      cap,
      documento_tipo,
      documento_numero,
      documento_estero,
      documento_paese,
      documenti,
      azienda,
    },
    errors
  )
}

// --- 4. Il tuo profilo (tutto facoltativo) ---

export const COME_CI_HAI_CONOSCIUTO = [
  'instagram',
  'facebook',
  'google',
  'pubblicita_internet',
  'spotify_radio',
  'amico',
  'locandine',
  'azienda',
] as const

export const TITOLI_STUDIO = ['licenza_media', 'diploma', 'laurea_triennale', 'laurea_magistrale', 'altro'] as const
export const ORE_SETTIMANA = ['almeno_6', 'tra_6_e_9', 'tutto_il_necessario'] as const
export const LIVELLI_COMPUTER = ['base', 'buona', 'ottima'] as const
/** Area del titolo di studio: stessi valori dell'attributo Brevo FORMAZIONE. */
export const AREE_STUDIO = [
  'artistica',
  'linguistica',
  'umanistica',
  'economica',
  'scientifica',
  'tecnologica',
  'salute',
  'agroalimentare',
  'turismo',
  'altro',
] as const
/** Situazione lavorativa: stessi valori dell'attributo Brevo PROFILO_LAVORO_SITUAZIONE. */
export const SITUAZIONI_LAVORO = [
  'studente',
  'disoccupato',
  'operativo',
  'tecnico',
  'impiegato',
  'freelance',
  'quadro',
  'dirigente',
  'imprenditore',
  'altro',
] as const
/** Chi studia o cerca lavoro non indica settore, azienda e ruolo. */
export const SENZA_LAVORO: readonly string[] = ['studente', 'disoccupato']
/** Settore di lavoro (proposta del 14/10, da confermare con Simone; in Brevo è l'attributo PROFILO_LAVORO_SETTORE). */
export const SETTORI_LAVORO = [
  'arredamento_design',
  'edilizia_architettura',
  'moda',
  'commercio_vendita',
  'marketing_comunicazione',
  'industria_produzione',
  'servizi',
  'pa_scuola',
  'sanita',
  'turismo_ristorazione',
  'altro',
] as const

export interface Profilo {
  titolo_studi: string
  area_studi: string
  istituto: string
  anno_studi: string
  ultima_formazione: string
  anno_formazione: string
  situazione_lavoro: string
  settore: string
  azienda: string
  ruolo: string
  ore_settimana: string
  computer: string
  come_ci_hai_conosciuto: string[]
  saltato: boolean
}

export function validateProfilo(input: Input): SectionResult<Profilo> {
  const errors: Record<string, string> = {}
  const year = (key: string) => {
    const value = text(input, key, 10)
    if (value && !/^(19|20)\d{2}$/.test(value)) errors[key] = "Scrivi l'anno con 4 cifre"
    return value
  }
  const choice = (key: string, allowed: readonly string[]) => {
    const value = text(input, key, 30)
    if (value && !allowed.includes(value)) errors[key] = 'Scegli una delle voci'
    return value
  }
  const sources = Array.isArray(input.come_ci_hai_conosciuto) ? input.come_ci_hai_conosciuto : []
  const situazione = choice('situazione_lavoro', SITUAZIONI_LAVORO)
  const noWork = SENZA_LAVORO.includes(situazione)

  return result(
    {
      titolo_studi: choice('titolo_studi', TITOLI_STUDIO),
      area_studi: choice('area_studi', AREE_STUDIO),
      istituto: text(input, 'istituto', 120),
      anno_studi: year('anno_studi'),
      ultima_formazione: text(input, 'ultima_formazione', 120),
      anno_formazione: year('anno_formazione'),
      situazione_lavoro: situazione,
      settore: noWork ? '' : choice('settore', SETTORI_LAVORO),
      azienda: noWork ? '' : text(input, 'azienda', 120),
      ruolo: noWork ? '' : text(input, 'ruolo', 80),
      ore_settimana: choice('ore_settimana', ORE_SETTIMANA),
      computer: choice('computer', LIVELLI_COMPUTER),
      come_ci_hai_conosciuto: Array.from(
        new Set(sources.filter((s): s is string => (COME_CI_HAI_CONOSCIUTO as readonly unknown[]).includes(s)))
      ),
      saltato: input.saltato === true,
    },
    errors
  )
}

// --- 5. Consensi ---

/** Le voci dei consensi vengono da Storyblok (vedi conditions.ts). */
export interface ConsentDefinition {
  chiave: string
  titolo: string
  tipo: 'spunta' | 'si_no'
  obbligatorio: boolean
}

export interface Consenso {
  /** true/false per una casella, "si"/"no" (o "" se non data) per una scelta Sì / No. */
  valore: boolean | string
  ora: string
  titolo: string
}

export interface Consensi {
  versione: string
  /** Impronta dei testi accettati (vedi conditions.ts), aggiunta dalla API. */
  impronta?: string
  voci: Record<string, Consenso>
}

/**
 * input: { [chiave]: true | "si" | "no" }. Caselle obbligatorie da spuntare,
 * scelte Sì / No obbligatorie da dare (anche No). Nessuna risposta preimpostata.
 */
export function validateConsensi(
  input: Input,
  voci: readonly ConsentDefinition[],
  versione: string,
  now: Date = new Date()
): SectionResult<Consensi> {
  const errors: Record<string, string> = {}
  const ora = now.toISOString()
  const out: Record<string, Consenso> = {}

  for (const v of voci) {
    const raw = input[v.chiave]
    if (v.tipo === 'si_no') {
      const valore = raw === 'si' || raw === 'no' ? raw : ''
      if (v.obbligatorio && !valore) errors[v.chiave] = 'Scegli sì o no'
      out[v.chiave] = { valore, ora, titolo: v.titolo }
    } else {
      const valore = raw === true
      if (v.obbligatorio && !valore) errors[v.chiave] = 'Questa conferma è obbligatoria'
      out[v.chiave] = { valore, ora, titolo: v.titolo }
    }
  }

  return result({ versione, voci: out }, errors)
}

// --- Avanzamento tra le sezioni ---

/** Prima sezione non ancora completata (quella da aprire). */
export function nextSection(complete: readonly SectionId[]): SectionId | null {
  return SECTIONS.find((s) => !complete.includes(s)) ?? null
}

/** Una sezione si può salvare solo se tutte quelle prima sono complete. */
export function canSaveSection(section: SectionId, complete: readonly SectionId[]): boolean {
  const index = SECTIONS.indexOf(section)
  return SECTIONS.slice(0, index).every((s) => complete.includes(s))
}

// Sezioni che cambiano ciò che si firma: modificarle annulla la firma in corso.
const SIGNED_CONTENT: readonly SectionId[] = ['chi_sei', 'corso', 'dati', 'consensi']

/** Sezioni complete dopo aver salvato (di nuovo) una sezione. */
export function completeAfterSave(section: SectionId, complete: readonly SectionId[]): SectionId[] {
  const next = new Set(complete)
  next.add(section)
  if (SIGNED_CONTENT.includes(section)) next.delete('firma')
  return SECTIONS.filter((s) => next.has(s))
}
