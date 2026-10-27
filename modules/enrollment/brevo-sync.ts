/**
 * Alla firma i dati dell'iscrizione vanno nel contatto, con i nomi e i valori del
 * dizionario degli attributi Brevo (26/10): PERSONA_, PROFILO_, INTERESSE_,
 * COMPETENZE_ descrivono la persona, ISCRIZIONE_ registra la firma. Non durante
 * la compilazione: un'iscrizione lasciata a metà non tocca il contatto.
 *
 * Restano fuori da Brevo: codice fiscale, documento, fatturazione e contratto
 * (dati da contratto, solo in Neon e nel bucket privato).
 */
import { trackEvent, upsertContact } from '@modules/brevo'
import { EVENTS, pickEventProperties, sourceEventProperties } from '@modules/brevo-events'
import { CATEGORY_IDS, INTEREST_PURPOSE, categoryId } from '@modules/brevo-attributes'
import { romeDate, withdrawalEnd } from './dates'
import type { Enrollment } from './types'

/** Brevo list 18 "Studenti - Iscritti": the contact joins it when signing. */
export const ENROLLED_LIST_ID = 18

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
  const frequenza = frequency(edition.giorni, edition.orari)
  // Multiple-choice attributes take a list, even with one value
  const one = (v: unknown) => (str(v) ? [str(v)] : null)
  const many = (v: unknown) => {
    const values = Array.isArray(v) ? v.map(str).filter(Boolean) : []
    return values.length ? values : null
  }
  const attrs: Record<string, unknown> = {
    PERSONA_NASCITA_DATA: str(d.data_nascita),
    PERSONA_INDIRIZZO: str(d.via),
    PERSONA_CAP: str(d.cap),
    PERSONA_COMUNE: str(d.comune),
    PERSONA_PROVINCIA: str(d.provincia).toUpperCase(),
    PROFILO_STUDI_TITOLO: one(p.titolo_studi),
    PROFILO_STUDI_AREA: one(p.area_studi),
    PROFILO_STUDI_ISTITUTO: str(p.istituto),
    PROFILO_STUDI_ANNO: str(p.anno_studi),
    PROFILO_FORMAZIONE_ULTIMA: str(p.ultima_formazione),
    PROFILO_FORMAZIONE_ANNO: str(p.anno_formazione),
    PROFILO_LAVORO_SITUAZIONE: one(str(p.situazione_lavoro).toLowerCase()),
    // Le chiavi di SETTORI_LAVORO sono anche le opzioni di PROFILO_LAVORO_SETTORE in Brevo.
    PROFILO_LAVORO_SETTORE: one(p.settore),
    PROFILO_LAVORO_AZIENDA: str(p.azienda),
    PROFILO_LAVORO_RUOLO: str(p.ruolo),
    INTERESSE_TEMPO_DISPONIBILE: one(p.ore_settimana),
    INTERESSE_SCOPO: one(INTEREST_PURPOSE[str(p.scopo)]),
    COMPETENZE_COMPUTER: one(p.computer),
    ORIGINE_DICHIARATA: many(p.come_ci_hai_conosciuto),
    ISCRIZIONE_STATO: CATEGORY_IDS.ISCRIZIONE_STATO.firmata,
    ISCRIZIONE_CORSO: corso,
    ISCRIZIONE_SEDE: categoryId('ISCRIZIONE_SEDE', sede),
    ISCRIZIONE_FREQUENZA: categoryId('ISCRIZIONE_FREQUENZA', frequenza),
    ISCRIZIONE_DATA: romeDate(signedAt),
    ISCRIZIONE_SCOPO: categoryId('ISCRIZIONE_SCOPO', p.scopo),
    ISCRIZIONE_PAGAMENTO_MODALITA: categoryId('ISCRIZIONE_PAGAMENTO_MODALITA', row.pagamento_modalita),
    ISCRIZIONE_OFFERTA_OPENDAY: row.offerta_open_day === true,
    ISCRIZIONE_RECESSO_FINE_DATA: withdrawalEnd(signedAt),
  }
  // Solo il sì: un "no" qui non deve cancellare un'iscrizione alla newsletter data altrove.
  if (voci.newsletter?.valore === true || voci.newsletter?.valore === 'si') attrs.NEWSLETTER = true
  // Si scrivono solo i dati presenti: un campo vuoto non cancella quello che Brevo sa già.
  return Object.fromEntries(Object.entries(attrs).filter(([, v]) => v !== '' && v !== null && v !== undefined))
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
 * Online enrollment started (email code confirmed): date on ISCRIZIONE_INIZIO_DATA,
 * course on ISCRIZIONE_CORSO and the submit_enrollment_form event, for the
 * abandoned-enrollment automation.
 */
export async function syncEnrollmentStart(row: Enrollment, corso: string, startedAt: Date) {
  await upsertContact({ email: row.email, attributes: { ISCRIZIONE_INIZIO_DATA: romeDate(startedAt), ISCRIZIONE_CORSO: corso } })
  await trackEvent({
    eventName: EVENTS.enrollment,
    email: row.email,
    properties: pickEventProperties(EVENTS.enrollment, { corso, ...sourceEventProperties(row.provenienza || {}) }),
  })
}
