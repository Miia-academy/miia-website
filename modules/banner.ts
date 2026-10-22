/**
 * Site banners: which one to show, to whom and with which texts.
 *
 * Pure functions only, so they can be tested. The component
 * `components/banners/siteBanner.tsx` uses them in the browser.
 * Rules agreed with Miia on 19, 20 and 21/10/2026
 * (funnel/sito/2026-10-19_Banner_dinamico_proposta.md, 2026-10-21_Banner_dove_nelle_pagine.html).
 *
 * Storyblok field keys moved from Italian to English on 22/10/2026: until the content
 * is migrated, `normalizeBanner` and `normalizeSiteBanners` read the old key when the new one is missing.
 * Option values (mode, color, audience, timing...) are content and stay as they are.
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

export type BannerMode = 'finestra' | 'pannello' | 'sezione' | 'avviso'

/** The Storyblok "banner" block, with English keys. */
export interface BannerContent {
  name?: string
  title?: string
  text?: string
  image?: { filename?: string; alt?: string; focus?: string }
  action?: Array<{ label?: string; link?: { cached_url?: string; url?: string; linktype?: string } }>
  form?: any
  close_text?: string
  mode?: BannerMode
  color?: 'chiaro' | 'scuro' | 'verde'
  trigger?: 'subito' | 'secondi' | 'scroll'
  trigger_value?: string | number
  audience?: string[]
  not_visited?: string
  timing?: string[]
  publish_from?: string
  publish_until?: string
  pause_days?: string | number
  hide_after_action?: boolean
  once_per_visit?: boolean
}

export interface BannerStory {
  uuid: string
  slug: string
  content: BannerContent
}

/** Banners read from Storyblok for the site: all of them, and the order of "Banner di tutto il sito". */
export interface BannerData {
  all: BannerStory[]
  order: string[]
  exclude: string
  // Fixed places in the pages (tab "Posti fissi nelle pagine" of "Banner di tutto il sito").
  slots?: Partial<Record<Slot, string[]>>
}

export type Slot = 'home' | 'articles' | 'projects'

/** What the site knows about the visitor, from the browser profile or from the cookie. */
export interface Visitor {
  visits: number
  contact: boolean
  forms: string[]
  openDay?: string
  band: 'freddo' | 'tiepido' | 'caldo'
  area?: string
  topics: string[]
  pages: Record<string, number>
}

/** Site dates and data used by timing rules and text variables. */
export interface Calendar {
  openDays: Array<{ date: string; area?: string; teachers?: string }>
  courses: Array<{ start: string; area?: string; seats?: number }>
}

/** Banner memory in this browser: closed, used, already seen in this visit. */
export interface BannerMemory {
  closed: Record<string, string>
  used: Record<string, string>
  seenThisVisit: string[]
}

export interface BannerContext {
  path: string
  now: Date
  consent: boolean
  visitor: Visitor | null
  calendar: Calendar
  memory: BannerMemory
  /** Banners chosen in the page (field "Banner"), before the ones of the whole site. */
  pageBanners?: string[]
}

const DAY = 86400000

// New Storyblok key → old Italian key, for content not migrated yet.
const BANNER_KEYS: Record<keyof BannerContent, string> = {
  name: 'nome',
  title: 'titolo',
  text: 'testo',
  image: 'immagine',
  action: 'azione',
  form: 'modulo',
  close_text: 'chiudi_testo',
  mode: 'modo',
  color: 'colore',
  trigger: 'comparsa',
  trigger_value: 'comparsa_valore',
  audience: 'pubblico',
  not_visited: 'non_visitato',
  timing: 'momento',
  publish_from: 'pubblica_dal',
  publish_until: 'pubblica_al',
  pause_days: 'pausa_giorni',
  hide_after_action: 'nascondi_dopo_azione',
  once_per_visit: 'una_volta_per_visita',
}

/** The new key's value, or the old key's when the new one is not in the content yet. */
function field(raw: Record<string, unknown>, key: string, oldKey: string): any {
  return raw[key] !== undefined ? raw[key] : raw[oldKey]
}

/** A banner block from Storyblok with English keys, whether its content is migrated or not. */
export function normalizeBanner(raw: Record<string, unknown> | null | undefined): BannerContent {
  const content: Record<string, unknown> = {}
  for (const [key, oldKey] of Object.entries(BANNER_KEYS)) {
    const value = field(raw || {}, key, oldKey)
    if (value !== undefined) content[key] = value
  }
  return content as BannerContent
}

