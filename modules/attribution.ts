/**
 * Provenienza della visita (UTM, click id, pagina di arrivo, sito di provenienza).
 *
 * Gli UTM sono nell'indirizzo solo della prima pagina: li salviamo all'arrivo e
 * li leggiamo quando viene inviato un modulo, anche dopo alcune pagine.
 *
 * - Senza consenso alla misurazione: solo `sessionStorage`, cioè la visita in
 *   corso. I dati restano nel browser e partono solo con l'invio di un modulo.
 * - Con il consenso: anche un cookie di prima parte da 90 giorni, per ricordare
 *   la prima provenienza a chi torna più tardi. Se il consenso arriva durante la
 *   visita, quanto già salvato nella sessione viene copiato nel cookie.
 *
 * `first` è la prima provenienza nota e non viene più sovrascritta.
 * `last` è l'ultima provenienza con una campagna (o la prima della visita):
 * una visita senza UTM non sovrascrive quanto già salvato.
 */
import { hasConsent, PURPOSE, readCookie } from '@modules/consent'

export interface Touch {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  click_id?: string
  landing?: string
  date?: string
}

export interface Attribution {
  first?: Touch
  last?: Touch
}

const STORAGE_KEY = 'miia_src'
const COOKIE_NAME = 'miia_src'
const COOKIE_DAYS = 90
const MAX_LENGTH = 150

const UTM_KEYS: Array<[keyof Touch, string]> = [
  ['source', 'utm_source'],
  ['medium', 'utm_medium'],
  ['campaign', 'utm_campaign'],
  ['content', 'utm_content'],
  ['term', 'utm_term'],
]

const CLICK_IDS: Array<[string, string, string]> = [
  // parametro, sorgente e mezzo usati se mancano gli UTM
  ['gclid', 'google', 'cpc'],
  ['gbraid', 'google', 'cpc'],
  ['wbraid', 'google', 'cpc'],
  ['fbclid', 'meta', 'paid_social'],
]

const SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|duckduckgo|ecosia|yandex|baidu)\./i
const SOCIAL = /(^|\.)(facebook|instagram|linkedin|tiktok|pinterest|youtube)\.com$|^t\.co$/i

const clean = (value: string | null | undefined) => {
  const text = (value || '').trim()
  return text ? text.slice(0, MAX_LENGTH) : undefined
}

function touchFromLocation(): { touch: Touch; hasCampaign: boolean } {
  const url = new URL(window.location.href)
  const params = url.searchParams
  const touch: Touch = {
    landing: clean(url.pathname),
    date: new Date().toISOString(),
  }

  for (const [key, param] of UTM_KEYS) {
    const value = clean(params.get(param))
    if (value) touch[key] = value
  }

  let hasCampaign = !!touch.source || !!touch.campaign
  for (const [param, source, medium] of CLICK_IDS) {
    const value = clean(params.get(param))
    if (!value) continue
    touch.click_id = `${param}:${value}`
    touch.source = touch.source || source
    touch.medium = touch.medium || medium
    hasCampaign = true
    break
  }

  if (!touch.source) {
    // Senza UTM: solo il nome del sito di provenienza, mai l'indirizzo completo.
    let host = ''
    try {
      host = document.referrer ? new URL(document.referrer).hostname : ''
    } catch {
      host = ''
    }
    if (host && host !== window.location.hostname) {
      touch.source = clean(host.replace(/^www\./, ''))
      touch.medium = SEARCH_ENGINES.test(host) ? 'organic' : SOCIAL.test(host) ? 'social' : 'referral'
    } else {
      touch.source = '(direct)'
      touch.medium = '(none)'
    }
  }

  return { touch, hasCampaign }
}

function parse(raw: string | null): Attribution | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as Attribution) : null
  } catch {
    return null
  }
}

function readSession(): Attribution | null {
  try {
    return parse(window.sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function writeSession(value: Attribution) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // sessionStorage non disponibile (navigazione privata su alcuni browser)
  }
}

function readStoredCookie(): Attribution | null {
  const raw = readCookie(COOKIE_NAME)
  if (!raw) return null
  try {
    return parse(decodeURIComponent(raw))
  } catch {
    return null
  }
}

function writeCookie(value: Attribution) {
  const maxAge = COOKIE_DAYS * 24 * 60 * 60
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`
}

function deleteCookie() {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
}

const canUseCookie = () => hasConsent(PURPOSE.measurement)

/**
 * Da chiamare a ogni pagina vista (primo caricamento e cambio pagina).
 * Salva la provenienza della visita e, se c'è il consenso, la porta nel cookie.
 */
export function captureAttribution() {
  if (typeof window === 'undefined') return

  const session = readSession()
  const { touch, hasCampaign } = touchFromLocation()

  let current: Attribution = session || {}
  if (!session) {
    current = { first: touch, last: touch }
  } else if (hasCampaign) {
    current = { first: session.first || touch, last: touch }
  }
  writeSession(current)

  syncCookie(current, hasCampaign || !session ? touch : undefined)
}

/** Allinea il cookie da 90 giorni al consenso attuale. */
function syncCookie(session: Attribution, newTouch?: Touch) {
  if (!canUseCookie()) {
    // Consenso revocato: il cookie non deve restare.
    if (readCookie(COOKIE_NAME)) deleteCookie()
    return
  }

  const stored = readStoredCookie()
  const first = stored?.first || session.first
  let last = stored?.last || session.last
  // Una visita senza campagna non sovrascrive l'ultima campagna salvata.
  if (newTouch && (newTouch.campaign || newTouch.click_id || !stored?.last)) {
    last = newTouch
  } else if (session.last?.campaign || session.last?.click_id) {
    last = session.last
  }
  writeCookie({ first, last })
}

/** Da chiamare quando il consenso potrebbe essere cambiato (banner o modulo). */
export function refreshAttributionStorage() {
  if (typeof window === 'undefined') return
  const session = readSession()
  if (session) syncCookie(session)
}

/** La provenienza da inviare con il modulo: il cookie se c'è, altrimenti la sessione. */
export function getAttribution(): Attribution {
  if (typeof window === 'undefined') return {}
  const session = readSession() || {}
  const stored = canUseCookie() ? readStoredCookie() : null
  return {
    first: stored?.first || session.first,
    last: session.last?.campaign || session.last?.click_id ? session.last : stored?.last || session.last,
  }
}
