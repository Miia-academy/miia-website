/**
 * Lettura e registrazione del consenso cookie gestito da Iubenda.
 *
 * Iubenda viene caricato da Google Tag Manager e salva le scelte nel cookie
 * `_iub_cs-<cookiePolicyId>` (JSON con `purposes`). Le finalità sono:
 * 1 necessari, 2 funzionalità, 3 esperienza, 4 misurazione, 5 marketing.
 * GTM legge lo stesso cookie per Consent Mode, quindi qui seguiamo la stessa fonte.
 */

export const IUBENDA_COOKIE_POLICY_ID =
  process.env.NEXT_PUBLIC_IUBENDA_COOKIE_POLICY_ID || '11910416'

export const COOKIE_POLICY_URL = `https://www.iubenda.com/privacy-policy/${IUBENDA_COOKIE_POLICY_ID}/cookie-policy`

export const PURPOSE = {
  functionality: 2,
  experience: 3,
  measurement: 4,
  marketing: 5,
} as const

declare global {
  interface Window {
    _iub?: any
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const entry = document.cookie.split('; ').find((c) => c.startsWith(prefix))
  return entry ? entry.slice(prefix.length) : null
}

/** Finalità accettate, come le ha registrate Iubenda. Vuoto se nessuna scelta. */
export function getConsentPurposes(): Record<string, boolean> {
  const raw = readCookie(`_iub_cs-${IUBENDA_COOKIE_POLICY_ID}`)
  if (!raw) return {}
  try {
    const value = JSON.parse(decodeURIComponent(raw))
    if (value?.consent === true) {
      return { '1': true, '2': true, '3': true, '4': true, '5': true }
    }
    return value?.purposes && typeof value.purposes === 'object' ? value.purposes : {}
  } catch {
    return {}
  }
}

export function hasConsent(purpose: number): boolean {
  return getConsentPurposes()[String(purpose)] === true
}

/** La casella nei moduli serve solo se misurazione o marketing non sono già accettati. */
export function needsCookieConsent(): boolean {
  return !hasConsent(PURPOSE.measurement) || !hasConsent(PURPOSE.marketing)
}

/**
 * Registra in Iubenda l'accettazione di tutti i cookie facoltativi, come il
 * pulsante "Accetta" del banner. Iubenda salva la prova del consenso e GTM
 * aggiorna Consent Mode con i propri attivatori.
 * Restituisce false se Iubenda non è ancora caricato.
 */
export function acceptAllCookies(): boolean {
  const api = typeof window !== 'undefined' ? window._iub?.cs?.api : undefined
  if (!api) return false
  if (typeof api.acceptAll === 'function') {
    api.acceptAll()
    return true
  }
  if (typeof api.consentGiven === 'function') {
    api.consentGiven()
    return true
  }
  return false
}
