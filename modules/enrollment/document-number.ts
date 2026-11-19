/**
 * Numero del documento d'identità: formato atteso per tipo e paese di rilascio.
 * Usato sia nel browser (campo a caselle che accetta solo caratteri al posto
 * giusto) sia sul server (controllo al salvataggio).
 */

export const DOCUMENT_TYPES = ['carta_identita_elettronica', 'carta_identita', 'passaporto'] as const
export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export interface DocumentFormat {
  /** Lunghezza fissa del numero: una casella per carattere. */
  lunghezza: number
  /** Gruppi in ordine: "L" lettere, "N" cifre, con quanti caratteri. */
  gruppi: { tipo: 'L' | 'N'; n: number }[]
  esempio: string
  descrizione: string
}

const ITALIAN: Record<DocumentType, DocumentFormat> = {
  carta_identita_elettronica: {
    lunghezza: 9,
    gruppi: [{ tipo: 'L', n: 2 }, { tipo: 'N', n: 5 }, { tipo: 'L', n: 2 }],
    esempio: 'CA12345AB',
    descrizione: '2 lettere, 5 cifre, 2 lettere',
  },
  carta_identita: {
    lunghezza: 9,
    gruppi: [{ tipo: 'L', n: 2 }, { tipo: 'N', n: 7 }],
    esempio: 'AA1234567',
    descrizione: '2 lettere e 7 cifre',
  },
  passaporto: {
    lunghezza: 9,
    gruppi: [{ tipo: 'L', n: 2 }, { tipo: 'N', n: 7 }],
    esempio: 'YA1234567',
    descrizione: '2 lettere e 7 cifre',
  },
}

/** La carta cartacea è solo italiana; carta elettronica (UE) e passaporto possono essere esteri. */
export const canBeForeign = (tipo: string) => tipo === 'carta_identita_elettronica' || tipo === 'passaporto'

export const isDocumentType = (tipo: string): tipo is DocumentType => (DOCUMENT_TYPES as readonly string[]).includes(tipo)

/** Formato fisso dei documenti italiani; null per i documenti esteri, che hanno formati diversi da paese a paese. */
export function documentFormat(tipo: string, estero: boolean): DocumentFormat | null {
  if (!isDocumentType(tipo) || (estero && canBeForeign(tipo))) return null
  return ITALIAN[tipo]
}

export const normalizeDocumentNumber = (value: unknown) =>
  typeof value === 'string' ? value.toUpperCase().replace(/[\s.-]/g, '').slice(0, 20) : ''

const groupClass = (tipo: 'L' | 'N') => (tipo === 'L' ? '[A-Za-z]' : '[0-9]')

/**
 * Espressione che accetta un numero scritto in parte: ogni carattere solo se è
 * del tipo giusto per la sua posizione (per il campo a caselle).
 */
export function partialPattern(format: DocumentFormat): string {
  const options: string[] = []
  let done = ''
  for (const g of format.gruppi) {
    options.push(`${done}${groupClass(g.tipo)}{0,${g.n}}`)
    done += `${groupClass(g.tipo)}{${g.n}}`
  }
  return `^(${options.join('|')})$`
}

export function documentNumberError(tipo: string, numero: string, estero: boolean): string | null {
  if (!numero) return 'Scrivi il numero del documento'
  const format = documentFormat(tipo, estero)
  if (!format) {
    return /^[A-Z0-9]{5,12}$/.test(numero) ? null : 'Scrivi solo lettere e cifre, come sul documento'
  }
  const full = new RegExp(`^${format.gruppi.map((g) => `${groupClass(g.tipo)}{${g.n}}`).join('')}$`)
  if (!full.test(numero)) {
    return `Il numero ha ${format.descrizione}, per esempio ${format.esempio}`
  }
  return null
}
