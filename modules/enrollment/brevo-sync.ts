/**
 * Alla firma i dati dell'iscrizione che hanno già un attributo in Brevo vanno nel
 * contatto, con gli stessi valori delle liste di Brevo (così segmenti e
 * automazioni esistenti funzionano senza conversioni). Non durante la
 * compilazione: un'iscrizione lasciata a metà non tocca il contatto.
 *
 * Restano fuori da Brevo: codice fiscale, documento, fatturazione e contratto
 * (dati da contratto, solo in Neon e nel bucket privato).
 */
import { trackEvent, upsertContact } from '@modules/brevo'
import { EVENTS, pickEventProperties, sourceEventProperties } from '@modules/brevo-events'
import { SCOPO_LABELS } from './labels'
import { romeDate } from './dates'
import type { Enrollment } from './types'

// Options of the Brevo STUDI attribute ("laure" was corrected to "laurea" in Brevo on 22/10)
const STUDI: Record<string, string> = {
  licenza_media: 'media',
  diploma: 'superiore',
  laurea_triennale: 'laurea',
  laurea_magistrale: 'laurea',
}

/** Brevo list 18 "Studenti - Iscritti": the contact joins it when signing. */
export const ENROLLED_LIST_ID = 18

const SEDI = ['treviso', 'padova', 'bassano']

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Frequenza come in Brevo: sabato, serale o diurno. */
export function frequency(giorni: string[], orari: string[]): string {
  if (giorni.some((g) => /sabato/i.test(g))) return 'sabato'
  if (orari.some((o) => /(^|\D)(19|20|21):/.test(o))) return 'serale'
  return orari.length ? 'diurno' : ''
}

export function signedContactAttributes(
  row: Enrollment,
  edition: { sede: string; giorni: string[]; orari: string[] },
  corso: string,
  signedAt: Date
): Record<string, unknown> {
  const d = row.dati || {}
  const p = row.profilo || {}
  const voci = (row.consensi?.voci && typeof row.consensi.voci === 'object' ? row.consensi.voci : {}) as Record<
    string,
    { valore?: unknown }
  >
  const sede = edition.sede.toLowerCase()
  const situazione = str(p.situazione_lavoro)
  const attrs: Record<string, unknown> = {
    COMPLEANNO: str(d.data_nascita),
    INDIRIZZO: [str(d.via), str(d.cap)].filter(Boolean).join(', '),
    COMUNE: str(d.comune),
    PROVINCIA: str(d.provincia),
    STUDI: STUDI[str(p.titolo_studi)] ? [STUDI[str(p.titolo_studi)]] : null,
    FORMAZIONE: str(p.area_studi) ? [str(p.area_studi)] : null,
    PROFILO_FORMAZIONE: [str(p.ultima_formazione), str(p.anno_formazione)].filter(Boolean).join(', '),
    OCCUPAZIONE: situazione ? [situazione.charAt(0).toUpperCase() + situazione.slice(1)] : null,
    // Le chiavi di SETTORI_LAVORO sono anche i valori della lista SETTORE in Brevo.
    SETTORE: str(p.settore) ? [str(p.settore)] : null,
    AZIENDA: str(p.azienda),
    RUOLO: str(p.ruolo),
    ISCRIZIONE_CORSO: corso,
    CORSO: corso,
    SEDE: SEDI.includes(sede) ? [sede] : null,
    FREQUENZA: frequency(edition.giorni, edition.orari) ? [frequency(edition.giorni, edition.orari)] : null,
    ISCRIZIONE: romeDate(signedAt),
    ISCRIZIONE_SCOPO: SCOPO_LABELS[str(p.scopo)] || '',
  }
  // Solo il sì: un "no" qui non deve cancellare un'iscrizione alla newsletter data altrove.
  if (voci.newsletter?.valore === true || voci.newsletter?.valore === 'si') attrs.NEWSLETTER = true
  // Si scrivono solo i dati presenti: un campo vuoto non cancella quello che Brevo sa già.
  return Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== '' && v !== null))
}

/** Properties of the submit_signature_form event: the course and edition just signed, no amounts. */
export function signedEventProperties(
  row: Enrollment,
  edition: { sede: string; inizio?: string | null },
  corso: string
) {
  return pickEventProperties(EVENTS.signature, {
    corso,
    sede: edition.sede.toLowerCase(),
    inizio: edition.inizio || '',
    modalita: row.pagamento_modalita || '',
    offerta_open_day: row.offerta_open_day,
    ...sourceEventProperties(row.provenienza || {}),
  })
}

/**
 * At signing: contact data, list 18 and the submit_signature_form event that
 * starts the Brevo automations.
 */
export async function syncSignedContact(
  row: Enrollment,
  edition: { sede: string; giorni: string[]; orari: string[]; inizio?: string | null },
  corso: string,
  signedAt: Date
) {
  await upsertContact({
    email: row.email,
    attributes: signedContactAttributes(row, edition, corso, signedAt),
    listIds: [ENROLLED_LIST_ID],
  })
  await trackEvent({ eventName: EVENTS.signature, email: row.email, properties: signedEventProperties(row, edition, corso) })
}

/**
 * A draft is new when it was just created: the first verification of the email
 * for that course. Later verifications (another device, a day after) only update it.
 */
export function isNewDraft(row: Pick<Enrollment, 'creata_il' | 'aggiornata_il'>): boolean {
  return new Date(row.creata_il).getTime() === new Date(row.aggiornata_il).getTime()
}

/**
 * Online enrollment started (email code confirmed): date on INVIO_ISCRIZIONE,
 * course on CORSO and the submit_enrollment_form event, for the
 * abandoned-enrollment automation.
 */
export async function syncEnrollmentStart(row: Enrollment, corso: string, startedAt: Date) {
  await upsertContact({ email: row.email, attributes: { INVIO_ISCRIZIONE: romeDate(startedAt), CORSO: corso } })
  await trackEvent({
    eventName: EVENTS.enrollment,
    email: row.email,
    properties: pickEventProperties(EVENTS.enrollment, { corso, ...sourceEventProperties(row.provenienza || {}) }),
  })
}
