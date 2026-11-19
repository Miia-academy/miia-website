-- Iscrizione online: tabelle in uno schema dedicato, separate dal resto del sito.
-- Il sito è una vetrina: questi dati sono provvisori e pensati per essere
-- spostati nella futura app (pg_dump --schema=iscrizioni).
-- Si esegue una volta sola dalla console Neon (SQL Editor).

CREATE SCHEMA IF NOT EXISTS iscrizioni;

-- Una riga per iscrizione. Le colonne principali sono esplicite, i dettagli
-- di ogni sezione stanno in jsonb.
CREATE TABLE IF NOT EXISTS iscrizioni.iscrizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  corso text NOT NULL,                          -- cartella Storyblok, es. corso-interior-design-primo-livello
  canale text NOT NULL DEFAULT 'sito',          -- sito | sede (aggiunta a mano)
  stato text NOT NULL DEFAULT 'bozza'
    CHECK (stato IN ('bozza', 'firmata', 'recesso', 'definitiva', 'annullata')),
  sezioni_complete text[] NOT NULL DEFAULT '{}',

  -- Persona
  nome text,
  cognome text,
  telefono text,

  -- Edizione scelta: chiave = uuid della storia Storyblok + data di inizio,
  -- perché le storie delle edizioni vengono riusate negli anni.
  edizione_chiave text,
  edizione jsonb,                               -- copia congelata alla firma

  -- Pagamento (importi in euro, calcolati dal server)
  pagamento_modalita text CHECK (pagamento_modalita IN ('unica', '5_rate', '10_rate')),
  pagamento_rata numeric(10, 2),
  pagamento_totale numeric(10, 2),
  offerta_open_day boolean NOT NULL DEFAULT false,

  -- Dettagli delle sezioni
  dati jsonb NOT NULL DEFAULT '{}',             -- nascita, residenza, documento, fatturazione
  profilo jsonb NOT NULL DEFAULT '{}',          -- facoltativo
  consensi jsonb NOT NULL DEFAULT '{}',         -- valore, ora e versione dei testi
  documenti jsonb NOT NULL DEFAULT '{}',        -- percorsi nell'archivio privato, stato
  provenienza jsonb NOT NULL DEFAULT '{}',      -- origine_* / ultima_*

  -- Firma
  firmata_il timestamptz,
  fine_recesso date,
  condizioni_versione text,
  pdf_percorso text,
  pdf_sha256 text,

  creata_il timestamptz NOT NULL DEFAULT now(),
  aggiornata_il timestamptz NOT NULL DEFAULT now()
);

-- Una sola bozza aperta per persona e corso
CREATE UNIQUE INDEX IF NOT EXISTS iscrizioni_bozza_unica
  ON iscrizioni.iscrizioni (email, corso) WHERE stato = 'bozza';

-- Conteggio dei posti per edizione
CREATE INDEX IF NOT EXISTS iscrizioni_per_edizione
  ON iscrizioni.iscrizioni (edizione_chiave, stato);

-- Codici a 6 cifre (verifica email e firma). Si salva solo l'hash.
CREATE TABLE IF NOT EXISTS iscrizioni.codici (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  scopo text NOT NULL CHECK (scopo IN ('email', 'firma')),
  codice_hash text NOT NULL,
  scade_il timestamptz NOT NULL,
  tentativi integer NOT NULL DEFAULT 0,
  usato_il timestamptz,
  ip text,
  creato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS codici_per_email ON iscrizioni.codici (email, scopo, creato_il DESC);

-- Registro della firma: solo aggiunte, mai modifiche.
CREATE TABLE IF NOT EXISTS iscrizioni.registro (
  id bigserial PRIMARY KEY,
  iscrizione_id uuid NOT NULL REFERENCES iscrizioni.iscrizioni (id),
  evento text NOT NULL,                         -- codice_inviato, codice_verificato, firmata, pdf_generato, email_inviata, recesso
  ora timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  dettagli jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS registro_per_iscrizione ON iscrizioni.registro (iscrizione_id, ora);
