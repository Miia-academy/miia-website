/**
 * Profilo di interesse di chi visita il sito.
 *
 * Due livelli, come deciso il 19/10/2026:
 * - il dettaglio (pagine, visite, moduli) resta nel browser, in localStorage;
 * - un riassunto di poche voci va nel cookie `miia_profilo`, scritto dal server
 *   (Safari cancella dopo 7 giorni i cookie scritti dagli script) e letto dai banner.
 *
 * Qui ci sono solo funzioni pure, usate sia dal browser sia dal server.
 */
import { AREE, MODULI, PAGINE_ESCLUSE, PESI_PAGINE, PUNTI_ALTRO_MODULO, TRACKING } from '@config/tracking'

export const COOKIE_PROFILO = 'miia_profilo'

export type Fascia = 'freddo' | 'tiepido' | 'caldo'

export interface PaginaVista {
  viste: number
  lette: number
  ultima: string
}

export interface Dettaglio {
  versione: 1
  visite: { numero: number; prima: string; ultima: string; attivita: number }
  pagine: Record<string, PaginaVista>
  // Moduli inviati: codice (vedi MODULI) e data dell'ultimo invio.
  moduli: Record<string, string>
  // Punti dei moduli, sommati a ogni invio.
  puntiModuli: number
  // Data dell'open day a cui la persona si è iscritta.
  openDay?: string
}

/** Il riassunto che finisce nel cookie. Nomi brevi per stare sotto 1 KB. */
export interface Riassunto {
  c: 0 | 1 // è un contatto (ha inviato almeno un modulo)
  m: string // moduli inviati: "b:2026-10-05,o:2026-10-12"
  od?: string // data dell'open day a cui è iscritto
  p: number // punteggio
  fx: Fascia
  a?: string // area prevalente
  t?: string // fino a 2 temi principali (arrivano con i blocchi Testo)
  v: number // numero di visite
  u: string // ultima visita
}

export const oggi = (now = new Date()) => now.toISOString().slice(0, 10)

export function nuovoDettaglio(now = new Date()): Dettaglio {
  return {
    versione: 1,
    visite: { numero: 0, prima: oggi(now), ultima: oggi(now), attivita: 0 },
    pagine: {},
    moduli: {},
    puntiModuli: 0,
  }
}

