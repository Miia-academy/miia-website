import type { Alias } from '@types'

/** Parti del prossimo evento che l'alias può mostrare (campo "Mostra" in Storyblok). */
export const EVENT_PARTS = ['data', 'titolo', 'descrizione', 'docenti', 'agevolazione'] as const
export type EventPart = (typeof EVENT_PARTS)[number]

/**
 * Testo standard del riquadro agevolazione, quando il campo "Testo agevolazione" è vuoto.
 * L'agevolazione è il prezzo della soluzione unica, pagabile anche a rate, per chi partecipa.
 */
export const AGEVOLAZIONE_TESTO =
  "**Riservato a chi partecipa**\n\nSe ti colleghi all'open day, hai il prezzo della soluzione unica anche pagando a rate."

/**
 * Cosa mostrare. Campo "Mostra" vuoto = come prima del campo: data, titolo e descrizione,
 * docenti solo con "Mostra persone". Il riquadro agevolazione si sceglie solo dal campo
 * (e compare solo se l'evento ha "Prezzo agevolato").
 */
export function eventParts(blok: Pick<Alias, 'persone'> & { mostra?: unknown }): Record<EventPart, boolean> {
  const chosen = Array.isArray(blok.mostra)
    ? blok.mostra.filter((p): p is EventPart => (EVENT_PARTS as readonly string[]).includes(String(p)))
    : []
  if (!chosen.length) {
    return { data: true, titolo: true, descrizione: true, docenti: !!blok.persone, agevolazione: false }
  }
  return Object.fromEntries(EVENT_PARTS.map((p) => [p, chosen.includes(p)])) as Record<EventPart, boolean>
}
