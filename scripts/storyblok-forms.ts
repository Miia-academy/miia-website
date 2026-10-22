/**
 * Storyblok forms and Brevo attributes (Ambito 3, 22/10).
 *
 *   npm run forms:check            read-only: forms against the Brevo attributes
 *   npm run forms:migrate          shows the Storyblok changes for the switch to main
 *   npm run forms:migrate -- --apply   applies them (shared space: only at the switch!)
 *
 * Needs STORYBLOK_MANAGEMENT and BREVO_MANAGEMENT (or BREVO_TOKEN) in .env.local.
 * Exit code 1 when the check finds errors, so it can run before a release.
 */
import { config } from 'dotenv'
import { getAllowedLists } from '@modules/crm-form'
import {
  checkForms,
  courseFromPageSlug,
  migrateSchemas,
  migrateStory,
  type BrevoAttribute,
  type FormBlok,
} from '@modules/forms-brevo'
import { courseFromEditionSlug } from '@modules/enrollment/courses'

config({ path: '.env.local' })
config()

const SPACE = 311109
const MAPI = `https://mapi.storyblok.com/v1/spaces/${SPACE}`

interface Story {
  id: number
  uuid: string
  full_slug: string
  published?: boolean
  unpublished_changes?: boolean
  content: Record<string, unknown>
}

function env(...names: string[]): string {
  for (const name of names) if (process.env[name]) return process.env[name] as string
  throw new Error(`Missing ${names.join(' or ')} in .env.local`)
}

async function storyblok<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MAPI}${path}`, {
    ...init,
    headers: { Authorization: env('STORYBLOK_MANAGEMENT'), 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Storyblok ${init.method || 'GET'} ${path}: ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

async function brevoAttributes(): Promise<BrevoAttribute[]> {
  const res = await fetch('https://api.brevo.com/v3/contacts/attributes', {
    headers: { 'api-key': env('BREVO_MANAGEMENT', 'BREVO_TOKEN'), Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Brevo attributes: ${res.status}`)
  return ((await res.json()) as { attributes: BrevoAttribute[] }).attributes
}

/** Every story with a form, with its full content. */
async function formStories(): Promise<Story[]> {
  const ids: number[] = []
  for (let page = 1; ; page++) {
    const data = await storyblok<{ stories: Array<{ id: number }> }>(
      `/stories?contain_component=form&per_page=100&page=${page}`
    )
    ids.push(...data.stories.map((s) => s.id))
    if (data.stories.length < 100) break
  }
  const stories: Story[] = []
  for (const id of ids) stories.push((await storyblok<{ story: Story }>(`/stories/${id}`)).story)
  return stories
}

function aliasesOf(stories: Story[]): Record<string, FormBlok> {
  return Object.fromEntries(
    stories.filter((s) => s.content?.component === 'form').map((s) => [s.uuid, s.content as unknown as FormBlok])
  )
}

/** Course folder for the enrollment button: from the editions of the aside, else from the page slug. */
async function courseOf(story: Story): Promise<string | null> {
  const asides: Array<{ courses?: unknown }> = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    if (obj.component === 'aside') asides.push(obj)
    Object.values(obj).forEach((v) => v && typeof v === 'object' && walk(v))
  }
  walk(story.content)
  const uuids = asides.flatMap((a) => (Array.isArray(a.courses) ? a.courses : [])).filter((u) => typeof u === 'string')
  if (uuids.length) {
    const data = await storyblok<{ stories: Array<{ full_slug: string }> }>(`/stories?by_uuids=${uuids.join(',')}`)
    const course = data.stories.map((s) => courseFromEditionSlug(s.full_slug)).find(Boolean)
    if (course) return course
  }
  return courseFromPageSlug(story.full_slug)
}

async function check() {
  const [stories, attributes] = await Promise.all([formStories(), brevoAttributes()])
  const findings = checkForms(stories, aliasesOf(stories), attributes, getAllowedLists())
  for (const f of findings) console.log(`${f.level === 'errore' ? '✗' : '!'} ${f.where}: ${f.message}`)
  const errors = findings.filter((f) => f.level === 'errore').length
  console.log(`\n${stories.length} storie con moduli, ${errors} errori, ${findings.length - errors} avvisi.`)
  if (errors) process.exitCode = 1
}

async function migrate(apply: boolean) {
  const [stories, attributes] = await Promise.all([formStories(), brevoAttributes()])
  const aliases = aliasesOf(stories)

  const components = (await storyblok<{ components: Array<{ id: number; name: string; schema: Record<string, any> }> }>(
    '/components'
  )).components
  const form = components.find((c) => c.name === 'form')
  const aside = components.find((c) => c.name === 'aside')
  if (!form || !aside) throw new Error('Components form/aside not found')
  const schemaChanges = migrateSchemas(form, aside)
  schemaChanges.forEach((c) => console.log(`schema: ${c}`))

  const planned: Array<{ story: Story; changes: string[] }> = []
  for (const story of stories) {
    const course = story.full_slug.startsWith('corsi/') ? await courseOf(story) : null
    const changes = migrateStory(story.content, aliases, attributes, course)
    if (changes.length) planned.push({ story, changes })
  }
  for (const { story, changes } of planned) {
    console.log(`\n${story.full_slug}${story.published ? '' : ' (non pubblicata)'}`)
    changes.forEach((c) => console.log(`  - ${c}`))
  }

  if (!apply) {
    console.log('\nNessuna modifica scritta. Per applicarle: npm run forms:migrate -- --apply')
    return
  }
  // Schemas first, so the new tracking values and the aside actions are valid.
  for (const c of [form, aside]) {
    await storyblok(`/components/${c.id}`, { method: 'PUT', body: JSON.stringify({ component: c }) })
  }
  for (const { story } of planned) {
    // Published stories without pending drafts are published again; drafts stay drafts.
    const publish = story.published && !story.unpublished_changes ? 1 : 0
    await storyblok(`/stories/${story.id}`, {
      method: 'PUT',
      body: JSON.stringify({ story: { content: story.content }, publish }),
    })
    console.log(`scritta ${story.full_slug}${publish ? ' e pubblicata' : ''}`)
  }
}

const [command, flag] = process.argv.slice(2)
const run = command === 'check' ? check() : command === 'migrate' ? migrate(flag === '--apply') : null
if (!run) {
  console.log('Uso: tsx scripts/storyblok-forms.ts check | migrate [--apply]')
  process.exitCode = 1
} else {
  run.catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
