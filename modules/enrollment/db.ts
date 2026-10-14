/**
 * Accesso ai dati dell'iscrizione (schema "iscrizioni" su Neon).
 * È l'unico punto del sito che legge o scrive queste tabelle: quando i dati
 * passeranno alla app dedicata, si cambia solo questo file.
 */
import { neon } from '@neondatabase/serverless'
import type { Enrollment, PaymentMode, Quote, SectionId } from './types'
import type { ChiSei, Consensi, DatiContratto, Profilo } from './validation'
import type { CodePurpose } from './codes'

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

// --- Codici di verifica ---

/** Codici inviati nell'ultima ora, per email e per IP, e l'ora dell'ultimo invio a quell'email. */
export async function recentCodeSends(email: string, ip: string, scopo: CodePurpose) {
  const rows = (await sql()`
    SELECT
      count(*) FILTER (WHERE email = ${email})::int AS per_email,
      count(*) FILTER (WHERE ip = ${ip})::int AS per_ip,
      max(creato_il) FILTER (WHERE email = ${email}) AS ultimo
    FROM iscrizioni.codici
    WHERE scopo = ${scopo} AND creato_il > now() - interval '1 hour'
      AND (email = ${email} OR ip = ${ip})
  `) as { per_email: number; per_ip: number; ultimo: string | Date | null }[]
  const row = rows[0]
  return {
    perEmail: row?.per_email ?? 0,
    perIp: row?.per_ip ?? 0,
    lastAt: row?.ultimo ? new Date(row.ultimo) : null,
  }
}

export async function insertCode(email: string, scopo: CodePurpose, hash: string, minutes: number, ip: string) {
  await sql()`
    INSERT INTO iscrizioni.codici (email, scopo, codice_hash, scade_il, ip)
    VALUES (${email}, ${scopo}, ${hash}, now() + make_interval(mins => ${minutes}), ${ip})
  `
}

/** L'ultimo codice inviato, se non è scaduto né già usato: quelli precedenti non valgono più. */
export async function latestActiveCode(email: string, scopo: CodePurpose) {
  const rows = (await sql()`
    SELECT id, codice_hash, tentativi, (usato_il IS NULL AND scade_il > now()) AS attivo
    FROM iscrizioni.codici
    WHERE email = ${email} AND scopo = ${scopo}
    ORDER BY creato_il DESC
    LIMIT 1
  `) as { id: string; codice_hash: string; tentativi: number; attivo: boolean }[]
  const row = rows[0]
  return row && row.attivo ? row : null
}

/**
 * Conta un tentativo prima di confrontare il codice, così più richieste in
 * parallelo non superano il limite. Restituisce false se i tentativi sono finiti.
 */
export async function takeCodeAttempt(id: string, max: number): Promise<boolean> {
  const rows = (await sql()`
    UPDATE iscrizioni.codici SET tentativi = tentativi + 1
    WHERE id = ${id} AND tentativi < ${max} AND usato_il IS NULL
    RETURNING id
  `) as { id: string }[]
  return rows.length > 0
}

/** Segna il codice come usato; false se un'altra richiesta l'ha già usato. */
export async function markCodeUsed(id: string): Promise<boolean> {
  const rows = (await sql()`
    UPDATE iscrizioni.codici SET usato_il = now()
    WHERE id = ${id} AND usato_il IS NULL
    RETURNING id
  `) as { id: string }[]
  return rows.length > 0
}

// --- Registro ---

export async function logEvent(
  iscrizioneId: string,
  evento: string,
  ip: string | null,
  userAgent: string | null,
  dettagli: Record<string, unknown> = {}
) {
  await sql()`
    INSERT INTO iscrizioni.registro (iscrizione_id, evento, ip, user_agent, dettagli)
    VALUES (${iscrizioneId}, ${evento}, ${ip}, ${userAgent}, ${json(dettagli)}::jsonb)
  `
}

// --- Documenti ---

/** Registra una foto caricata (solo percorso e dati tecnici, il file sta nel bucket privato). */
export async function saveDocument(id: string, email: string, slot: string, info: Record<string, unknown>) {
  const rows = (await sql()`
    UPDATE iscrizioni.iscrizioni
    SET documenti = documenti || jsonb_build_object(
          'file', coalesce(documenti->'file', '{}'::jsonb) || jsonb_build_object(${slot}::text, ${json(info)}::jsonb)
        ),
        aggiornata_il = now()
    WHERE id = ${id} AND email = ${email} AND stato = 'bozza'
    RETURNING *
  `) as Enrollment[]
  return rows[0] ?? null
}
