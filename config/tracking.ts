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
 * Site banners (step 6 of the 19/10 plan, positions agreed with Miia on 21/10).
 * Audience and timing items are chosen in the Banner block in Storyblok;
 * here are the timing thresholds and the per-page rules.
 */
export const BANNER = {
  // Timing: how many days before counts as "open day within…", "courses starting within…", "reduced price ending".
  timingDays: {
    'open-day-30': 30,
    'open-day-7': 7,
    'corsi-4-settimane': 28,
    'prezzo-agevolato-7': 7,
  } as Record<string, number>,
  // Pages without banners, besides the ones written in "Banner di tutto il sito": private areas and technical pages.
  excludedPages: ['/admin', '/studenti', '/aziende', '/iscrizione', '/conferma', '/open-day/accedi', '/lavoro/inserzioni', '/contatti', '/api'],
  // Only the notice here: window and panel would cover the page form.
  noticeOnly: ['/open-day'],
  // Here the window becomes a panel, so reading is not interrupted (blog articles).
  noWindow: ['/blog/'],
  // Pages that already have an open day section: no banners leading to the open day.
  withOpenDaySection: ['/'],
  // Fixed place in the home: after the section with this ID (in Storyblok, "Cosa offriamo").
  homeSlotAfterSection: 'our-values',
  // The notice disappears by itself after these seconds (it stops while hovered).
  noticeSeconds: 15,
  // Below this width (px) the window becomes a bottom sheet.
  phoneWidth: 640,
  // Forms with more fields to type or choose than this (email and checkboxes excluded) take two steps.
  oneStepFields: 3,
  // Fields kept in the banner, per form ("tracking" field); the others stay only in the page.
  // Presentation: agreed on 20/10 (no locations); area and level are sent hidden, as in the course pages.
  bannerFields: {
    download: ['email', 'nome', 'cognome', 'sms', 'finalita', 'validation'],
  } as Record<string, string[]>,
}
