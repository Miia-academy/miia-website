/**
 * Storyblok forms against Brevo contact attributes (Ambito 3, 22/10).
 *
 * Two pure tools, used by the scripts in scripts/ (no network here):
 * - checkForms: read-only check that every form field has a Brevo attribute
 *   of the right type and that choice values are Brevo options. A wrong option
 *   in a multiple-choice attribute makes Brevo reject the whole contact, and
 *   /api/crm then keeps only name, surname and phone.
 * - migrateStory: the Storyblok content changes to apply at the switch to main.
 */
import { randomUUID } from 'node:crypto'
import { isFormWritableAttribute } from '@modules/crm-form'
import { CATEGORY_IDS, interestCourse, isCategoryAttribute } from '@modules/brevo-attributes'
import { normalizeTracking } from '@modules/brevo-events'
import { DEFAULT_PRICE_TEXT, filterFromPageSlug } from '@modules/aside'
import { isEnrollAction } from '@components/enrollment/enroll-link'

export interface BrevoAttribute {
  name: string
  category?: string
  type?: string
  multiCategoryOptions?: string[]
  enumeration?: unknown[]
}

export interface FieldBlok {
  id?: string
  input?: string
  hidden?: boolean
  label?: string
  placeholder?: string
  options?: string
  required?: boolean
  component?: string
  _uid?: string
  [k: string]: unknown
}

export interface FormBlok {
  component: 'form'
  _uid?: string
  alias?: unknown
  tracking?: unknown
  list?: unknown[]
  fields?: FieldBlok[]
  [k: string]: unknown
}

export interface Finding {
  level: 'errore' | 'avviso'
  where: string
  message: string
}

/** Tracking values the site knows after the switch (see @modules/brevo-events). */
export const TRACKING_VALUES = ['brochure', 'news', 'info', 'openday', 'project', 'recruit', 'partnership']

// Field ids that are not contact attributes: the identifier and the bot trap.
const NOT_ATTRIBUTES = new Set(['email', 'validation'])

/** "Label:value" lines of a select field → values. */
export function optionValues(options: unknown): string[] {
  if (typeof options !== 'string') return []
  return options
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.includes(':') ? line.slice(line.lastIndexOf(':') + 1) : line).trim())
    .filter(Boolean)
}

