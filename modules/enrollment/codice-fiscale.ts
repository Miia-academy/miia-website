/**
 * Controllo del codice fiscale italiano: formato, carattere di controllo
 * e coerenza con la data di nascita. Non verifica che il codice esista
 * all'Agenzia delle Entrate.
 */

const MONTHS = 'ABCDEHLMPRST'
// Cifre sostituite da lettere nei codici "omocodici"
const OMOCODIA = 'LMNPQRSTUV'
const OMOCODIA_POSITIONS = [6, 7, 9, 10, 12, 13, 14]

const ODD: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}

const FORMAT = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/

export function normalizeCodiceFiscale(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s/g, '').toUpperCase() : ''
}

function evenValue(char: string): number {
  return /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65
}

export function checkCharacter(first15: string): string {
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const char = first15[i]
    // Le posizioni si contano da 1: l'indice 0 è "dispari"
    sum += i % 2 === 0 ? ODD[char] : evenValue(char)
  }
  return String.fromCharCode(65 + (sum % 26))
}

/** Riporta le lettere dell'omocodia alle cifre originali. */
function decodeOmocodia(cf: string): string {
  const chars = cf.split('')
  for (const pos of OMOCODIA_POSITIONS) {
    const idx = OMOCODIA.indexOf(chars[pos])
    if (idx >= 0) chars[pos] = String(idx)
  }
  return chars.join('')
}

export interface CodiceFiscaleBirth {
  /** Ultime due cifre dell'anno */
  yy: number
  month: number
  day: number
  sex: 'M' | 'F'
}

export function birthFromCodiceFiscale(cf: string): CodiceFiscaleBirth {
  const plain = decodeOmocodia(cf)
  const rawDay = Number(plain.slice(9, 11))
  return {
    yy: Number(plain.slice(6, 8)),
    month: MONTHS.indexOf(plain[8]) + 1,
    day: rawDay > 40 ? rawDay - 40 : rawDay,
    sex: rawDay > 40 ? 'F' : 'M',
  }
}

/**
 * Restituisce il messaggio di errore da mostrare, oppure null se va bene.
 * birthDate (AAAA-MM-GG) è facoltativa: se c'è, deve coincidere col codice.
 */
export function codiceFiscaleError(value: unknown, birthDate?: string): string | null {
  const cf = normalizeCodiceFiscale(value)
  if (!cf) return 'Il codice fiscale è obbligatorio'
  if (cf.length !== 16 || !FORMAT.test(cf)) return 'Il codice fiscale non ha un formato valido'
  if (checkCharacter(cf.slice(0, 15)) !== cf[15]) return 'Il codice fiscale non è corretto: controlla di averlo scritto bene'

  const birth = birthFromCodiceFiscale(cf)
  if (birth.day < 1 || birth.day > 31) return 'Il codice fiscale non ha un formato valido'

  if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    const [year, month, day] = birthDate.split('-').map(Number)
    if (year % 100 !== birth.yy || month !== birth.month || day !== birth.day) {
      return 'Il codice fiscale non corrisponde alla data di nascita'
    }
  }
  return null
}
