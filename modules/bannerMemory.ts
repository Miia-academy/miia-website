/**
 * Banner memory in this browser: when a banner was closed or used
 * (click or form sent) and which ones already appeared in this visit.
 *
 * It only avoids showing the same banner again: no personal data,
 * so it works without marketing consent too. If browser storage is
 * blocked the banners still work, without remembering anything.
 */
import type { BannerMemory } from '@modules/banner'

const MEMORY_KEY = 'miia_banner'
const VISIT_KEY = 'miia_banner_visita'
const FORCE_KEY = 'miia_banner_forza'

export const FORCE_EVENT = 'miia-banner-forza'

type Stored = Pick<BannerMemory, 'closed' | 'used'>

function readStored(): Stored {
  try {
    const d = JSON.parse(window.localStorage.getItem(MEMORY_KEY) || '{}')
    // "chiusi" and "usati" are the keys saved before 22/10/2026.
    return { closed: d.closed || d.chiusi || {}, used: d.used || d.usati || {} }
  } catch {
    return { closed: {}, used: {} }
  }
}

function writeStored(m: Stored) {
  try {
    window.localStorage.setItem(MEMORY_KEY, JSON.stringify(m))
  } catch {
    // storage blocked: the banner may come back
  }
}

export function readMemory(): BannerMemory {
  let seenThisVisit: string[] = []
  try {
    seenThisVisit = JSON.parse(window.sessionStorage.getItem(VISIT_KEY) || '[]')
  } catch {
    seenThisVisit = []
  }
  return { ...readStored(), seenThisVisit }
}

export function markSeen(uuid: string) {
  try {
    const seen = readMemory().seenThisVisit
    if (!seen.includes(uuid)) window.sessionStorage.setItem(VISIT_KEY, JSON.stringify([...seen, uuid]))
  } catch {
    // nothing
  }
}

export function markClosed(uuid: string) {
  const m = readStored()
  m.closed[uuid] = new Date().toISOString()
  writeStored(m)
}

export function markUsed(uuid: string) {
  const m = readStored()
  m.used[uuid] = new Date().toISOString()
  writeStored(m)
}

export function clearMemory() {
  try {
    window.localStorage.removeItem(MEMORY_KEY)
    window.sessionStorage.removeItem(VISIT_KEY)
  } catch {
    // nothing
  }
}

/** Previews only: show a chosen banner right away, without conditions. */
export function forceBanner(uuid: string | null) {
  try {
    if (uuid) window.sessionStorage.setItem(FORCE_KEY, uuid)
    else window.sessionStorage.removeItem(FORCE_KEY)
  } catch {
    // nothing
  }
  window.dispatchEvent(new Event(FORCE_EVENT))
}

export function forcedBanner(): string | null {
  try {
    return window.sessionStorage.getItem(FORCE_KEY)
  } catch {
    return null
  }
}

// Banners shown in this page as a section: they do not repeat as window or panel.
const inPage = new Set<string>()

export function markInPage(uuid: string) {
  inPage.add(uuid)
}

export function removeFromPage(uuid: string) {
  inPage.delete(uuid)
}

export function bannersInPage(): string[] {
  return Array.from(inPage)
}
