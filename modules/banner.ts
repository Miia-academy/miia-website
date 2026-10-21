/**
 * Banner del sito: quale mostrare, a chi e con quali testi.
 *
 * Solo funzioni pure, così si provano nei test. Il componente
 * `components/banners/bannerSito.tsx` le usa nel browser.
 * Regole decise con Miia il 19, 20 e 21/10/2026
 * (funnel/sito/2026-10-19_Banner_dinamico_proposta.md, 2026-10-21_Banner_dove_nelle_pagine.html).
 */
import { BANNER, MODULI } from '@config/tracking'
import {
  areaPagina,
  areaPrevalente,
  fascia,
  percorso,
  punteggio,
  type Dettaglio,
  type Riassunto,
} from '@modules/profilo'

export type ModoBanner = 'finestra' | 'pannello' | 'sezione' | 'avviso'

/** Il blocco "banner" di Storyblok. */
export interface BannerContent {
  nome?: string
  titolo?: string
  testo?: string
  immagine?: { filename?: string; alt?: string; focus?: string }
  azione?: Array<{ label?: string; link?: { cached_url?: string; url?: string; linktype?: string } }>
  modulo?: any
  chiudi_testo?: string
  modo?: ModoBanner
  colore?: 'chiaro' | 'scuro' | 'verde'
  comparsa?: 'subito' | 'secondi' | 'scroll'
  comparsa_valore?: string | number
  pubblico?: string[]
  non_visitato?: string
  momento?: string[]
  pubblica_dal?: string
  pubblica_al?: string
  pausa_giorni?: string | number
  nascondi_dopo_azione?: boolean
  una_volta_per_visita?: boolean
}

export interface BannerStory {
  uuid: string
  slug: string
  content: BannerContent
}

/** Banner letti da Storyblok per il sito: tutti, e l'ordine di "Banner di tutto il sito". */
export interface BannerDati {
  tutti: BannerStory[]
  ordine: string[]
  escludi: string
}

/** Quello che il sito sa della persona, ricavato dal profilo nel browser o dal cookie. */
export interface Persona {
  visite: number
  contatto: boolean
  moduli: string[]
  openDay?: string
  fascia: 'freddo' | 'tiepido' | 'caldo'
  area?: string
  temi: string[]
  pagine: Record<string, number>
}

/** Date e dati del sito che servono a Momento e variabili. */
export interface Calendario {
  openDay: Array<{ data: string; area?: string; docenti?: string }>
  corsi: Array<{ inizio: string; area?: string; posti?: number }>
}

/** Memoria dei banner in questo browser: chiusi, usati, già visti in questa visita. */
export interface Memoria {
  chiusi: Record<string, string>
  usati: Record<string, string>
  vistiInVisita: string[]
}

export interface Contesto {
  path: string
  now: Date
  consenso: boolean
  persona: Persona | null
  calendario: Calendario
  memoria: Memoria
  /** Banner scelti nella pagina (campo "Banner"), prima di quelli di tutto il sito. */
  diPagina?: string[]
}

const GIORNO = 86400000

const codiceModulo = (tracking: string) => MODULI[tracking]?.codice

export function personaDaDettaglio(d: Dettaglio): Persona {
  const pagine: Record<string, number> = {}
  for (const [path, p] of Object.entries(d.pagine)) pagine[path] = p.viste
  const moduli = Object.keys(d.moduli)
  return {
    visite: d.visite.numero,
    contatto: moduli.length > 0,
    moduli,
    openDay: d.openDay,
    fascia: fascia(punteggio(d)),
    area: areaPrevalente(d),
    temi: [],
    pagine,
  }
}

export function personaDaRiassunto(r: Riassunto): Persona {
  return {
    visite: r.v,
    contatto: r.c === 1,
    moduli: r.m ? r.m.split(',').map((voce) => voce.split(':')[0]) : [],
    openDay: r.od,
    fascia: r.fx,
    area: r.a,
    temi: r.t ? r.t.split(',') : [],
    pagine: {},
  }
}

