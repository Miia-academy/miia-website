import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Iscrizione all'open day con un clic dal link delle email (PR #58, #72):
// il link non iscrive nessuno, la conferma sì, e salva il codice per la pagina accedi.
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    getContact: vi.fn(),
    upsertContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})

// Open day details (OD_*, PREZZO_*) are tested in openday-details.test.ts
vi.mock('@modules/openday-details', () => ({ loadOpendayDetails: vi.fn() }))

import handler from '@pages/api/openday/registrazione'
import { BrevoError, trackEvent, upsertContact } from '@modules/brevo'
import { loadOpendayDetails } from '@modules/openday-details'

const SECRET = 'segreto-di-prova'
const COOKIE = 'miia_openday_richiesta'

const EVENTI = [
  { name: 'openday-moda-novembre', slug: 'openday-moda-novembre', content: { date: '2026-11-17T20:00:00.000Z' } },
  { name: 'openday-interni-novembre', slug: 'openday-interni-novembre', content: { date: '2026-11-16T20:00:00.000Z' } },
  { name: 'openday-interni-ottobre', slug: 'openday-interni-ottobre', content: { date: '2026-10-12T19:00:00.000Z' } },
]

function call({
  method = 'POST',
  query = {},
  cookies = {},
}: {
  method?: string
  query?: Record<string, string>
  cookies?: Record<string, string>
}) {
  const req = { method, query, cookies, body: {} } as unknown as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, any>,
    redirectedTo: '',
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(data: unknown) {
      this.body = data
      return this
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value
      return this
    },
    redirect(code: number, url: string) {
      this.statusCode = code
      this.redirectedTo = url
      return this
    },
  }
  return Promise.resolve(handler(req, res as unknown as NextApiResponse)).then(() => res)
}

const richiesta = (email: string, area = '') => jwt.sign({ purpose: 'openday', email, area }, SECRET)

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', SECRET)
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ stories: EVENTI }))))
  vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00Z'), toFake: ['Date'] })
  vi.mocked(upsertContact).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(loadOpendayDetails).mockReset().mockResolvedValue({})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
})

describe('GET /api/openday/registrazione (link nelle email)', () => {
  it('non iscrive: ricorda la richiesta in un cookie firmato e porta alla conferma', async () => {
    const res = await call({ method: 'GET', query: { email: ' Test@Miia.it ', area: 'interni' } })
    expect(res.statusCode).toBe(302)
    expect(res.redirectedTo).toBe('/conferma?type=openday&status=confirm&area=interni')
    expect(res.headers['Set-Cookie']).toMatch(new RegExp(`^${COOKIE}=.+; Path=/; HttpOnly; SameSite=Lax; Max-Age=1800`))
    const token = String(res.headers['Set-Cookie']).split(';')[0].split('=')[1]
    expect(jwt.verify(token, SECRET)).toMatchObject({ purpose: 'openday', email: 'test@miia.it', area: 'interni' })
    // L'email non viaggia nell'indirizzo della pagina di conferma
    expect(res.redirectedTo).not.toContain('miia.it')
    expect(upsertContact).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('con un’email non valida torna alla home', async () => {
    const res = await call({ method: 'GET', query: { email: 'non-valida' } })
    expect(res.redirectedTo).toBe('/')
    expect(res.headers['Set-Cookie']).toBeUndefined()
  })
})

describe('POST /api/openday/registrazione (pulsante "Confermo la partecipazione")', () => {
  it('adds the open day details (OPENDAY_*, INTERESSE_CORSO) to the contact', async () => {
    vi.mocked(loadOpendayDetails).mockResolvedValueOnce({ OPENDAY_VALIDO: true, INTERESSE_CORSO: 1 })
    await call({ cookies: { [COOKIE]: richiesta('test@miia.it', 'interni') } })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toMatchObject({
      OPENDAY_CODICE: 'openday-interni-novembre',
      OPENDAY_VALIDO: true,
      INTERESSE_CORSO: 1,
    })
  })

  it('senza la richiesta firmata non iscrive', async () => {
    expect((await call({})).statusCode).toBe(400)
    expect((await call({ cookies: { [COOKIE]: jwt.sign({ purpose: 'login', email: 'a@b.it' }, SECRET) } })).statusCode).toBe(400)
    expect((await call({ cookies: { [COOKIE]: jwt.sign({ purpose: 'openday', email: 'a@b.it' }, 'altro') } })).statusCode).toBe(400)
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('iscrive al prossimo open day dell’area: lista 16, OPENDAY_CODICE, presenza e ritardo azzerati, evento submit_openday_form', async () => {
    const res = await call({ cookies: { [COOKIE]: richiesta('test@miia.it', 'interni') } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, openday_data: '16 novembre 2026' })
    expect(upsertContact).toHaveBeenCalledWith({
      email: 'test@miia.it',
      listIds: [16],
      attributes: {
        OPENDAY_DATA: '2026-11-16',
        OPENDAY_CODICE: 'openday-interni-novembre',
        OPENDAY_PRESENTE: false,
        OPENDAY_RITARDO: false,
        INTERESSE_AREA: ['interior'],
      },
    })
    expect(loadOpendayDetails).toHaveBeenCalledWith('openday-interni-novembre')
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'submit_openday_form',
      email: 'test@miia.it',
      properties: {
        area: 'interior',
        openday: '2026-11-16',
        openday_data: '16 novembre 2026',
        openday_codice: 'openday-interni-novembre',
      },
    })
    // La richiesta è usata: il cookie si cancella
    expect(res.headers['Set-Cookie']).toMatch(new RegExp(`^${COOKIE}=; .*Max-Age=0`))
  })

  it('ignora gli open day già passati e senza area sceglie il primo in calendario', async () => {
    await call({ cookies: { [COOKIE]: richiesta('test@miia.it') } })
    const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes!
    expect(attributes.OPENDAY_CODICE).toBe('openday-interni-novembre')
  })

  it('se Brevo rifiuta un attributo (non ancora creato) l’iscrizione resta, con la sola lista', async () => {
    vi.mocked(upsertContact).mockRejectedValueOnce(new BrevoError(400, 'Attribute not found'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await call({ cookies: { [COOKIE]: richiesta('test@miia.it', 'interni') } })
    expect(res.statusCode).toBe(200)
    expect(upsertContact).toHaveBeenLastCalledWith({ email: 'test@miia.it', listIds: [16], attributes: {} })
  })

  it('se Storyblok o Brevo non rispondono la persona riceve un errore', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    const res = await call({ cookies: { [COOKIE]: richiesta('test@miia.it', 'moda') } })
    expect(res.statusCode).toBe(502)
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('accetta solo GET e POST', async () => {
    expect((await call({ method: 'PUT' })).statusCode).toBe(405)
  })
})
