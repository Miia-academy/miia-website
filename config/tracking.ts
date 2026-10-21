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
