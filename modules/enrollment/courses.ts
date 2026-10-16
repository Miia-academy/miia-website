/**
 * Corsi a cui ci si iscrive. In Storyblok un corso è la cartella
 * corsi/<area>/corso-.../ e le sue edizioni sono le storie "course" al suo interno,
 * es. corsi/interior-design/corso-interior-design-primo-livello/.../treviso-sabato.
 */

/**
 * Il corso è il nome della cartella, così com'è in Storyblok:
 * "corsi/interior-design/corso-interior-design-primo-livello/x/y" → "corso-interior-design-primo-livello".
 */
export function courseFromEditionSlug(fullSlug: string | undefined | null): string | null {
  const match = typeof fullSlug === 'string' ? fullSlug.match(/^corsi\/[^/]+\/(corso-[a-z0-9-]+)\//) : null
  return match ? match[1] : null
}

/** Titolo leggibile: "corso-interior-design-primo-livello" → "Interior design, primo livello". */
export function courseTitle(slug: string): string {
  const words = slug.replace(/^corso-/, '').split('-')
  const levelAt = words.findIndex((w, i) => /^(primo|secondo|terzo)$/.test(w) && words[i + 1] === 'livello')
  const name = (levelAt > 0 ? words.slice(0, levelAt) : words).join(' ')
  const level = levelAt > 0 ? words.slice(levelAt).join(' ') : ''
  const title = name.charAt(0).toUpperCase() + name.slice(1)
  return level ? `${title}, ${level}` : title
}
