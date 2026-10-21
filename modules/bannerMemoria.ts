/**
 * Memoria dei banner in questo browser: quando un banner è stato chiuso o usato
 * (clic o modulo inviato) e quali sono già comparsi in questa visita.
 *
 * Serve solo a non ripresentare lo stesso banner: nessun dato della persona,
 * per questo vale anche senza consenso marketing. Se la memoria del browser è
 * bloccata i banner funzionano lo stesso, senza ricordare nulla.
 */
import type { Memoria } from '@modules/banner'

const MEMORIA_KEY = 'miia_banner'
const VISITA_KEY = 'miia_banner_visita'
const FORZA_KEY = 'miia_banner_forza'

export const EVENTO_FORZA = 'miia-banner-forza'

type Salvata = Pick<Memoria, 'chiusi' | 'usati'>

function leggiSalvata(): Salvata {
  try {
    const d = JSON.parse(window.localStorage.getItem(MEMORIA_KEY) || '{}')
    return { chiusi: d.chiusi || {}, usati: d.usati || {} }
  } catch {
    return { chiusi: {}, usati: {} }
  }
}

function scriviSalvata(m: Salvata) {
  try {
    window.localStorage.setItem(MEMORIA_KEY, JSON.stringify(m))
  } catch {
    // memoria bloccata: il banner potrà ricomparire
  }
}

export function leggiMemoria(): Memoria {
  let vistiInVisita: string[] = []
  try {
    vistiInVisita = JSON.parse(window.sessionStorage.getItem(VISITA_KEY) || '[]')
  } catch {
    vistiInVisita = []
  }
  return { ...leggiSalvata(), vistiInVisita }
}

export function segnaVisto(uuid: string) {
  try {
    const visti = leggiMemoria().vistiInVisita
    if (!visti.includes(uuid)) window.sessionStorage.setItem(VISITA_KEY, JSON.stringify([...visti, uuid]))
  } catch {
    // niente
  }
}

export function segnaChiuso(uuid: string) {
  const m = leggiSalvata()
  m.chiusi[uuid] = new Date().toISOString()
  scriviSalvata(m)
}

export function segnaUsato(uuid: string) {
  const m = leggiSalvata()
  m.usati[uuid] = new Date().toISOString()
  scriviSalvata(m)
}

export function azzeraMemoria() {
  try {
    window.localStorage.removeItem(MEMORIA_KEY)
    window.sessionStorage.removeItem(VISITA_KEY)
  } catch {
    // niente
  }
}

/** Solo nelle anteprime: mostra subito un banner scelto, senza condizioni. */
export function forzaBanner(uuid: string | null) {
  try {
    if (uuid) window.sessionStorage.setItem(FORZA_KEY, uuid)
    else window.sessionStorage.removeItem(FORZA_KEY)
  } catch {
    // niente
  }
  window.dispatchEvent(new Event(EVENTO_FORZA))
}

export function bannerForzato(): string | null {
  try {
    return window.sessionStorage.getItem(FORZA_KEY)
  } catch {
    return null
  }
}