/** Indirizzo pulito: senza parametri, senza barra finale, minuscolo. */
export function percorso(path: string): string {
  const clean = (path.split(/[?#]/)[0] || '/').toLowerCase().replace(/\/+$/, '')
  return clean || '/'
}

export function paginaEsclusa(path: string): boolean {
  const p = percorso(path)
  return PAGINE_ESCLUSE.some((prefix) => p === prefix || p.startsWith(prefix + '/'))
}

export function pesoPagina(path: string): number {
  const p = percorso(path) + '/'
  return PESI_PAGINE.find(({ prefisso }) => p.startsWith(prefisso))?.peso ?? 1
}

export function areaPagina(path: string): string | undefined {
  const p = percorso(path)
  return Object.keys(AREE).find((area) => AREE[area].some((parola) => p.includes(parola)))
}

/**
 * Registra una pagina vista. Se è passata la pausa prevista dall'ultima
 * attività, conta anche una nuova visita.
 */
export function registraPagina(d: Dettaglio, path: string, now = new Date()): Dettaglio {
  const t = now.getTime()
  const pausa = TRACKING.pausaNuovaVisitaMinuti * 60 * 1000
  if (!d.visite.attivita || t - d.visite.attivita > pausa) {
    d.visite.numero += 1
    d.visite.ultima = oggi(now)
  }
  d.visite.attivita = t

  if (paginaEsclusa(path)) return d
  const p = percorso(path)
  const pagina = d.pagine[p] || { viste: 0, lette: 0, ultima: oggi(now) }
  pagina.viste += 1
  pagina.ultima = oggi(now)
  // Reinserita in fondo: l'ordine delle chiavi è anche l'ordine di recenza.
  delete d.pagine[p]
  d.pagine[p] = pagina

  const chiavi = Object.keys(d.pagine)
  for (const vecchia of chiavi.slice(0, Math.max(0, chiavi.length - TRACKING.maxPagine))) {
    delete d.pagine[vecchia]
  }
  return d
}

/** La pagina è rimasta visibile oltre la soglia di lettura. */
export function registraLettura(d: Dettaglio, path: string, now = new Date()): Dettaglio {
  const pagina = d.pagine[percorso(path)]
  if (!pagina) return d
  pagina.lette += 1
  d.visite.attivita = now.getTime()
  return d
}

/** Invio di un modulo, dal suo campo "tracking". */
export function registraModulo(
  d: Dettaglio,
  tracking: string | undefined,
  openDay?: string,
  now = new Date()
): Dettaglio {
  const regola = tracking ? MODULI[tracking] : undefined
  d.puntiModuli += regola?.punti ?? PUNTI_ALTRO_MODULO
  d.moduli[regola?.codice ?? 'x'] = oggi(now)
  if (openDay && /^\d{4}-\d{2}-\d{2}/.test(openDay)) d.openDay = openDay.slice(0, 10)
  return d
}

export function punteggio(d: Dettaglio): number {
  let punti = d.visite.numero * TRACKING.punti.nuovaVisita + d.puntiModuli
  for (const [path, pagina] of Object.entries(d.pagine)) {
    const peso = pesoPagina(path)
    punti += (pagina.viste * TRACKING.punti.paginaVista + pagina.lette * TRACKING.punti.paginaLetta) * peso
  }
  return punti
}

export function fascia(punti: number): Fascia {
  if (punti >= TRACKING.fasce.caldo) return 'caldo'
  if (punti >= TRACKING.fasce.tiepido) return 'tiepido'
  return 'freddo'
}

/** Area con più punti; nessuna se le pagine viste non ne indicano una. */
export function areaPrevalente(d: Dettaglio): string | undefined {
  const totali: Record<string, number> = {}
  for (const [path, pagina] of Object.entries(d.pagine)) {
    const area = areaPagina(path)
    if (!area) continue
    totali[area] = (totali[area] || 0) + pagina.viste + pagina.lette * 2
  }
  const ordinate = Object.entries(totali).sort((a, b) => b[1] - a[1])
  return ordinate[0]?.[0]
}

export function riassumi(d: Dettaglio): Riassunto {
  const p = punteggio(d)
  const r: Riassunto = {
    c: Object.keys(d.moduli).length > 0 ? 1 : 0,
    m: Object.entries(d.moduli)
      .map(([codice, data]) => `${codice}:${data}`)
      .join(','),
    p,
    fx: fascia(p),
    v: d.visite.numero,
    u: d.visite.ultima,
  }
  const a = areaPrevalente(d)
  if (a) r.a = a
  if (d.openDay) r.od = d.openDay
  return r
}

/**
 * Controlla un riassunto arrivato dal browser prima di scriverlo nel cookie:
 * solo voci note, valori brevi e nei limiti. Null se non è valido.
 */
export function pulisciRiassunto(raw: unknown): Riassunto | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const data = /^\d{4}-\d{2}-\d{2}$/
  const intero = (v: unknown, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null

  const p = intero(r.p, 100000)
  const v = intero(r.v, 100000)
  if (p === null || v === null || typeof r.u !== 'string' || !data.test(r.u)) return null

  const m =
    typeof r.m === 'string' && /^([a-z]:\d{4}-\d{2}-\d{2})?(,[a-z]:\d{4}-\d{2}-\d{2}){0,9}$/.test(r.m)
      ? r.m
      : ''
  const out: Riassunto = { c: r.c === 1 ? 1 : 0, m, p, fx: fascia(p), v, u: r.u }
  if (typeof r.od === 'string' && data.test(r.od)) out.od = r.od
  if (typeof r.a === 'string' && r.a in AREE) out.a = r.a
  if (typeof r.t === 'string' && /^[a-z0-9-]{1,40}(,[a-z0-9-]{1,40})?$/.test(r.t)) out.t = r.t
  return out
}

export function scriviCookie(r: Riassunto): string {
  return encodeURIComponent(JSON.stringify(r))
}

export function leggiCookie(value: string | null | undefined): Riassunto | null {
  if (!value) return null
  try {
    return pulisciRiassunto(JSON.parse(decodeURIComponent(value)))
  } catch {
    return null
  }
}
