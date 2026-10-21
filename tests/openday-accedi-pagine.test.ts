import type { GetServerSidePropsContext } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pagine miia.it/open-day/accedi e /open-day/accedi/<codice> (PR #72): dove portano
// e cosa arriva al browser. Il link della call non deve mai stare nella pagina.
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    getContact: vi.fn(),
    upsertContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})

import { getServerSideProps as senzaCodice } from '@pages/open-day/accedi/index'
import { getServerSideProps as conCodice } from '@pages/open-day/accedi/[codice]'
import { BrevoError, getContact } from '@modules/brevo'
import { parseInizio } from '@modules/openday-accesso'

const evento = (slug: string, date: string, openday = 'interni - primo livello') => ({
  slug,
  name: slug,
  content: { date, title: `Open day ${slug}`, openday, link_meet: 'https://meet.google.com/segreto' },
})

const INTERNI_NOV = evento('openday-interni-novembre', '2026-11-16 21:00')
const MODA_NOV = evento('openday-moda-novembre', '2026-11-16 21:00', 'moda')
const INTERNI_DIC = evento('openday-interni-dicembre', '2026-12-14 21:00')

function context(params: Record<string, string>, query: Record<string, string> = {}) {
  const headers: Record<string, string> = {}
  return {
    ctx: {
      params,
      query,
      res: { setHeader: (k: string, v: string) => (headers[k] = v) },
    } as unknown as GetServerSidePropsContext,
    headers,
  }
}

const storie = (stories: unknown[]) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ stories }))))

const alle = (quando: string) => vi.useFakeTimers({ now: parseInizio(quando)!, toFake: ['Date'] })

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token')
  vi.mocked(getContact).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('/open-day/accedi senza codice', () => {
  it('con l’email nel link porta all’open day salvato nel contatto (OD_CODICE)', async () => {
    storie([INTERNI_NOV, MODA_NOV])
    vi.mocked(getContact).mockResolvedValue({ attributes: { OD_CODICE: 'openday-moda-novembre' } } as never)
    const { ctx, headers } = context({}, { email: 'Test@Miia.it' })
    const result = await senzaCodice(ctx)
    expect(result).toEqual({
      redirect: { destination: '/open-day/accedi/openday-moda-novembre?email=test%40miia.it', permanent: false },
    })
    expect(headers['Cache-Control']).toBe('no-store')
  })

  it('senza email e con un solo open day stasera porta a quello', async () => {
    alle('2026-11-16 18:00')
    storie([INTERNI_NOV, INTERNI_DIC])
    const { ctx } = context({})
    expect(await senzaCodice(ctx)).toEqual({
      redirect: { destination: '/open-day/accedi/openday-interni-novembre', permanent: false },
    })
  })

  it('con due open day stasera o un’email sconosciuta non indovina', async () => {
    alle('2026-11-16 18:00')
    storie([INTERNI_NOV, MODA_NOV])
    vi.mocked(getContact).mockRejectedValue(new BrevoError(404, 'Contact not found'))
    const { ctx } = context({}, { email: 'nuovo@miia.it' })
    expect(await senzaCodice(ctx)).toEqual({
      redirect: { destination: '/open-day/accedi/non-trovato?email=nuovo%40miia.it', permanent: false },
    })
  })
})

describe('/open-day/accedi/<codice>', () => {
  it('mostra data e titolo ma non manda mai al browser il link della call', async () => {
    alle('2026-11-16 21:00')
    storie([INTERNI_NOV])
    const { ctx, headers } = context({ codice: 'openday-interni-novembre' }, { email: 'test@miia.it' })
    const result = (await conCodice(ctx)) as { props: any }
    expect(result.props.evento).toMatchObject({
      codice: 'openday-interni-novembre',
      quando: 'lunedì 16 novembre alle 21:00',
    })
    expect(result.props.email).toBe('test@miia.it')
    expect(result.props.prossimo).toBeNull()
    expect(JSON.stringify(result.props)).not.toContain('meet.google.com')
    expect(headers['Cache-Control']).toBe('no-store')
  })

  it('a open day finito propone il prossimo della stessa area con l’iscrizione già pronta', async () => {
    alle('2026-11-16 22:30')
    storie([INTERNI_NOV, MODA_NOV, INTERNI_DIC])
    const { ctx } = context({ codice: 'openday-interni-novembre' }, { email: 'test@miia.it' })
    const result = (await conCodice(ctx)) as { props: any }
    expect(result.props.prossimo).toMatchObject({
      codice: 'openday-interni-dicembre',
      iscrizione: '/api/openday/registrazione?email=test%40miia.it&area=interni',
    })
  })

  it('codice sconosciuto o Storyblok non raggiungibile: pagina "Open day non trovato"', async () => {
    storie([INTERNI_NOV])
    expect(((await conCodice(context({ codice: 'non-trovato' }).ctx)) as { props: any }).props.evento).toBeNull()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    expect(((await conCodice(context({ codice: 'openday-interni-novembre' }).ctx)) as { props: any }).props.evento).toBeNull()
  })
})
