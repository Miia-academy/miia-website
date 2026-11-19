/** Testo dei consensi, usato anche nel browser (niente dipendenze dal server). */

/** "- riga" diventa un elenco; il resto resta testo. */
export function descriptionLines(descrizione: string): { elenco: string[]; testo: string } {
  const lines = descrizione.split('\n').map((l) => l.trim()).filter(Boolean)
  const elenco = lines.filter((l) => /^[-•*]\s+/.test(l)).map((l) => l.replace(/^[-•*]\s+/, ''))
  const testo = lines.filter((l) => !/^[-•*]\s+/.test(l)).join('\n')
  return { elenco, testo }
}
