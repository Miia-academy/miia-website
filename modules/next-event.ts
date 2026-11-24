import type { Alias } from '@types'

/** Parti del prossimo evento che l'alias può mostrare (campo "Mostra" in Storyblok). */
export const EVENT_PARTS = ['data', 'titolo', 'descrizione', 'docenti', 'agevolazione', 'pulsante', 'modulo'] as const
export type EventPart = (typeof EVENT_PARTS)[number]

/**
 * Testo standard del riquadro agevolazione, quando il campo "Testo agevolazione" è vuoto.
 * L'agevolazione è il prezzo della soluzione unica, pagabile anche a rate, per chi partecipa.
 */
export const AGEVOLAZIONE_TESTO = "Ai partecipanti all'open day è riservata l'agevolazione sulla retta."

/**
 * Cosa mostrare. Campo "Mostra" vuoto = come prima del campo: data, titolo e descrizione,
 * docenti solo con "Mostra persone", pulsante verso la pagina se l'alias non ha "Iscrizione".
 * L'agevolazione compare solo nella versione con iscrizione e se l'evento ha "Prezzo agevolato"
 * (con "Mostra" vuoto vale quando l'alias ha "Iscrizione"). "Pulsante" = link alla pagina dell'evento; "Modulo" = il modulo
 * scelto nel campo "Form" dell'evento, usato quando l'alias non ha una sua "Iscrizione".
 */
export function eventParts(
  blok: Pick<Alias, 'persone'> & { mostra?: unknown; submit?: unknown }
): Record<EventPart, boolean> {
  const chosen = Array.isArray(blok.mostra)
    ? blok.mostra.filter((p): p is EventPart => (EVENT_PARTS as readonly string[]).includes(String(p)))
    : []
  if (!chosen.length) {
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
  return Object.fromEntries(EVENT_PARTS.map((p) => [p, chosen.includes(p)])) as Record<EventPart, boolean>
}