/** The "Banner di tutto il sito" story, with English keys. */
export function normalizeSiteBanners(raw: Record<string, unknown> | null | undefined) {
  const r = raw || {}
  const list = (key: string, oldKey: string): string[] => {
    const value = field(r, key, oldKey)
    return Array.isArray(value) ? value : []
  }
  const exclude = field(r, 'exclude', 'escludi')
  return {
    order: list('banner', 'banner'),
    exclude: typeof exclude === 'string' ? exclude : '',
    slots: {
      home: list('slot_home', 'posto_home'),
      articles: list('slot_articles', 'posto_articoli'),
      projects: list('slot_projects', 'posto_progetti'),
    },
  }
}

const formCode = (tracking: string) => MODULI[tracking]?.codice

export function visitorFromDetail(d: Dettaglio): Visitor {
  const pages: Record<string, number> = {}
  for (const [path, p] of Object.entries(d.pagine)) pages[path] = p.viste
  const forms = Object.keys(d.moduli)
  return {
    visits: d.visite.numero,
    contact: forms.length > 0,
    forms,
    openDay: d.openDay,
    band: fascia(punteggio(d)),
    area: areaPrevalente(d),
    topics: [],
    pages,
  }
}

export function visitorFromSummary(r: Riassunto): Visitor {
  return {
    visits: r.v,
    contact: r.c === 1,
    forms: r.m ? r.m.split(',').map((item) => item.split(':')[0]) : [],
    openDay: r.od,
    band: r.fx,
    area: r.a,
    topics: r.t ? r.t.split(',') : [],
    pages: {},
  }
}

/** A page matches a rule: "/" only the home, "/blog/" what is inside, "/lavoro" also its subpages. */
export function matchesPath(path: string, rule: string): boolean {
  const p = percorso(path)
  const r = rule.trim().toLowerCase()
  if (!r) return false
  if (r === '/') return p === '/'
  if (r.endsWith('/')) return (p + '/').startsWith(r) && p + '/' !== r
  return p === r || p.startsWith(r + '/')
}

export function isPageWithoutBanners(path: string, exclude = ''): boolean {
  const rules = [...BANNER.excludedPages, ...exclude.split(',')]
  return rules.some((r) => matchesPath(path, r))
}

/** Clean address of the banner button, or null. */
export function bannerLink(b: BannerContent): string | null {
  const link = b.action?.[0]?.link
  const url = link?.cached_url || link?.url
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return '/' + url.replace(/^\/+/, '')
}

/** Area of the banner, from its audience (interni / moda). */
export function bannerArea(b: BannerContent): string | undefined {
  return (b.audience || []).find((v) => v === 'interni' || v === 'moda')
}

function daysUntil(date: string, now: Date): number {
  const day = new Date(date.slice(0, 10) + 'T00:00:00')
  const today = new Date(now.toISOString().slice(0, 10) + 'T00:00:00')
  return Math.round((day.getTime() - today.getTime()) / DAY)
}

export function nextOpenDay(cal: Calendar, now: Date, area?: string) {
  return cal.openDays
    .filter((o) => new Date(o.date).getTime() >= now.getTime() && (!area || o.area === area))
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

export function nextCourses(cal: Calendar, now: Date, area?: string) {
  const future = cal.courses
    .filter((c) => daysUntil(c.start, now) >= 0 && (!area || c.area === area))
    .sort((a, b) => a.start.localeCompare(b.start))
  if (!future.length) return null
  const start = future[0].start.slice(0, 10)
  const sameDay = future.filter((c) => c.start.slice(0, 10) === start)
  const seats = sameDay.every((c) => typeof c.seats === 'number')
    ? sameDay.reduce((total, c) => total + (c.seats as number), 0)
    : undefined
  return { start, seats }
}

/**
 * Is an audience item true for this visitor?
 * Items the site cannot know yet (data from Brevo, topics) are false.
 */
export function matchesAudience(item: string, v: Visitor, ctx: Pick<BannerContext, 'path' | 'now'>): boolean {
  const openDaySignedUp = !!v.openDay && daysUntil(v.openDay, ctx.now) >= 0
  switch (item) {
    case 'prima-visita':
      return v.visits <= 1
    case 'tornato':
      return v.visits >= 2
    case 'pagina-rivista':
      return (v.pages[percorso(ctx.path)] || 0) >= 2
    case 'contatto':
      return v.contact
    case 'non-contatto':
      return !v.contact
    case 'iscritto-open-day':
      return openDaySignedUp
    case 'non-iscritto-open-day':
      return !openDaySignedUp
    case 'presentazione':
      return v.forms.includes(formCode('brochure'))
    case 'non-presentazione':
      return !v.forms.includes(formCode('brochure'))
    case 'non-iscrizione':
      return !v.forms.includes(formCode('iscrizione'))
    case 'freddo':
    case 'tiepido':
    case 'caldo':
      return v.band === item
    case 'interni':
    case 'moda':
      return v.area === item
    case 'creativo':
    case 'tecnico':
      return v.topics.includes(item)
    // 'partecipato-open-day' comes from Brevo (step 4): until then the banner does not show.
    default:
      return false
  }
}

export function matchesTiming(item: string, b: BannerContent, ctx: Pick<BannerContext, 'now' | 'calendar' | 'visitor'>): boolean {
  const days = BANNER.timingDays[item]
  if (days === undefined) return false
  const area = bannerArea(b)
  if (item.startsWith('open-day')) {
    const od = nextOpenDay(ctx.calendar, ctx.now, area)
    return !!od && daysUntil(od.date, ctx.now) <= days
  }
  if (item === 'corsi-4-settimane') {
    const courses = nextCourses(ctx.calendar, ctx.now, area)
    return !!courses && daysUntil(courses.start, ctx.now) <= days
  }
  // 'prezzo-agevolato-7': the personal deadline comes from Brevo (step 4).
  return false
}

const longDate = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
  })