/** Una pagina corrisponde a una regola: "/" solo la home, "/blog/" quello che c'è dentro, "/lavoro" anche le sottopagine. */
export function corrisponde(path: string, regola: string): boolean {
  const p = percorso(path)
  const r = regola.trim().toLowerCase()
  if (!r) return false
  if (r === '/') return p === '/'
  if (r.endsWith('/')) return (p + '/').startsWith(r) && p + '/' !== r
  return p === r || p.startsWith(r + '/')
}

export function paginaSenzaBanner(path: string, escludi = ''): boolean {
  const regole = [...BANNER.pagineEscluse, ...escludi.split(',')]
  return regole.some((r) => corrisponde(path, r))
}

/** Indirizzo del pulsante del banner, pulito, oppure null. */
export function linkBanner(b: BannerContent): string | null {
  const link = b.azione?.[0]?.link
  const url = link?.cached_url || link?.url
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return '/' + url.replace(/^\/+/, '')
}

/** Area del banner, dal Pubblico (interni / moda). */
function areaBanner(b: BannerContent): string | undefined {
  return (b.pubblico || []).find((v) => v === 'interni' || v === 'moda')
}

function giorniA(data: string, now: Date): number {
  const giorno = new Date(data.slice(0, 10) + 'T00:00:00')
  const oggi = new Date(now.toISOString().slice(0, 10) + 'T00:00:00')
  return Math.round((giorno.getTime() - oggi.getTime()) / GIORNO)
}

export function prossimoOpenDay(cal: Calendario, now: Date, area?: string) {
  return cal.openDay
    .filter((o) => new Date(o.data).getTime() >= now.getTime() && (!area || o.area === area))
    .sort((a, b) => a.data.localeCompare(b.data))[0]
}

export function prossimiCorsi(cal: Calendario, now: Date, area?: string) {
  const futuri = cal.corsi
    .filter((c) => giorniA(c.inizio, now) >= 0 && (!area || c.area === area))
    .sort((a, b) => a.inizio.localeCompare(b.inizio))
  if (!futuri.length) return null
  const inizio = futuri[0].inizio.slice(0, 10)
  const stessi = futuri.filter((c) => c.inizio.slice(0, 10) === inizio)
  const posti = stessi.every((c) => typeof c.posti === 'number')
    ? stessi.reduce((tot, c) => tot + (c.posti as number), 0)
    : undefined
  return { inizio, posti }
}

/**
 * Una voce di Pubblico è vera per questa persona?
 * Le voci che il sito non può ancora sapere (dato da Brevo, temi) sono false.
 */
export function vocePubblico(voce: string, p: Persona, ctx: Pick<Contesto, 'path' | 'now'>): boolean {
  const iscrittoOpenDay = !!p.openDay && giorniA(p.openDay, ctx.now) >= 0
  switch (voce) {
    case 'prima-visita':
      return p.visite <= 1
    case 'tornato':
      return p.visite >= 2
    case 'pagina-rivista':
      return (p.pagine[percorso(ctx.path)] || 0) >= 2
    case 'contatto':
      return p.contatto
    case 'non-contatto':
      return !p.contatto
    case 'iscritto-open-day':
      return iscrittoOpenDay
    case 'non-iscritto-open-day':
      return !iscrittoOpenDay
    case 'presentazione':
      return p.moduli.includes(codiceModulo('download'))
    case 'non-presentazione':
      return !p.moduli.includes(codiceModulo('download'))
    case 'non-iscrizione':
      return !p.moduli.includes(codiceModulo('iscrizione'))
    case 'freddo':
    case 'tiepido':
    case 'caldo':
      return p.fascia === voce
    case 'interni':
    case 'moda':
      return p.area === voce
    case 'creativo':
    case 'tecnico':
      return p.temi.includes(voce)
    // 'partecipato-open-day' arriva da Brevo (passo 4): finché non c'è, il banner non si mostra.
    default:
      return false
  }
}

export function voceMomento(voce: string, b: BannerContent, ctx: Pick<Contesto, 'now' | 'calendario' | 'persona'>): boolean {
  const giorni = BANNER.giorniMomento[voce]
  if (giorni === undefined) return false
  const area = areaBanner(b)
  if (voce.startsWith('open-day')) {
    const od = prossimoOpenDay(ctx.calendario, ctx.now, area)
    return !!od && giorniA(od.data, ctx.now) <= giorni
  }
  if (voce === 'corsi-4-settimane') {
    const corsi = prossimiCorsi(ctx.calendario, ctx.now, area)
    return !!corsi && giorniA(corsi.inizio, ctx.now) <= giorni
  }
  // 'prezzo-agevolato-7': la scadenza personale arriva da Brevo (passo 4).
  return false
}

