/**
 * Alla firma i dati dell'iscrizione che hanno già un attributo in Brevo vanno nel
 * contatto, con gli stessi valori delle liste di Brevo (così segmenti e
 * automazioni esistenti funzionano senza conversioni). Non durante la
 * compilazione: un'iscrizione lasciata a metà non tocca il contatto.
 *
 * Restano fuori da Brevo: codice fiscale, documento, fatturazione e contratto
 * (dati da contratto, solo in Neon e nel bucket privato).
 */
import { upsertContact } from '@modules/brevo'
import { SCOPO_LABELS } from './labels'
import { romeDate } from './dates'
import type { Enrollment } from './types'

const STUDI: Record<string, string> = {
  licenza_media: 'media',
  diploma: 'superiore',
  laurea_triennale: 'laure',
  laurea_magistrale: 'laure',
}

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

export async function syncSignedContact(...args: Parameters<typeof signedContactAttributes>) {
  await upsertContact({ email: args[0].email, attributes: signedContactAttributes(...args) })
}