function hiddenValues(field: FieldBlok): string[] {
  return String(field.placeholder || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

/** The form as the site sees it: linked form (alias) first, then the page block. Same rules as mergeForm. */
export function mergeAlias(blok: FormBlok, aliases: Record<string, FormBlok>): FormBlok {
  const alias = typeof blok.alias === 'string' ? aliases[blok.alias] : undefined
  if (!alias) return blok
  const fields = new Map<string, FieldBlok>()
  for (const f of [...(alias.fields || []), ...(blok.fields || [])]) {
    const key = f.id || f._uid
    if (key && !fields.has(key)) fields.set(key, f)
  }
  return {
    ...blok,
    tracking: normalizeOriginal(alias.tracking) || normalizeOriginal(blok.tracking),
    list: Array.from(new Set([...(blok.list || []), ...(alias.list || [])])),
    fields: Array.from(fields.values()),
  }
}

function normalizeOriginal(tracking: unknown): string | undefined {
  const value = Array.isArray(tracking) ? tracking[0] : tracking
  return typeof value === 'string' && value ? value : undefined
}

/** Every form block in a story content, with a readable path. */
export function findForms(content: unknown, path = ''): Array<{ path: string; blok: FormBlok }> {
  const found: Array<{ path: string; blok: FormBlok }> = []
  const walk = (node: unknown, at: string) => {
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${at}[${i}]`))
      return
    }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.component === 'form') found.push({ path: at, blok: obj as FormBlok })
    for (const [key, value] of Object.entries(obj)) {
      if (value && typeof value === 'object') walk(value, at ? `${at}.${key}` : key)
    }
  }
  walk(content, path)
  return found
}

/** Checks one form (already merged with its alias) against the Brevo attributes. */
export function checkForm(
  form: FormBlok,
  attributes: BrevoAttribute[],
  where: string,
  allowedLists: number[] = []
): Finding[] {
  const findings: Finding[] = []
  const add = (level: Finding['level'], message: string) => findings.push({ level, where, message })
  const byName = new Map(attributes.map((a) => [a.name.toUpperCase(), a]))

  const tracking = normalizeOriginal(form.tracking)
  if (tracking && normalizeTracking(tracking) !== tracking) {
    add('avviso', `tracciamento "${tracking}" da cambiare in "${normalizeTracking(tracking)}" al passaggio a main`)
  } else if (tracking && !TRACKING_VALUES.includes(tracking) && tracking !== 'enroll') {
    add('avviso', `tracciamento "${tracking}" sconosciuto: evento submit_${tracking}_form`)
  }
  if (tracking === 'enroll') add('avviso', 'modulo di richiesta iscrizione: va sostituito dal pulsante di iscrizione online')

  for (const list of form.list || []) {
    const id = Number(list)
    if (allowedLists.length && Number.isInteger(id) && id > 0 && !allowedLists.includes(id)) {
      add('avviso', `lista ${id} non ammessa per i moduli pubblici: il sito la ignora`)
    }
  }

  const ids = new Set((form.fields || []).map((f) => f.id))
  if (normalizeTracking(tracking) === 'brochure' && !(ids.has('interesse_area') && ids.has('interesse_corso'))) {
    add('avviso', 'modulo brochure senza interesse_area e interesse_corso: l’automazione non sa quale presentazione mandare')
  }
  for (const [old, name] of Object.entries(FIELD_RENAMES)) {
    if (ids.has(old)) add('avviso', `campo "${old}" da rinominare in "${name}" al passaggio a main`)
  }

  for (const field of form.fields || []) {
    const id = field.id
    if (!id || NOT_ATTRIBUTES.has(id)) continue
    const name = id.toUpperCase()
    const label = `campo "${id}"`
    if (!isFormWritableAttribute(name)) {
      add('avviso', `${label}: ${name} non si può scrivere da un modulo pubblico, il sito lo scarta`)
      continue
    }
    if (field.input === 'hidden' && !field.hidden) {
      add('errore', `${label}: tipo "hidden" senza la casella Nascosto, il valore non parte mai`)
    }
    const attribute = byName.get(name)
    if (!attribute) {
      add('avviso', `${label}: attributo ${name} assente in Brevo, il dato non viene salvato`)
      continue
    }

    const choice = field.input === 'select' || field.input === 'multiple'
    const values = field.hidden ? hiddenValues(field) : optionValues(field.options)

    if (attribute.category === 'category' && isCategoryAttribute(name)) {
      // The site turns the code into the option id (see @modules/brevo-attributes)
      const codes = Object.keys(CATEGORY_IDS[name])
      for (const value of field.input === 'hidden' ? hiddenValues(field) : values) {
        if (!codes.includes(value)) add('errore', `${label}: valore "${value}" non previsto in ${name} (${codes.join(', ')})`)
      }
    } else if (attribute.category === 'category') {
      add('errore', `${label}: ${name} in Brevo è di tipo categoria (valori numerici), il sito manda testo`)
    } else if (attribute.type === 'multiple-choice') {
      if (!choice && !field.hidden && field.input !== 'enroll') {
        add('errore', `${label}: ${name} in Brevo è a scelta multipla, il campo è "${field.input}" (testo libero)`)
      }
      const allowed = attribute.multiCategoryOptions || []
      for (const value of values) {
        if (!allowed.includes(value)) {
          const near = allowed.find((o) => o.toLowerCase() === value.toLowerCase())
          add(
            'errore',
            `${label}: valore "${value}" non previsto in ${name}${near ? ` (in Brevo è "${near}")` : ''}; Brevo rifiuta il contatto`
          )
        }
      }
    } else if (attribute.type === 'boolean' && field.input !== 'checkbox' && !field.hidden) {
      add('avviso', `${label}: ${name} in Brevo è sì/no, il campo è "${field.input}"`)
    } else if (attribute.type === 'date' && field.input !== 'date' && !field.hidden) {
      add('avviso', `${label}: ${name} in Brevo è una data, il campo è "${field.input}"`)
    } else if (attribute.type === 'float' && field.input !== 'number' && !field.hidden) {
      add('avviso', `${label}: ${name} in Brevo è un numero, il campo è "${field.input}"`)
    }
  }
  return findings
}

/**
 * The option ids the site sends for category attributes (@modules/brevo-attributes)
 * against the options in Brevo: a wrong id would save another value without errors.
 */
export function checkCategoryIds(attributes: BrevoAttribute[]): Finding[] {
  const findings: Finding[] = []
  const byName = new Map(attributes.map((a) => [a.name.toUpperCase(), a]))
  for (const [name, options] of Object.entries(CATEGORY_IDS)) {
    const where = `Brevo ${name}`
    const attribute = byName.get(name)
    if (!attribute) {
      findings.push({ level: 'avviso', where, message: 'attributo assente in Brevo, il dato non viene salvato' })
      continue
    }
    if (attribute.category !== 'category') {
      findings.push({ level: 'errore', where, message: 'in Brevo non è di tipo categoria: il sito manda il numero dell’opzione' })
      continue
    }
    const labels = new Map(
      (attribute.enumeration || []).map((e) => {
        const option = e as { value?: unknown; label?: unknown }
        return [Number(option.value), String(option.label ?? '')]
      })
    )
    for (const [code, id] of Object.entries(options as Record<string, number>)) {
      const label = labels.get(id)
      if (label === code) continue
      if (label !== undefined && name === 'INTERESSE_CORSO' && interestCourse(label) === code) {
        findings.push({ level: 'avviso', where, message: `opzione ${id} "${label}" da rinominare in "${code}"` })
      } else {
        findings.push({
          level: 'errore',
          where,
          message: label === undefined ? `manca l’opzione ${id} "${code}"` : `l’opzione ${id} è "${label}", il sito la usa per "${code}"`,
        })
      }
    }
  }
  return findings
}

/** Checks all the forms of the given stories. `aliases` maps a linked form uuid to its content. */
export function checkForms(
  stories: Array<{ full_slug: string; content: unknown }>,
  aliases: Record<string, FormBlok>,
  attributes: BrevoAttribute[],
  allowedLists: number[] = []
): Finding[] {
  return stories.flatMap((story) =>
    findForms(story.content).flatMap(({ path, blok }) =>
      checkForm(mergeAlias(blok, aliases), attributes, `${story.full_slug} ${path}`.trim(), allowedLists)
    )
  )
}

// ---------------------------------------------------------------------------
// Migration at the switch to main

const LEGACY_TRACKING: Record<string, string> = { download: 'brochure', contact: 'info', open_day: 'openday' }

/** Field ids renamed with the attribute dictionary of 26/10 (the id is the Brevo attribute). */
export const FIELD_RENAMES: Record<string, string> = {
  finalita: 'interesse_scopo',
  area: 'interesse_area',
  sede: 'interesse_sede',
  frequenza: 'interesse_frequenza',
  sessione: 'interesse_inizio',
}

// Forms about other things (requests, projects, jobs, companies, enrollment request) keep their fields
const OTHER_TRACKING = new Set(['info', 'project', 'recruit', 'partnership', 'enroll'])

// Fields that told the area and the course before: they become interesse_area and interesse_corso
const COURSE_FIELDS = ['interesse_area', 'interesse_corso', 'collegamento_materiale', 'area', 'programma']

function areaValue(value: string): string | null {
  const v = value.toLowerCase()
  if (/interni|interior/.test(v)) return 'interior'
  if (/moda|fashion/.test(v)) return 'fashion'
  return null
}

const hiddenField = (id: string, placeholder: string, input = 'multiple'): FieldBlok => ({
  _uid: randomUUID(),
  id,
  input,
  hidden: true,
  label: id,
  placeholder,
  options: '',
  required: false,
  component: 'field',
})

/** The course fields of a form are already in the new shape: hidden interesse_area and interesse_corso with a code. */
function hasNewCourseFields(fields: FieldBlok[]): boolean {
  const area = fields.find((f) => f.id === 'interesse_area')
  const course = fields.find((f) => f.id === 'interesse_corso')
  const others = fields.some((f) => ['collegamento_materiale', 'programma'].includes(String(f.id)) || (f.id === 'area' && f.hidden))
  const codeOk = !course || (!!course.hidden && String(course.placeholder || '') in CATEGORY_IDS.INTERESSE_CORSO)
  const areaOk = !area || !area.hidden || /^(interior|fashion)$/.test(String(area.placeholder || ''))
  const areaVisibleOk = !area || area.hidden || area.input !== 'hidden'
  return !others && codeOk && areaOk && areaVisibleOk
}

/**
 * Changes for one form block:
 * - tracking download/contact/open_day → brochure/info/openday;
 * - area and course of the page as hidden interesse_area (interior, fashion) and
 *   interesse_corso (interior_primo...): from the sede-page fields
 *   interesse_area/interesse_corso/collegamento_materiale (never sent: type
 *   "hidden" without the Hidden box) or from hidden area + programma;
 * - field ids as the attributes of 26/10: finalita → interesse_scopo, area →
 *   interesse_area, sede → interesse_sede, frequenza → interesse_frequenza,
 *   sessione → interesse_inizio (only in brochure, open day and newsletter forms);
 * - fields linked to a multiple-choice attribute: a choice with the Brevo
 *   values (e.g. occupazione, today free text with lowercase options).
 */
export function migrateForm(blok: FormBlok, attributes: BrevoAttribute[]): string[] {
  const changes: string[] = []
  const tracking = normalizeOriginal(blok.tracking)
  if (tracking && LEGACY_TRACKING[tracking]) {
    blok.tracking = LEGACY_TRACKING[tracking]
    changes.push(`tracciamento ${tracking} → ${blok.tracking}`)
  }

  const fields = blok.fields || []
  const courseFields = fields.filter((f) => {
    if (!COURSE_FIELDS.includes(String(f.id))) return false
    // A visible area choice (newsletter) is a renamed field, not the page's course
    return !(f.id === 'area' || f.id === 'interesse_area') || f.hidden || f.input === 'hidden'
  })
  if (courseFields.length && !hasNewCourseFields(fields)) {
    const text = (id: string) => String(fields.find((f) => f.id === id)?.placeholder || '')
    const areaSource = [text('interesse_area'), text('area'), text('interesse_corso'), text('collegamento_materiale')].join(' ')
    const area = areaValue(areaSource)
    const course = interestCourse(areaSource, [text('interesse_corso'), text('programma'), text('collegamento_materiale')].join(' '))
    const kept = fields.filter((f) => !courseFields.includes(f))
    if (area) kept.push(hiddenField('interesse_area', area))
    if (course) kept.push(hiddenField('interesse_corso', course, 'text'))
    blok.fields = kept
    changes.push(
      `campi ${courseFields.map((f) => f.id).join('/')} → interesse_area "${area || ''}" e interesse_corso "${course || ''}" nascosti`
    )
  }

  const normalized = (tracking && normalizeTracking(LEGACY_TRACKING[tracking] || tracking)) || ''
  if (!OTHER_TRACKING.has(normalized)) {
    const ids = new Set((blok.fields || []).map((f) => f.id))
    for (const field of blok.fields || []) {
      const id = field.id || ''
      const name = FIELD_RENAMES[id]
      if (!name || ids.has(name)) continue
      changes.push(`campo ${id} → ${name}`)
      ids.delete(id)
      ids.add(name)
      field.id = name
    }
  }

  const byName = new Map(attributes.map((a) => [a.name.toUpperCase(), a]))
  for (const field of blok.fields || []) {
    const attribute = field.id ? byName.get(field.id.toUpperCase()) : undefined
    if (!attribute || attribute.type !== 'multiple-choice' || field.hidden || !field.options) continue
    const allowed = attribute.multiCategoryOptions || []
    let changed = false
    const options = String(field.options)
      .split('\n')
      .map((line) => {
        const at = line.lastIndexOf(':')
        if (at < 0) return line
        const value = line.slice(at + 1).trim()
        const exact = allowed.find((o) => o.toLowerCase() === value.toLowerCase())
        if (!exact || exact === value) return line
        changed = true
        return `${line.slice(0, at)}:${exact}`
      })
      .join('\n')
    if (changed) {
      field.options = options
      changes.push(`campo ${field.id}: valori come in Brevo`)
    }
    if (field.input !== 'select' && field.input !== 'multiple') {
      changes.push(`campo ${field.id}: tipo ${field.input} → select`)
      field.input = 'select'
    }
  }
  return changes
}

/** The enrollment button that replaces the enrollment request form in the aside. */
export function enrollAction(course: string) {
  const url = `/iscrizione/${course}`
  return {
    _uid: randomUUID(),
    component: 'action',
    label: 'Iscriviti online',
    link: { id: '', url, linktype: 'url', fieldtype: 'multilink', cached_url: url },
    button: true,
    color: 'primary',
    external: false,
    id: '',
  }
}

export function isEnrollFormBlok(blok: unknown, aliases: Record<string, FormBlok>): boolean {
  if (!blok || typeof blok !== 'object') return false
  const form = blok as FormBlok
  if (form.component !== 'form') return false
  return normalizeOriginal(mergeAlias(form, aliases).tracking) === 'enroll'
}

/**
 * All the changes of one story. `course` is the folder of the course for the
 * enrollment button (corso-interior-design-primo-livello), null if not a course page.
 * Changes the content in place and returns what changed.
 */
export function migrateStory(
  content: unknown,
  aliases: Record<string, FormBlok>,
  attributes: BrevoAttribute[],
  course: string | null,
  pageSlug = ''
): string[] {
  const changes: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.component === 'aside' && Array.isArray(obj.forms) && course) {
      let forms: unknown[] = obj.forms.map((f) => {
        if (!isEnrollFormBlok(f, aliases)) return f
        changes.push(`sidebar: modulo di richiesta iscrizione → pulsante /iscrizione/${course}`)
        return enrollAction(course)
      })
      // Every course page gets the enrollment button (it hides itself when seats are over)
      // (the aside takes at most 3 buttons: a full one is left as it is)
      if (!forms.some((f) => isEnrollAction(f as Record<string, unknown>)) && forms.length < 3) {
        forms = [enrollAction(course), ...forms]
        changes.push(`sidebar: aggiunto il pulsante /iscrizione/${course}`)
      }
      obj.forms = forms
      const filter = filterFromPageSlug(pageSlug)
      if (filter && !(typeof obj.filter === 'string' && obj.filter.trim())) {
        obj.filter = filter
        changes.push(`sidebar: filtro edizioni "${filter}"`)
      }
      if (!(typeof obj.price_text === 'string' && obj.price_text.trim())) {
        obj.price_text = DEFAULT_PRICE_TEXT
        changes.push('sidebar: titolo prezzo dal listino')
      }
      // Fields removed from the schema on 26/10: price and editions now come from the new ones
      const removed = ['amount', 'steps', 'courses'].filter((k) => k in obj)
      if (obj.filter && removed.length) {
        removed.forEach((k) => delete obj[k])
        changes.push(`sidebar: tolti i campi vecchi ${removed.join(', ')}`)
      }
    }
    if (obj.component === 'form') changes.push(...migrateForm(obj as FormBlok, attributes))
    for (const value of Object.values(obj)) if (value && typeof value === 'object') walk(value)
  }
  walk(content)
  return changes
}

/** Course folder of a course page: corsi/<area>/corso-x-primo-livello-padova → corso-x-primo-livello. */
export function courseFromPageSlug(fullSlug: string): string | null {
  const match = fullSlug.match(/^corsi\/[^/]+\/(corso-[a-z0-9-]+?)(-(?:padova|treviso|bassano))?\/?$/)
  return match ? match[1] : null
}

/** Component schema changes: new tracking values and actions allowed in the aside buttons. */
export function migrateSchemas(form: { schema: Record<string, any> }, aside: { schema: Record<string, any> }): string[] {
  const changes: string[] = []
  const tracking = form.schema.tracking
  if (tracking && Array.isArray(tracking.options)) {
    const names: Record<string, string> = {
      news: 'Newsletter',
      brochure: 'Brochure',
      info: 'Richiesta informazioni',
      openday: 'Openday',
      project: 'Progetto',
      recruit: 'Assunzione',
      partnership: 'Collaborazione',
    }
    const before = tracking.options.map((o: { value: string }) => o.value).join(',')
    tracking.options = TRACKING_VALUES.map((value) => {
      const existing = tracking.options.find((o: { value: string }) => o.value === value)
      return existing || { _uid: randomUUID(), value, name: names[value] }
    })
    const after = tracking.options.map((o: { value: string }) => o.value).join(',')
    if (before !== after) changes.push(`form.tracking: ${before} → ${after}`)
  }
  const forms = aside.schema.forms
  if (forms && Array.isArray(forms.component_whitelist) && !forms.component_whitelist.includes('action')) {
    forms.component_whitelist = [...forms.component_whitelist, 'action']
    forms.display_name = 'Moduli e pulsanti'
    changes.push('aside.forms: ammesse anche le action (pulsante di iscrizione)')
  }
  return changes
}
