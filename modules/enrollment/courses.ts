import { CORSI, AREA_BREVE, type Corso } from '@config/corsi'

/**
 * Corsi a cui ci si iscrive. In Storyblok un corso è una cartella e le sue edizioni
 * sono le storie "course" al suo interno:
 * - corsi in tabella (config/corsi.ts): corsi/<indirizzo>/..., es. corsi/interior-design-arredo/.../treviso-sabato
 * - gli altri, come prima: corsi/<area>/<codice>/..., es. corsi/fashion-design/corso-fashion-design-secondo-livello/...
 *
 * Il corso si identifica sempre col codice (corso-interior-design-primo-livello), che non cambia.
 */

/** Il corso della tabella con questo codice o indirizzo. */
export function findCourse(value: string | null | undefined): Corso | null {
  if (!value) return null
  return CORSI.find((c) => c.codice === value || c.indirizzo === value) || null
}

/** Codice del corso da un codice o da un indirizzo: "interior-design-arredo" → "corso-interior-design-primo-livello". */
export function courseCode(value: string | null | undefined): string | null {
  if (!value) return null
  return findCourse(value)?.codice || value
}

/** Indirizzo del corso (pagina e iscrizione): "corso-interior-design-primo-livello" → "interior-design-arredo". */
export function coursePath(codice: string): string {
  return findCourse(codice)?.indirizzo || codice
}

/** Il corso della tabella per area breve e livello: ("interni", "primo") → arredo. */
export function courseByAreaLevel(area: string | null | undefined, livello: string | null | undefined): Corso | null {
  const a = (area || '').trim().toLowerCase()
  const l = (livello || '').trim().toLowerCase()
  return CORSI.find((c) => (AREA_BREVE[c.area] === a || c.area === a || c.area.startsWith(`${a}-`)) && c.livello === l) || null
}

/**
 * Codice del corso dalla posizione di una storia in Storyblok:
 * "corsi/interior-design-arredo/x/y" e "corsi/interior-design/corso-interior-design-primo-livello/x/y"
 * → "corso-interior-design-primo-livello".
 */
export function courseFromEditionSlug(fullSlug: string | undefined | null): string | null {
  if (typeof fullSlug !== 'string') return null
  const parts = fullSlug.split('/')
  if (parts[0] === 'corsi' && parts.length > 2) {
    const course = CORSI.find((c) => c.indirizzo === parts[1])
    if (course) return course.codice
  }
  const match = fullSlug.match(/^corsi\/[^/]+\/(corso-[a-z0-9-]+)\//)
  return match ? match[1] : null
}

/** Titolo leggibile: "corso-interior-design-primo-livello" → "Interior design, primo livello". */
export function courseTitle(slug: string): string {
  const words = courseCode(slug)!.replace(/^corso-/, '').split('-')
  const levelAt = words.findIndex((w, i) => /^(primo|secondo|terzo)$/.test(w) && words[i + 1] === 'livello')
  const name = (levelAt > 0 ? words.slice(0, levelAt) : words).join(' ')
  const level = levelAt > 0 ? words.slice(levelAt).join(' ') : ''
  const title = name.charAt(0).toUpperCase() + name.slice(1)
  return level ? `${title}, ${level}` : title
}
