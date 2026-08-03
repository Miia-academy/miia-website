/**
 * Pulisce l'oggetto rimuovendo i tag _editable di Storyblok,
 * i valori nulli e le chiavi indefinite per ridurre il peso del JSON in Next.js.
 */
export function optimizePayload(data: any): any {
  // Se è un array, mappa ogni elemento pulendolo
  if (Array.isArray(data)) {
    return data.map(optimizePayload)
  }

  // Se è un oggetto, itera sulle chiavi
  if (data !== null && typeof data === 'object') {
    const cleaned: any = {}

    for (const key in data) {
      // Skippiamo proprietà inutili o pesanti
      if (
        key === '_editable' ||
        data[key] === null ||
        data[key] === undefined ||
        data[key] === '' // Opzionale: rimuove anche le stringhe vuote
      ) {
        continue
      }

      // Pulizia ricorsiva per gli oggetti nidificati
      cleaned[key] = optimizePayload(data[key])
    }
    return cleaned
  }

  // Ritorna i tipi primitivi (stringhe, numeri, booleani) così come sono
  return data
}