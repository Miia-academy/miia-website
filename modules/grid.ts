// @modules/grid.ts
// Filters of the grid block: hidden articles, tags from the "filter" field and the interactive controls.

/** "" (default): only visible articles; "hidden": only hidden ones; "all": both. */
export type GridVisibility = '' | 'hidden' | 'all'

/** Interactive filters the editor can show above the grid. */
export type GridControl = 'tags' | 'authors'

export type GridAuthor = { uuid: string; name: string }

type Hideable = { hidden?: boolean }
type Tagged = { tagList?: string[] }
type Authored = { author?: GridAuthor }

/** Keys of the "filter" field: one or more values separated by commas, compared in lowercase. */
export function filterKeys(filter?: string): string[] {
  return (filter || '')
    .split(',')
    .map((key) => key.trim().toLowerCase())
    .filter(Boolean)
}

/** Always a new array, so the caller can sort it. */
export function byVisibility<T extends Hideable>(items: T[], visibility?: string): T[] {
  if (visibility === 'all') return [...items]
  if (visibility === 'hidden') return items.filter((item) => item.hidden === true)
  return items.filter((item) => !item.hidden)
}

export function hasTag(item: Tagged, tag: string): boolean {
  return !!item.tagList?.some((t) => t.toLowerCase() === tag.toLowerCase())
}

/** Tags of the items, without duplicates, in alphabetical order. */
export function tagOptions(items: Tagged[]): string[] {
  const tags = new Map<string, string>()
  for (const item of items) {
    for (const tag of item.tagList || []) {
      if (!tags.has(tag.toLowerCase())) tags.set(tag.toLowerCase(), tag)
    }
  }
  return [...tags.values()].sort((a, b) => tagLabel(a).localeCompare(tagLabel(b), 'it'))
}

/** Authors of the items, without duplicates, in alphabetical order. */
export function authorOptions(items: Authored[]): GridAuthor[] {
  const authors = new Map<string, GridAuthor>()
  for (const { author } of items) {
    if (author?.uuid && author.name && !authors.has(author.uuid)) authors.set(author.uuid, author)
  }
  return [...authors.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'))
}

/** Storyblok tags are often slugs: "interni-primo-livello" becomes "Interni primo livello". */
export function tagLabel(tag: string): string {
  const text = tag.replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Editor's choice of controls; values other than tags and authors are ignored. */
export function gridControls(value: unknown): GridControl[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : []
  return list.filter((c): c is GridControl => c === 'tags' || c === 'authors')
}

/** The article's author, whether Storyblok resolved the relation (story) or left the uuid. */
export function articleAuthor(value: unknown, persons: { uuid: string; name: string }[]): GridAuthor | undefined {
  if (!value) return undefined
  if (typeof value === 'string') {
    const person = persons.find((p) => p.uuid === value)
    return person?.name ? { uuid: person.uuid, name: person.name } : undefined
  }
  const story = value as { uuid?: string; name?: string; content?: { title?: string } }
  const name = story.content?.title || story.name
  return story.uuid && name ? { uuid: story.uuid, name } : undefined
}
