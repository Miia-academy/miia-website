/**
 * Come annullare l'iscrizione (recesso): la stessa indicazione nella pagina di
 * conferma, nell'email con il contratto e nel PDF.
 *
 * Tre modalità, tutte valide (decisione di Miia del 16/10): risposta all'email
 * o email a iscrizione@, PEC, raccomandata.
 */

/** Dati dell'accademia per PEC e raccomandata, gli stessi del footer delle email. */
export const ACADEMY = {
  ragione_sociale: 'Accademia del Made in Italy srl',
  indirizzo: 'Viale L. Cadorna 20, 31100 Treviso (TV)',
  partita_iva: '04182310260',
  pec: 'accademia@messaggipec.it',
  email: 'iscrizione@miia.it',
} as const

/** Frase da copiare: "Annullo la mia iscrizione al corso Interior design, primo livello di Treviso." */
export function withdrawalSentence(corso: string, sede: string): string {
  return sede ? `Annullo la mia iscrizione al corso ${corso} di ${sede}.` : `Annullo la mia iscrizione al corso ${corso}.`
}

/** Canali ammessi, in una riga. */
export const WITHDRAWAL_CHANNELS =
  `rispondi all'email di conferma o scrivi a ${ACADEMY.email}; in alternativa puoi usare la PEC ` +
  `(${ACADEMY.pec}) o una raccomandata a ${ACADEMY.ragione_sociale}, ${ACADEMY.indirizzo}`

/**
 * Numero del contratto leggibile, uguale in PDF, email e pagina:
 * "2026-1A2B3C4D" (anno della firma e prime 8 cifre dell'id dell'iscrizione).
 */
export function contractNumber(id: string, signedAt: Date | string): string {
  const year = new Date(signedAt).getFullYear()
  return `${year}-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}
