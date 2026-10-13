/**
 * Chiave segreta per firmare e verificare le sessioni (JWT).
 *
 * Non esiste un valore di riserva: se JWT_SECRET manca, chi la richiede
 * riceve un errore. Il controllo avviene al momento dell'uso e non
 * all'importazione, così le pagine pubbliche e la build non dipendono dalla
 * variabile, mentre login e aree riservate non funzionano senza.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (!secret) {
    console.error(
      '[AUTH] JWT_SECRET non impostata: le sessioni non possono essere firmate né verificate.'
    )
    throw new Error('Configurazione di sicurezza mancante (JWT_SECRET).')
  }

  return secret
}
