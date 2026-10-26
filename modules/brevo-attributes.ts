/**
 * Brevo contact attributes of type "category" (single choice): Brevo stores the
 * option id, not its label, so the site sends the numbers below.
 * Names and options: sheet "2026-10-26_Dizionario_attributi_Brevo" (Automazioni).
 *
 * The ids of the new categories follow the order of the options in the sheet,
 * as Brevo numbers them when they are created in that order. `npm run forms:check`
 * compares every id here with the labels in Brevo (see checkCategoryIds).
 */

export const CATEGORY_IDS = {
  // Already in Brevo with area and level ("interni - primo livello"): only the labels change
  INTERESSE_CORSO: { interior_primo: 1, interior_secondo: 2, fashion_primo: 3, fashion_secondo: 4 },
  ISCRIZIONE_STATO: { bozza: 1, firmata: 2, recesso: 3, definitiva: 4, annullata: 5 },
  ISCRIZIONE_SCOPO: { aggiornare_competenze: 1, cambiare_ruolo: 2, cambiare_settore: 3, professione: 4, curiosita: 5 },
  ISCRIZIONE_PAGAMENTO_MODALITA: { unica: 1, '5_rate': 2, '10_rate': 3 },
} as const satisfies Record<string, Record<string, number>>

export type CategoryAttribute = keyof typeof CATEGORY_IDS

export function isCategoryAttribute(name: string): name is CategoryAttribute {
  return Object.prototype.hasOwnProperty.call(CATEGORY_IDS, name)
}

/** Option id of a category value, or null if the value is not one of its options. */
export function categoryId(name: CategoryAttribute, value: unknown): number | null {
  const options = CATEGORY_IDS[name] as Record<string, number>
  const key = String(Array.isArray(value) ? value[0] ?? '' : value ?? '')
    .trim()
    .toLowerCase()
  return Object.prototype.hasOwnProperty.call(options, key) ? options[key] : null
}

/**
 * Course of interest (area and level) as INTERESSE_CORSO writes it: from the new
 * code (interior_primo), from the old labels ("interni - primo livello") or from
 * area + level ("moda", "secondo").
 */
export function interestCourse(value: unknown, level?: unknown): string | null {
  const text = [value, level]
    .map((v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')))
    .join(' ')
    .toLowerCase()
  const area = /interni|interior/.test(text) ? 'interior' : /moda|fashion/.test(text) ? 'fashion' : null
  const grade = /secondo/.test(text) ? 'secondo' : /primo/.test(text) ? 'primo' : null
  return area && grade ? `${area}_${grade}` : null
}

/** INTERESSE_SCOPO from the enrollment purpose (the brochure and open day forms use the same options). */
export const INTEREST_PURPOSE: Record<string, string> = {
  aggiornare_competenze: 'aggiornamento',
  cambiare_ruolo: 'lavoro',
  cambiare_settore: 'lavoro',
  professione: 'lavoro',
  curiosita: 'interesse',
}