/**
 * Values of the text variables, only the ones the site knows.
 * The variable names ({data_open_day}...) are what editors write in Storyblok.
 */
export function textVariables(b: BannerContent, ctx: Pick<BannerContext, 'now' | 'calendar' | 'visitor'>): Record<string, string> {
  const values: Record<string, string> = {}
  const area = bannerArea(b) || ctx.visitor?.area
  const signedUp = ctx.visitor?.openDay && daysUntil(ctx.visitor.openDay, ctx.now) >= 0 ? ctx.visitor.openDay : null
  const od =
    (signedUp && ctx.calendar.openDays.find((o) => o.date.slice(0, 10) === signedUp)) ||
    nextOpenDay(ctx.calendar, ctx.now, area) ||
    nextOpenDay(ctx.calendar, ctx.now)
  if (od) {
    values.data_open_day = longDate(od.date)
    values.giorni_open_day = String(Math.max(0, daysUntil(od.date, ctx.now)))
    if (od.teachers) values.docenti_open_day = od.teachers
  }
  const courses = nextCourses(ctx.calendar, ctx.now, area) || nextCourses(ctx.calendar, ctx.now)
  if (courses) {
    values.inizio_corsi = longDate(courses.start)
    values.settimane_inizio_corsi = String(Math.max(1, Math.ceil(daysUntil(courses.start, ctx.now) / 7)))
    if (typeof courses.seats === 'number' && courses.seats > 0) values.posti_rimasti = String(courses.seats)
  }
  return values
}

/** Replaces the variables; null if one is missing (better no banner than half a text). */
export function fillText(text: string | undefined, values: Record<string, string>): string | null {
  if (!text) return ''
  let missing = false
  const out = text.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    if (values[name] === undefined) missing = true
    return values[name] ?? ''
  })
  return missing ? null : out
}

/** How the banner shows on this page, or null if it cannot appear here. */
export function modeOnPage(b: BannerContent, path: string): BannerMode | null {
  const mode = b.mode || 'pannello'
  if (mode === 'sezione') return null // sections only appear in the fixed places of the pages
  if (BANNER.noticeOnly.some((r) => matchesPath(path, r))) return mode === 'avviso' ? 'avviso' : null
  if (mode === 'finestra' && BANNER.noWindow.some((r) => matchesPath(path, r))) return 'pannello'
  return mode
}

/**
 * Why a banner does not appear; null if it can. Also used by the ?debug=profilo box,
 * so the reasons are in Italian for whoever reads them.
 */
