/**
 * Tracciamento dei comportamenti nel browser.
 *
 * Solo con il consenso marketing di Iubenda: senza, non si salva nulla e, se la
 * persona ha rifiutato, si cancella quanto salvato prima.
 * Il dettaglio resta in localStorage; il riassunto va al server (/api/profilo),
 * che lo restituisce come cookie `miia_profilo`. Brevo non viene toccato.
 */
import { TRACKING } from '@config/tracking'
import { getConsentPurposes, hasConsent, PURPOSE, readCookie } from '@modules/consent'
import {
  COOKIE_PROFILO,
  type Dettaglio,
  leggiCookie,
  nuovoDettaglio,
  registraLettura,
  registraModulo,
  registraPagina,
  riassumi,
  type Riassunto,
} from '@modules/profilo'

const STORAGE_KEY = 'miia_profilo_dettaglio'
const INVIATO_KEY = 'miia_profilo_inviato'
const SIMULA_KEY = 'miia_debug_consenso'
const DEBUG_KEY = 'miia_debug_profilo'

let lettura: { path: string; visibile: number; da: number | null; timer: number } | null = null

/**
 * Il riquadro ?debug=profilo resta aperto per tutta la visita, anche quando il
 * menu ricarica la pagina e il parametro sparisce. Si chiude con la ✕.
 */
export function debugProfiloAttivo(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('debug') === 'profilo') {
      window.sessionStorage.setItem(DEBUG_KEY, '1')
    }
    return window.sessionStorage.getItem(DEBUG_KEY) === '1'
  } catch {
    return false
  }
}

export function chiudiDebugProfilo() {
  try {
    window.sessionStorage.removeItem(DEBUG_KEY)
  } catch {
    // niente da chiudere
  }
}

/**
 * Anteprime Vercel e sviluppo locale: Iubenda lì non conserva il consenso,
 * quindi il riquadro ?debug=profilo permette di simularlo. Mai su miia.it.
 */
export function inAnteprima(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host.endsWith('.vercel.app')
}

export function consensoSimulato(): boolean {
  try {
    return inAnteprima() && window.localStorage.getItem(SIMULA_KEY) === '1'
  } catch {
    return false
  }
}

export function simulaConsenso(attivo: boolean) {
  if (!inAnteprima()) return
  try {
    if (attivo) window.localStorage.setItem(SIMULA_KEY, '1')
    else window.localStorage.removeItem(SIMULA_KEY)
  } catch {
    // memoria bloccata: niente simulazione
  }
}

function consentito(): boolean {
  if (hasConsent(PURPOSE.marketing) || consensoSimulato()) return true
  // Scelta fatta senza marketing: via anche quanto salvato prima.
  if (Object.keys(getConsentPurposes()).length > 0) cancellaProfilo()
  return false
}

export function leggiDettaglio(): Dettaglio | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const d = raw ? JSON.parse(raw) : null
    return d?.versione === 1 ? (d as Dettaglio) : null
  } catch {
    return null
  }
}

function salva(d: Dettaglio) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {
    // Memoria piena o bloccata: il tracciamento si ferma senza errori.
  }
}

/** Il riassunto salvato nel cookie, per i banner. Null se non c'è. */
export function leggiProfilo(): Riassunto | null {
  return leggiCookie(readCookie(COOKIE_PROFILO))
}

export function cancellaProfilo() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.removeItem(INVIATO_KEY)
  } catch {
    // niente da cancellare
  }
  if (readCookie(COOKIE_PROFILO)) document.cookie = `${COOKIE_PROFILO}=; Max-Age=0; Path=/`
}

/**
 * Manda il riassunto al server se è cambiato dall'ultimo invio.
 * `subito` usa fetch con keepalive (dopo un modulo); altrimenti sendBeacon (a fine visita).
 */
export function inviaRiassunto(subito = false) {
  if (typeof window === 'undefined' || !consentito()) return
  const d = leggiDettaglio()
  if (!d) return
  const body = JSON.stringify(riassumi(d))
  try {
    if (window.sessionStorage.getItem(INVIATO_KEY) === body) return
    window.sessionStorage.setItem(INVIATO_KEY, body)
  } catch {
    // senza sessionStorage si invia comunque
  }
  if (!subito && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon('/api/profilo', new Blob([body], { type: 'application/json' }))
    return
  }
  fetch('/api/profilo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {})
}

function fermaLettura() {
  if (lettura) window.clearInterval(lettura.timer)
  lettura = null
}

/** Conta solo il tempo in cui la pagina è visibile; alla soglia la segna come letta. */
function avviaLettura(path: string) {
  fermaLettura()
  const soglia = TRACKING.sogliaLetturaPaginaSecondi * 1000
  const stato = {
    path,
    visibile: 0,
    da: document.visibilityState === 'visible' ? Date.now() : null,
    timer: 0,
  }
  stato.timer = window.setInterval(() => {
    const now = Date.now()
    if (document.visibilityState === 'visible') {
      if (stato.da !== null) stato.visibile += now - stato.da
      stato.da = now
    } else {
      stato.da = null
    }
    if (stato.visibile < soglia) return
    fermaLettura()
    if (!consentito()) return
    const d = leggiDettaglio()
    if (d) salva(registraLettura(d, path))
  }, 1000)
  lettura = stato
}

/** Da chiamare all'apertura di ogni pagina. */
export function tracciaPagina(path = window.location.pathname) {
  if (typeof window === 'undefined') return
  if (!consentito()) {
    fermaLettura()
    return
  }
  salva(registraPagina(leggiDettaglio() || nuovoDettaglio(), path))
  avviaLettura(path)
}

/** Da chiamare dopo l'invio riuscito di un modulo. */
export function tracciaModulo(tracking?: string, openDay?: string) {
  if (typeof window === 'undefined' || !consentito()) return
  salva(registraModulo(leggiDettaglio() || nuovoDettaglio(), tracking, openDay))
  inviaRiassunto(true)
}
