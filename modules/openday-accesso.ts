/**
 * Accesso all'open day: la pagina miia.it/open-day/accedi/<codice> porta alla call
 * dell'open day giusto e segna in Brevo chi è entrato.
 *
 * Il codice è lo slug della storia "event" in Storyblok (es. openday-interni-novembre),
 * salvato nel contatto (OPENDAY_CODICE) quando la persona si iscrive. Il link della call sta
 * nel campo "Link della call" dell'evento e non arriva mai al browser prima dell'apertura.
 *
 * Orari, contati dall'ora di inizio dell'evento:
 * - si entra da 15 minuti prima;
 * - chi entra più di 15 minuti dopo l'inizio è segnato in ritardo (OPENDAY_RITARDO);
 * - dopo 60 minuti l'open day è finito e la pagina propone il prossimo.
 */
import { getStoryblokVersion } from '@config/version'

export const APRE_PRIMA_MINUTI = 15
export const RITARDO_DOPO_MINUTI = 15
export const DURATA_MINUTI = 60
export const GIORNI_OFFERTA = 14

const MINUTO = 60 * 1000
const CDN = 'https://api.storyblok.com/v2/cdn'
const CODICE = /^[a-z0-9]+(-[a-z0-9]+)*$/

export type Fase = 'presto' | 'aperto' | 'finito'

export interface OpendayEvento {
  codice: string
  titolo: string
  /** Area dal campo "Openday" dell'evento: "interni", "moda". */
  area: string
  inizio: Date
  link: string
}

export function normalizeCodice(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const codice = value.trim().toLowerCase()
  return codice.length <= 80 && CODICE.test(codice) ? codice : null
}

/** Scarto in millisecondi tra l'ora italiana e UTC in quell'istante. */
function romeOffset(at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Rome',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - at
}

/**
 * Data dell'evento in Storyblok ("2026-11-16 21:00") letta come ora italiana,
 * come la mostra il sito. Accetta anche date ISO con fuso esplicito.
 */
export function parseInizio(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/)
  if (!m) {
    const d = new Date(value)
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) && !isNaN(d.getTime()) ? d : null
  }
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let at = wall - romeOffset(wall)
  at = wall - romeOffset(at)
  return new Date(at)
}

export function orari(inizio: Date) {
  const t = inizio.getTime()
  return {
    apre: new Date(t - APRE_PRIMA_MINUTI * MINUTO),
    ritardo: new Date(t + RITARDO_DOPO_MINUTI * MINUTO),
    fine: new Date(t + DURATA_MINUTI * MINUTO),
  }
}

export function fase(inizio: Date, now: Date = new Date()): Fase {
  const { apre, fine } = orari(inizio)
  if (now < apre) return 'presto'
  if (now >= fine) return 'finito'
  return 'aperto'
}

export function inRitardo(inizio: Date, now: Date = new Date()): boolean {
  return now > orari(inizio).ritardo
}

/** Data del calendario italiano (AAAA-MM-GG). */
export function romeDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Ultimo giorno del prezzo riservato: giorno dell'open day + 14. */
export function scadenzaOfferta(inizio: Date): string {
  return addDays(romeDay(inizio), GIORNI_OFFERTA)
}

/** "30 novembre": la scadenza scritta come nelle email. */
export function scadenzaTesto(inizio: Date): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${scadenzaOfferta(inizio)}T12:00:00Z`))
}

/** "lunedì 16 novembre alle 21:00" */
export function quandoTesto(inizio: Date): string {
  const giorno = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Rome',
  }).format(inizio)
  const ora = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(inizio)
  return `${giorno} alle ${ora}`
}

interface StoryEvento {
  slug?: string
  name?: string
  content?: {
    date?: string
    title?: string
    openday?: string
    link_meet?: string
  }
}

export function toEvento(story: StoryEvento): OpendayEvento | null {
  const codice = normalizeCodice(story.slug)
  const inizio = parseInizio(story.content?.date)
  if (!codice || !inizio || !story.name?.startsWith('openday-')) return null
  return {
    codice,
    titolo: (story.content?.title || '').trim(),
    area: (story.content?.openday || '').split(' - ')[0].trim(),
    inizio,
    link: (story.content?.link_meet || '').trim(),
  }
}

/** Tutti gli open day pubblicati in Storyblok, in ordine di data. */
export async function loadOpenday(): Promise<OpendayEvento[]> {
  const token = process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW
  if (!token) throw new Error('NEXT_PUBLIC_STORYBLOK_PREVIEW mancante')
  const query = new URLSearchParams({
    token,
    version: getStoryblokVersion(),
    content_type: 'event',
    per_page: '100',
  })
  const res = await fetch(`${CDN}/stories?${query}`)
  if (!res.ok) throw new Error(`Storyblok stories: ${res.status}`)
  const data = (await res.json()) as { stories?: StoryEvento[] }
  return (data.stories || [])
    .map(toEvento)
    .filter((e): e is OpendayEvento => !!e)
    .sort((a, b) => a.inizio.getTime() - b.inizio.getTime())
}

/** Il prossimo open day della stessa area che non è ancora finito. */
export function prossimo(eventi: OpendayEvento[], area: string, now: Date = new Date()): OpendayEvento | undefined {
  return eventi.find((e) => e.area === area && fase(e.inizio, now) !== 'finito')
}

/** Gli open day non ancora finiti nella prima serata in calendario (di solito stasera). */
export function stasera(eventi: OpendayEvento[], now: Date = new Date()): OpendayEvento[] {
  const aperti = eventi.filter((e) => fase(e.inizio, now) !== 'finito')
  if (!aperti.length) return []
  const giorno = romeDay(aperti[0].inizio)
  return aperti.filter((e) => romeDay(e.inizio) === giorno)
}
