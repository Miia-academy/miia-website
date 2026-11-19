/**
 * Data for the course aside: the price headline written with variables from the
 * price list, and the editions picked by a filter instead of one by one.
 */
import type { PriceList } from '@modules/enrollment/types'

/** Price list values that can be shown on public pages (the open day offer stays private). */
export type PublicPrices = Pick<PriceList, 'unica' | 'rata5' | 'rata10' | 'esame'>

export function publicPrices(list: PriceList | null): PublicPrices | null {
  return list ? { unica: list.unica, rata5: list.rata5, rata10: list.rata10, esame: list.esame } : null
}

// --- Price headline ---

// 'always': without it Italian leaves 4-digit numbers ungrouped (5490)
const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })
const VARIABLE = /\{(\w+)\}/g

/**
 * Fills "A partire da **{rata10}€** per 10 mesi" with the price list values.
 * null when the price list is missing or the text names an unknown variable,
 * so the page never shows a "{...}" or a wrong price.
 */
export function fillPriceText(text: string | undefined, prices: PublicPrices | null | undefined): string | null {
  if (!text?.trim() || !prices) return null
  let unknown = false
  const filled = text.replace(VARIABLE, (_, name: string) => {
    const value = (prices as unknown as Record<string, unknown>)[name]
    if (typeof value !== 'number') {
      unknown = true
      return ''
    }
    return NUMBER.format(value)
  })
  return unknown ? null : filled.trim()
}

export interface PriceSegment {
  kind: 'text' | 'figure' | 'note'
  value: string
}

/** **big figure**, _small note_, the rest plain text. */
export function priceSegments(text: string): PriceSegment[] {
  const segments: PriceSegment[] = []
  const pattern = /\*\*(.+?)\*\*|_(.+?)_/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) segments.push({ kind: 'text', value: text.slice(last, match.index) })
    segments.push(match[1] !== undefined ? { kind: 'figure', value: match[1] } : { kind: 'note', value: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}

// --- Editions filter ---

// Short names editors use for the area folders
const AREA_ALIASES: Record<string, string[]> = {
  'interior-design': ['interni', 'interior'],
  'fashion-design': ['moda', 'fashion'],
}

/**
 * Words an edition can be filtered by: area, level and the words of its own slug
 * (city, frequency), e.g. corsi/interior-design/corso-interior-design-primo-livello/x/bassano-sabato
 * → interni, interior, primo, primo-livello, bassano, sabato.
 */
export function editionTags(fullSlug: string | null | undefined): Set<string> {
  const tags = new Set<string>()
  const match = typeof fullSlug === 'string' ? fullSlug.match(/^corsi\/([^/]+)\/(corso-[a-z0-9-]+)\/(?:.*\/)?([^/]+)\/?$/) : null
  if (!match) return tags
  const [, area, course, edition] = match
  tags.add(area)
  AREA_ALIASES[area]?.forEach((a) => tags.add(a))
  const level = course.match(/(primo|secondo|terzo)-livello/)
  if (level) {
    tags.add(level[1])
    tags.add(level[0])
  }
  edition.split('-').forEach((w) => w && tags.add(w))
  return tags
}

/** Filter tokens, e.g. "interni, primo_livello, Bassano" → interni, primo-livello, bassano. */
export function filterTokens(filter: string | undefined): string[] {
  return (filter || '')
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/[\s_]+/g, '-'))
    .filter(Boolean)
}

/** Every token must match: "moda,primo" = first level fashion editions, in every city. */
export function matchesFilter(fullSlug: string | null | undefined, filter: string | undefined): boolean {
  const tokens = filterTokens(filter)
  if (!tokens.length) return false
  const tags = editionTags(fullSlug)
  return tokens.every((t) => tags.has(t))
}

/** Editions matching the filter, the first to start first (undated ones last). */
export function filterEditions<T extends { fullSlug?: string | null; starts?: string }>(
  editions: T[],
  filter: string | undefined
): T[] {
  return editions
    .filter((e) => matchesFilter(e.fullSlug, filter))
    .sort((a, b) => (a.starts || '9999').localeCompare(b.starts || '9999'))
}

// --- Storyblok migration (switch to main) ---

export const DEFAULT_PRICE_TEXT = 'A partire da **{rata10}€** per 10 mesi _*iva inclusa_'

/**
 * Filter that picks the same editions a course page shows today:
 * corsi/interior-design/corso-interior-design-primo-livello-padova → "interni,primo,padova".
 */
export function filterFromPageSlug(fullSlug: string): string | null {
  const match = fullSlug.match(/^corsi\/([^/]+)\/corso-[a-z0-9-]*?(primo|secondo|terzo)-livello(?:-([a-z]+))?\/?$/)
  if (!match) return null
  const [, area, level, city] = match
  const short = AREA_ALIASES[area]?.[0] || area
  return [short, level, city].filter(Boolean).join(',')
}
