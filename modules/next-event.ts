import type { Alias } from '@types'

/** Parti del prossimo evento che l'alias può mostrare. */
export const EVENT_PARTS = ['data', 'titolo', 'descrizione', 'docenti', 'agevolazione', 'pulsante', 'modulo'] as const
export type EventPart = (typeof EVENT_PARTS)[number]

/** Le due versioni del prossimo evento (campo "Versione" dell'alias in Storyblok). */
export type EventVersion = 'collegamento' | 'registrazione'

/**
 * Testo standard dell'agevolazione, quando il campo "Testo agevolazione" è vuoto.
 * L'agevolazione è il prezzo della soluzione unica, pagabile anche a rate, per chi partecipa.
 */
export const AGEVOLAZIONE_TESTO = "Ai partecipanti all'open day è riservata l'agevolazione sulla retta."

const VERSIONS: Record<EventVersion, Record<EventPart, boolean>> = {
  // Richiamo (home, corsi): data, titolo, testo breve e pulsante verso la pagina dell'evento
  collegamento: {
    data: true,
    titolo: true,
    descrizione: false,
    docenti: false,
    agevolazione: false,
    pulsante: true,
    modulo: false,
  },
  // Pagina dell'open day: data con la form, testo breve ed esteso, agevolazione (se l'evento
  // ha "Prezzo agevolato") e docenti. Form: "Iscrizione" dell'alias, altrimenti il "Form" dell'evento
  registrazione: {
    data: true,
    titolo: true,
    descrizione: true,
    docenti: true,
    agevolazione: true,
    pulsante: false,
    modulo: true,
  },
}

/**
 * Cosa mostrare, dal campo "Versione". Vuoto = come prima del campo: data, titolo e descrizione,
 * docenti solo con "Mostra persone"; con "Iscrizione" la form e l'agevolazione, senza il pulsante
 * verso la pagina.
 */
export function eventParts(
  blok: Pick<Alias, 'persone'> & { versione?: unknown; submit?: unknown }
): Record<EventPart, boolean> {
  const version = String(blok.versione || '') as EventVersion
  if (VERSIONS[version]) return { ...VERSIONS[version] }
  const hasSubmit = Array.isArray(blok.submit) && blok.submit.length > 0
  return {
    data: true,
    titolo: true,
    descrizione: true,
    docenti: !!blok.persone,
    agevolazione: hasSubmit,
    pulsante: !hasSubmit,
    modulo: false,
  }
}
