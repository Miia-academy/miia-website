/**
 * Testi delle condizioni (passo 5), dalla storia Storyblok "iscrizione/condizioni".
 * Campi di testo semplice, paragrafi separati da una riga vuota, così lo stesso
 * testo va nella pagina e nel PDF. Senza la storia il passo 5 non si completa.
 *
 * L'impronta (SHA-256 dei testi) si salva con i consensi: alla firma si controlla
 * che il testo non sia cambiato dopo l'accettazione, anche se la versione è la stessa.
 */
import { createHash } from 'node:crypto'
import { cdn } from './catalog'

export const CONDITIONS_SLUG = 'iscrizione/condizioni'

export interface Conditions {
  versione: string
  /** Punti chiave del contratto in parole semplici, uno per riga. */
  contratto_punti: string[]
  /** Condizioni generali complete (art. a–n). */
  contratto_testo: string
  /** Clausole da approvare a parte (artt. 1341–1342 c.c.), es. "e) ritardo nei pagamenti, …". */
  clausole_1341: string
  recesso_testo: string
  privacy_testo: string
  impronta: string
  /** Facoltativi, solo informativi (fuori dall'impronta): passo 6 e email. */
  dopo_la_firma: string[]
  come_pagare: string
}

const field = (content: Record<string, unknown>, key: string) =>
  typeof content[key] === 'string' ? (content[key] as string).replace(/\r\n/g, '\n').trim() : ''

/** Null se manca un testo obbligatorio: meglio non far firmare che far firmare un testo incompleto. */
export function parseConditions(content: Record<string, unknown> | null | undefined): Conditions | null {
  if (!content) return null
  const value = {
    versione: field(content, 'versione'),
    contratto_punti: field(content, 'contratto_punti')
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean),
    contratto_testo: field(content, 'contratto_testo'),
    clausole_1341: field(content, 'clausole_1341'),
    recesso_testo: field(content, 'recesso_testo'),
    privacy_testo: field(content, 'privacy_testo'),
  }
  if (!value.versione || !value.contratto_testo || !value.clausole_1341 || !value.recesso_testo || !value.privacy_testo) {
    return null
  }
  const impronta = createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)
  const lines = (key: string) =>
    field(content, key)
      .split('\n')
      .map((l) => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
  return { ...value, impronta, dopo_la_firma: lines('dopo_la_firma'), come_pagare: field(content, 'come_pagare') }
}

export async function getConditions(): Promise<Conditions | null> {
  try {
    const data = await cdn<{ story?: { content?: Record<string, unknown> } }>(`stories/${CONDITIONS_SLUG}`, {})
    return parseConditions(data.story?.content)
  } catch (error) {
    console.error('[Iscrizione] Condizioni non disponibili da Storyblok:', error)
    return null
  }
}