const dataLunga = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
  })

/** Valori delle variabili dei testi, solo quelli che il sito conosce. */
export function variabili(b: BannerContent, ctx: Pick<Contesto, 'now' | 'calendario' | 'persona'>): Record<string, string> {
  const v: Record<string, string> = {}
  const area = areaBanner(b) || ctx.persona?.area
  const iscritto = ctx.persona?.openDay && giorniA(ctx.persona.openDay, ctx.now) >= 0 ? ctx.persona.openDay : null
  const od =
    (iscritto && ctx.calendario.openDay.find((o) => o.data.slice(0, 10) === iscritto)) ||
    prossimoOpenDay(ctx.calendario, ctx.now, area) ||
    prossimoOpenDay(ctx.calendario, ctx.now)
  if (od) {
    v.data_open_day = dataLunga(od.data)
    v.giorni_open_day = String(Math.max(0, giorniA(od.data, ctx.now)))
    if (od.docenti) v.docenti_open_day = od.docenti
  }
  const corsi = prossimiCorsi(ctx.calendario, ctx.now, area) || prossimiCorsi(ctx.calendario, ctx.now)
  if (corsi) {
    v.inizio_corsi = dataLunga(corsi.inizio)
    v.settimane_inizio_corsi = String(Math.max(1, Math.ceil(giorniA(corsi.inizio, ctx.now) / 7)))
    if (typeof corsi.posti === 'number' && corsi.posti > 0) v.posti_rimasti = String(corsi.posti)
  }
  return v
}

/** Sostituisce le variabili; null se ne manca qualcuna (meglio niente banner che un testo a metà). */
export function riempi(testo: string | undefined, valori: Record<string, string>): string | null {
  if (!testo) return ''
  let mancante = false
  const out = testo.replace(/\{([a-z_]+)\}/g, (_, nome: string) => {
    if (valori[nome] === undefined) mancante = true
    return valori[nome] ?? ''
  })
  return mancante ? null : out
}

/** Il modo con cui il banner si mostra su questa pagina, o null se qui non può comparire. */
export function modoSuPagina(b: BannerContent, path: string): ModoBanner | null {
  const modo = b.modo || 'pannello'
  if (modo === 'sezione') return null // i posti fissi nelle pagine arrivano dopo
  if (BANNER.soloAvviso.some((r) => corrisponde(path, r))) return modo === 'avviso' ? 'avviso' : null
  if (modo === 'finestra' && BANNER.nienteFinestra.some((r) => corrisponde(path, r))) return 'pannello'
  return modo
}

