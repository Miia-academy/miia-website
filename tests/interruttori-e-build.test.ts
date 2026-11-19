import type { NextApiRequest, NextApiResponse } from 'next'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// L'iscrizione online resta invisibile finché ENROLLMENT_ONLINE non è "on" (PR #65):
// develop si può portare in produzione anche con l'interruttore spento.
const storyblok = vi.fn()
vi.mock('@storyblok/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@storyblok/react')>()),
  getStoryblokApi: () => ({ getStories: storyblok }),
}))

const API = [
  ['bozza', () => import('@pages/api/iscrizione/bozza')],
  ['codice', () => import('@pages/api/iscrizione/codice')],
  ['condizioni', () => import('@pages/api/iscrizione/condizioni')],
  ['offerta', () => import('@pages/api/iscrizione/offerta')],
  ['posti', () => import('@pages/api/iscrizione/posti')],
  ['verifica', () => import('@pages/api/iscrizione/verifica')],
  ['documenti/link', () => import('@pages/api/iscrizione/documenti/link')],
  ['documenti/conferma', () => import('@pages/api/iscrizione/documenti/conferma')],
  ['firma/codice', () => import('@pages/api/iscrizione/firma/codice')],
  ['firma/conferma', () => import('@pages/api/iscrizione/firma/conferma')],
] as const

async function call(handler: (req: NextApiRequest, res: NextApiResponse) => unknown, method: string) {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json() {
      return this
    },
    setHeader() {
      return this
    },
  }
  await handler({ method, query: {}, body: {}, cookies: {}, headers: {} } as unknown as NextApiRequest, res as any)
  return res.statusCode
}

describe('interruttore ENROLLMENT_ONLINE', () => {
  it.each(API)('spento: /api/iscrizione/%s risponde 404 a ogni metodo', async (_, load) => {
    const { default: handler } = await load()
    for (const method of ['GET', 'POST', 'PUT']) {
      expect(await call(handler as any, method)).toBe(404)
    }
  })

  it('spento: la pagina /iscrizione/<corso> non esiste e non legge Storyblok', async () => {
    const { getStaticProps } = await import('@pages/iscrizione/[corso]')
    const result = await getStaticProps({ params: { corso: 'corso-interior-design-primo-livello' } } as any)
    expect(result).toMatchObject({ notFound: true })
    expect(storyblok).not.toHaveBeenCalled()
  })

  it('acceso: la pagina esiste solo per i corsi con un’edizione in Storyblok', async () => {
    vi.stubEnv('ENROLLMENT_ONLINE', 'on')
    storyblok.mockResolvedValue({
      data: { stories: [{ full_slug: 'corsi/interni/corso-interior-design-primo-livello/treviso-sabato' }] },
    })
    const { getStaticProps } = await import('@pages/iscrizione/[corso]')
    const ok = (await getStaticProps({ params: { corso: 'corso-interior-design-primo-livello' } } as any)) as any
    expect(ok.props.corso).toBe('corso-interior-design-primo-livello')
    const missing = await getStaticProps({ params: { corso: 'corso-che-non-esiste' } } as any)
    expect(missing).toMatchObject({ notFound: true })
  })
})

// Build su Vercel (PR #62): sul ramo develop i test girano prima della build e la
// fermano se falliscono; su main e sugli altri rami solo la build.
describe('build su Vercel (scripts/vercel-build.mjs)', () => {
  const script = fileURLToPath(new URL('../scripts/vercel-build.mjs', import.meta.url))

  function build(branch: string, failing = '') {
    const dir = mkdtempSync(join(tmpdir(), 'vercel-build-'))
    const log = join(dir, 'log')
    // npm finto: scrive il comando ricevuto e fallisce sullo script indicato
    const npm = join(dir, 'npm')
    writeFileSync(
      npm,
      `#!/bin/sh\necho "$2" >> "${log}"\n[ "$2" = "${failing}" ] && exit 1\nexit 0\n`
    )
    chmodSync(npm, 0o755)
    writeFileSync(log, '')
    const result = spawnSync(process.execPath, [script], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, VERCEL_GIT_COMMIT_REF: branch },
      encoding: 'utf8',
    })
    return { status: result.status, steps: readFileSync(log, 'utf8').trim().split('\n').filter(Boolean) }
  }

  it('develop: prima i test, poi la build', () => {
    expect(build('develop')).toEqual({ status: 0, steps: ['test', 'build'] })
  })

  it('develop con un test rosso: la build non parte', () => {
    expect(build('develop', 'test')).toEqual({ status: 1, steps: ['test'] })
  })

  it('main e rami di lavoro: solo la build', () => {
    expect(build('main')).toEqual({ status: 0, steps: ['build'] })
    expect(build('sito/qualcosa')).toEqual({ status: 0, steps: ['build'] })
  })
})
