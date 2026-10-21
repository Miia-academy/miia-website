/**
 * Regole del tracciamento dei comportamenti sul sito.
 *
 * Qui stanno i pesi e le soglie con cui si calcola l'interesse di una persona.
 * Le condizioni dei singoli banner invece si scelgono in Storyblok.
 * Valori decisi con Miia il 19/10/2026 (funnel/sito/2026-10-19_Tracciamento_schema_dati.md).
 */

export const TRACKING = {
  // Dopo quanti giorni il riassunto scade e si riparte da zero.
  durataGiorni: 180,
  // Dopo quanti minuti senza attività una nuova pagina conta come nuova visita.
  pausaNuovaVisitaMinuti: 30,
  // Una pagina è "letta" se resta visibile sullo schermo almeno questi secondi.
  sogliaLetturaPaginaSecondi: 40,
  // Pagine più recenti conservate nel browser.
  maxPagine: 50,

  punti: {
    paginaVista: 1,
    paginaLetta: 2,
    nuovaVisita: 3,
  },

  // Fasce di interesse: da quanti punti si passa a tiepido e a caldo.
  fasce: {
    tiepido: 15,
    caldo: 40,
  },
} as const

/**
 * Peso delle pagine: le pagine più importanti contano di più.
 * Vale il primo prefisso che corrisponde all'indirizzo; le altre pagine pesano 1.
 */
export const PESI_PAGINE: Array<{ prefisso: string; peso: number }> = [
  { prefisso: '/corsi/', peso: 2 },
  { prefisso: '/open-day', peso: 2 },
]

/** Pagine che non contano: aree riservate, conferme, pagine tecniche. */
export const PAGINE_ESCLUSE = ['/admin', '/studenti', '/aziende', '/iscrizione', '/conferma', '/api']

/**
 * Area di una pagina, riconosciuta da parole nell'indirizzo.
 * Una pagina vista o letta aggiunge i suoi punti all'area.
 */
export const AREE: Record<string, string[]> = {
  interni: ['interni', 'interior'],
  moda: ['moda', 'fashion'],
}

/**
 * Moduli inviati, dal campo "tracking" del modulo in Storyblok.
 * `codice` è la lettera salvata nel riassunto, `punti` quanto vale l'invio,
 * `etichetta` il nome mostrato nel riquadro ?debug=profilo.
 */
export const MODULI: Record<string, { codice: string; punti: number; etichetta: string }> = {
  download: { codice: 'b', punti: 10, etichetta: 'Presentazione scaricata' },
  contact: { codice: 'i', punti: 10, etichetta: 'Richiesta informazioni' },
  open_day: { codice: 'o', punti: 20, etichetta: 'Iscrizione open day' },
  iscrizione: { codice: 'e', punti: 20, etichetta: 'Iscrizione al corso' },
  // "enroll" è il tracking del modulo di richiesta iscrizione in Storyblok (e in GTM)
  enroll: { codice: 'e', punti: 20, etichetta: 'Richiesta iscrizione' },
  newsletter: { codice: 'n', punti: 5, etichetta: 'Newsletter' },
  news: { codice: 'n', punti: 5, etichetta: 'Newsletter' },
}

/** Punti per un modulo che non è nell'elenco qui sopra. */
export const PUNTI_ALTRO_MODULO = 5

/**
 * Banner del sito (passo 6 del piano del 19/10, posizioni decise con Miia il 21/10).
 * Le voci di Pubblico e Momento si scelgono nel blocco Banner in Storyblok;
 * qui stanno le soglie dei Momenti e le regole per pagina.
 */
export const BANNER = {
  // Momento: quanti giorni prima conta "open day entro…", "corsi in partenza entro…", "prezzo agevolato in chiusura".
  giorniMomento: {
    'open-day-30': 30,
    'open-day-7': 7,
    'corsi-4-settimane': 28,
    'prezzo-agevolato-7': 7,
  } as Record<string, number>,
  // Pagine senza banner, oltre a quelle scritte in "Banner di tutto il sito": aree riservate e pagine tecniche.
  pagineEscluse: ['/admin', '/studenti', '/aziende', '/iscrizione', '/conferma', '/open-day/accedi', '/lavoro/inserzioni', '/contatti', '/api'],
  // Qui solo l'avviso: finestra e pannello coprirebbero il modulo della pagina.
  soloAvviso: ['/open-day'],
  // Qui la finestra diventa pannello, per non interrompere la lettura (articoli del blog).
  nienteFinestra: ['/blog/'],
  // Pagine che hanno già una sezione sull'open day: niente banner che portano all'open day.
  conSezioneOpenDay: ['/'],
  // Posto fisso in home: dopo la sezione con questo ID (in Storyblok, "Cosa offriamo").
  postoHomeDopoSezione: 'our-values',
  // L'avviso sparisce da solo dopo questi secondi (si ferma se ci passi sopra).
  avvisoSecondi: 15,
  // Sotto questa larghezza (px) la finestra diventa una scheda dal basso.
  larghezzaTelefono: 640,
  // Moduli con più campi da scrivere o scegliere di questi (email e caselle escluse) si compilano in due passi.
  campiUnPasso: 3,
  // Campi tenuti nel banner, per modulo (campo "tracking"); gli altri restano solo nella pagina.
  // Presentazione: deciso il 20/10 (niente sedi); area e livello arrivano nascosti, come nelle pagine corso.
  campiNelBanner: {
    download: ['email', 'nome', 'cognome', 'sms', 'finalita', 'validation'],
  } as Record<string, string[]>,
}