/** Perché un banner non compare; null se può comparire. Serve anche al riquadro ?debug=profilo. */
export function motivoEsclusione(story: BannerStory, ctx: Contesto): string | null {
  const b = story.content
  const now = ctx.now
  const oggi = now.toISOString().slice(0, 10)
  if (b.pubblica_dal && b.pubblica_dal.slice(0, 10) > oggi) return 'non ancora iniziato (Mostra dal)'
  if (b.pubblica_al && b.pubblica_al.slice(0, 10) < oggi) return 'finito (Mostra fino al)'
  if (!modoSuPagina(b, ctx.path)) return b.modo === 'sezione' ? 'modo Sezione: arriva con i posti fissi' : 'su questa pagina solo avvisi'

  const link = linkBanner(b)
  if (link && !/^https?:/.test(link) && percorso(link) === percorso(ctx.path)) return 'porta a questa pagina'
  if (link && link.startsWith('/open-day') && BANNER.conSezioneOpenDay.some((r) => corrisponde(ctx.path, r)))
    return "la pagina ha già la sezione dell'open day"
  if (!link && !b.modulo) return 'senza pulsante né modulo'
  if (b.modo === 'avviso' && b.modulo && !link) return 'avviso con modulo ma senza pagina a cui portare'

  if (b.nascondi_dopo_azione !== false && ctx.memoria.usati[story.uuid]) return 'già cliccato o modulo inviato'
  const chiuso = ctx.memoria.chiusi[story.uuid]
  const pausa = Number(b.pausa_giorni ?? 7) || 0
  if (chiuso && now.getTime() - new Date(chiuso).getTime() < pausa * GIORNO) return `chiuso da meno di ${pausa} giorni`
  if (b.una_volta_per_visita !== false && ctx.memoria.vistiInVisita.includes(story.uuid)) return 'già visto in questa visita'

  const pubblico = b.pubblico || []
  const nonVisitato = (b.non_visitato || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (pubblico.length || nonVisitato.length) {
    if (!ctx.consenso) return 'serve il consenso marketing (Pubblico pieno)'
    if (!ctx.persona) return 'nessun dato sulla persona'
    const falsa = pubblico.find((voce) => !vocePubblico(voce, ctx.persona as Persona, ctx))
    if (falsa) return `Pubblico non vero: ${falsa}`
    const visti = Object.keys(ctx.persona.pagine)
    if (nonVisitato.some((pezzo) => visti.some((p) => p.includes(pezzo.toLowerCase()))))
      return 'ha già visto la pagina indicata'
  }
  const momento = (b.momento || []).find((voce) => !voceMomento(voce, b, ctx))
  if (momento) return `Momento non vero: ${momento}`

  const valori = variabili(b, ctx)
  if (riempi(b.titolo, valori) === null || riempi(b.testo, valori) === null) return 'manca il valore di una variabile'
  return null
}

/** Ordine di priorità: prima i banner della pagina, poi quelli di tutto il sito, senza doppioni. */
export function ordineBanner(dati: BannerDati, diPagina: string[] = []): BannerStory[] {
  const perUuid = new Map(dati.tutti.map((s) => [s.uuid, s]))
  const visti = new Set<string>()
  const out: BannerStory[] = []
  for (const uuid of [...diPagina, ...dati.ordine]) {
    const s = perUuid.get(uuid)
    if (!s || visti.has(uuid)) continue
    visti.add(uuid)
    out.push(s)
  }
  return out
}

/** Il primo banner che può comparire, con il modo per questa pagina. */
export function scegliBanner(dati: BannerDati, ctx: Contesto): { story: BannerStory; modo: ModoBanner } | null {
  if (paginaSenzaBanner(ctx.path, dati.escludi)) return null
  for (const story of ordineBanner(dati, ctx.diPagina)) {
    if (motivoEsclusione(story, ctx)) continue
    return { story, modo: modoSuPagina(story.content, ctx.path) as ModoBanner }
  }
  return null
}

/** Calendario dai dati globali del sito (eventi e corsi di Storyblok). */
export function calendarioDa(
  events: Array<{ date?: string; isOpenday?: boolean; openday?: string; name?: string; page?: any; docentiNomi?: string }>,
  corsi: Array<{ starts?: string; page?: any; posti?: number }>
): Calendario {
  const area = (testo: string) => areaPagina('/' + testo.toLowerCase().replace(/\s+/g, '-'))
  return {
    openDay: events
      .filter((e) => e.isOpenday && e.date)
      .map((e) => ({
        data: e.date as string,
        area: area(`${e.openday || ''} ${e.name || ''} ${e.page?.cached_url || ''}`),
        docenti: e.docentiNomi || undefined,
      })),
    corsi: corsi
      .filter((c) => c.starts)
      .map((c) => ({ inizio: c.starts as string, area: area(c.page?.cached_url || ''), posti: c.posti })),
  }
}

/** Per il riquadro ?debug=profilo: ogni banner, in ordine, con il motivo per cui non compare. */
export function rapportoBanner(dati: BannerDati, ctx: Contesto): Array<{ uuid: string; nome: string; motivo: string | null }> {
  const esclusa = paginaSenzaBanner(ctx.path, dati.escludi)
  let scelto = false
  return ordineBanner(dati, ctx.diPagina).map((s) => {
    let motivo = esclusa ? 'pagina senza banner' : motivoEsclusione(s, ctx)
    if (!motivo && scelto) motivo = 'ne compare già uno con priorità più alta'
    if (!motivo) scelto = true
    return { uuid: s.uuid, nome: s.content.nome || s.slug, motivo }
  })
}