export function exclusionReason(story: BannerStory, ctx: BannerContext, inSlot = false): string | null {
  const b = story.content
  const now = ctx.now
  const today = now.toISOString().slice(0, 10)
  if (b.publish_from && b.publish_from.slice(0, 10) > today) return 'non ancora iniziato (Mostra dal)'
  if (b.publish_until && b.publish_until.slice(0, 10) < today) return 'finito (Mostra fino al)'
  if (!inSlot && !modeOnPage(b, ctx.path))
    return b.mode === 'sezione' ? 'modo Sezione: compare solo nei posti fissi' : 'su questa pagina solo avvisi'

  const link = bannerLink(b)
  if (link && !/^https?:/.test(link) && percorso(link) === percorso(ctx.path)) return 'porta a questa pagina'
  if (link && link.startsWith('/open-day') && BANNER.withOpenDaySection.some((r) => matchesPath(ctx.path, r)))
    return "la pagina ha già la sezione dell'open day"
  if (!link && !b.form) return 'senza pulsante né modulo'
  if (!inSlot && b.mode === 'avviso' && b.form && !link) return 'avviso con modulo ma senza pagina a cui portare'

  if (b.hide_after_action !== false && ctx.memory.used[story.uuid]) return 'già cliccato o modulo inviato'
  // The section in the page cannot be closed and may come back at every visit.
  if (!inSlot) {
    const closed = ctx.memory.closed[story.uuid]
    const pause = Number(b.pause_days ?? 7) || 0
    if (closed && now.getTime() - new Date(closed).getTime() < pause * DAY) return `chiuso da meno di ${pause} giorni`
    if (b.once_per_visit !== false && ctx.memory.seenThisVisit.includes(story.uuid)) return 'già visto in questa visita'
  }

  const audience = b.audience || []
  const notVisited = (b.not_visited || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (audience.length || notVisited.length) {
    if (!ctx.consent) return 'serve il consenso marketing (Pubblico pieno)'
    if (!ctx.visitor) return 'nessun dato sulla persona'
    const failing = audience.find((item) => !matchesAudience(item, ctx.visitor as Visitor, ctx))
    if (failing) return `Pubblico non vero: ${failing}`
    const seen = Object.keys(ctx.visitor.pages)
    if (notVisited.some((part) => seen.some((p) => p.includes(part.toLowerCase()))))
      return 'ha già visto la pagina indicata'
  }
  const timing = (b.timing || []).find((item) => !matchesTiming(item, b, ctx))
  if (timing) return `Momento non vero: ${timing}`

  const values = textVariables(b, ctx)
  if (fillText(b.title, values) === null || fillText(b.text, values) === null) return 'manca il valore di una variabile'
  return null
}

/** Priority order: first the page's banners, then the whole site's, without duplicates. */
export function bannerOrder(data: BannerData, pageBanners: string[] = []): BannerStory[] {
  const byUuid = new Map(data.all.map((s) => [s.uuid, s]))
  const seen = new Set<string>()
  const out: BannerStory[] = []
  for (const uuid of [...pageBanners, ...data.order]) {
    const s = byUuid.get(uuid)
    if (!s || seen.has(uuid)) continue
    seen.add(uuid)
    out.push(s)
  }
  return out
}

/** The first banner that can appear, with its mode for this page. */
export function pickBanner(data: BannerData, ctx: BannerContext): { story: BannerStory; mode: BannerMode } | null {
  if (isPageWithoutBanners(ctx.path, data.exclude)) return null
  for (const story of bannerOrder(data, ctx.pageBanners)) {
    if (exclusionReason(story, ctx)) continue
    return { story, mode: modeOnPage(story.content, ctx.path) as BannerMode }
  }
  return null
}

/** The banner to show as a section in a fixed place of the page, or null (no section). */
export function pickForSlot(data: BannerData, slot: Slot, ctx: BannerContext): BannerStory | null {
  const byUuid = new Map(data.all.map((s) => [s.uuid, s]))
  for (const uuid of data.slots?.[slot] || []) {
    const story = byUuid.get(uuid)
    if (story && !exclusionReason(story, ctx, true)) return story
  }
  return null
}

/** Calendar from the site's global data (Storyblok events and courses). */
export function calendarFrom(
  events: Array<{ date?: string; isOpenday?: boolean; openday?: string; name?: string; page?: any; teacherNames?: string }>,
  courses: Array<{ starts?: string; page?: any; seats?: number }>
): Calendar {
  const area = (text: string) => areaPagina('/' + text.toLowerCase().replace(/\s+/g, '-'))
  return {
    openDays: events
      .filter((e) => e.isOpenday && e.date)
      .map((e) => ({
        date: e.date as string,
        area: area(`${e.openday || ''} ${e.name || ''} ${e.page?.cached_url || ''}`),
        teachers: e.teacherNames || undefined,
      })),
    courses: courses
      .filter((c) => c.starts)
      .map((c) => ({ start: c.starts as string, area: area(c.page?.cached_url || ''), seats: c.seats })),
  }
}

/** For the ?debug=profilo box: every banner, in order, with the reason it does not appear. */
export function bannerReport(data: BannerData, ctx: BannerContext): Array<{ uuid: string; name: string; reason: string | null }> {
  const excluded = isPageWithoutBanners(ctx.path, data.exclude)
  let picked = false
  return bannerOrder(data, ctx.pageBanners).map((s) => {
    let reason = excluded ? 'pagina senza banner' : exclusionReason(s, ctx)
    if (!reason && picked) reason = 'ne compare già uno con priorità più alta'
    if (!reason) picked = true
    return { uuid: s.uuid, name: s.content.name || s.slug, reason }
  })
}
