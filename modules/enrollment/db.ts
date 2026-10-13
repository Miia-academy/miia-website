/**
 * Accesso ai dati dell'iscrizione (schema "iscrizioni" su Neon).
 * È l'unico punto del sito che legge o scrive queste tabelle: quando i dati
 * passeranno alla app dedicata, si cambia solo questo file.
 */
import { neon } from '@neondatabase/serverless'
import type { Enrollment, PaymentMode, Quote, SectionId } from './types'
import type { ChiSei, Consensi, DatiContratto, Profilo } from './validation'

let client: ReturnType<typeof neon> | null = null

function sql() {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL mancante')
    client = neon(process.env.DATABASE_URL)
  }
  return client
}

const json = (value: unknown) => JSON.stringify(value ?? {})

/** Riprende la bozza aperta della persona per quel corso, o ne crea una. */
export async function openDraft(email: string, corso: string, provenienza: Record<string, unknown> = {}) {
  const rows = (await sql()`
    INSERT INTO iscrizioni.iscrizioni (email, corso, provenienza)
    VALUES (${email}, ${corso}, ${json(provenienza)}::jsonb)
    ON CONFLICT (email, corso) WHERE stato = 'bozza'
    DO UPDATE SET aggiornata_il = now()
    RETURNING *
  `) as Enrollment[]
  return rows[0]
}

/** Legge un'iscrizione solo se appartiene a quell'email. */
export async function getEnrollment(id: string, email: string): Promise<Enrollment | null> {
  const rows = (await sql()`
    SELECT * FROM iscrizioni.iscrizioni WHERE id = ${id} AND email = ${email} LIMIT 1
  `) as Enrollment[]
  return rows[0] ?? null
}

// Ogni salvataggio vale solo per una bozza della stessa persona.

export async function saveChiSei(id: string, email: string, value: ChiSei, complete: SectionId[]) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET nome = ${value.nome}, cognome = ${value.cognome}, telefono = ${value.telefono},
        sezioni_complete = ${complete}::text[], aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}

export async function saveCorso(
  id: string,
  email: string,
  value: { edizione: string; scopo: string; modalita: PaymentMode },
  price: Quote,
  complete: SectionId[]
) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET edizione_chiave = ${value.edizione},
        pagamento_modalita = ${value.modalita},
        pagamento_rata = ${price.rata},
        pagamento_totale = ${price.totale},
        offerta_open_day = ${price.offerta},
        profilo = profilo || ${json({ scopo: value.scopo })}::jsonb,
        sezioni_complete = ${complete}::text[], aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}

export async function saveDati(id: string, email: string, value: DatiContratto, complete: SectionId[]) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET dati = ${json(value)}::jsonb,
        documenti = documenti || ${json({ stato: value.documenti })}::jsonb,
        sezioni_complete = ${complete}::text[], aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}

export async function saveProfilo(id: string, email: string, value: Profilo, complete: SectionId[]) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET profilo = profilo || ${json(value)}::jsonb,
        sezioni_complete = ${complete}::text[], aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}

export async function saveConsensi(id: string, email: string, value: Consensi, complete: SectionId[]) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET consensi = ${json(value)}::jsonb, condizioni_versione = ${value.versione},
        sezioni_complete = ${complete}::text[], aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}

/** Iscrizioni firmate o definitive per edizione (i recessi liberano il posto). */
export async function countSignedByEdition(keys: string[]): Promise<Record<string, number>> {
  if (!keys.length) return {}
  const rows = (await sql()`
    SELECT edizione_chiave, count(*)::int AS iscritti
    FROM iscrizioni.iscrizioni
    WHERE edizione_chiave = ANY(${keys}::text[]) AND stato IN ('firmata', 'definitiva')
    GROUP BY edizione_chiave
  `) as { edizione_chiave: string; iscritti: number }[]
  return Object.fromEntries(rows.map((r) => [r.edizione_chiave, r.iscritti]))
}
