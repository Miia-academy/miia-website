import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return { ...actual, getContact: vi.fn(), upsertContact: vi.fn(), trackEvent: vi.fn() }
})
vi.mock('@modules/openday-details', () => ({ loadOpendayDetails: vi.fn(async () => ({})) }))

import handler from '@pages/api/crm'
import { BrevoError, getContact, upsertContact, trackEvent } from '@modules/brevo'
import { domandaIscrizione, svuotaCacheVoci } from '@modules/openday-domande'
import { eventParts } from '@modules/next-event'

const voci = ['programma', 'costi', 'orari', 'sbocchi', 'attestato']

function call(body: unknown) {
  const req = { method: 'POST', body } as NextApiRequest
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
  return handler(req, res as unknown as NextApiResponse).then(() => res)
}

beforeEach(() => {
  svuotaCacheVoci()
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token-di-prova')
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ datasource_entries: voci.map((name) => ({ name })) }))),
  )
  vi.mocked(getContact).mockReset().mockRejectedValue(new BrevoError(404, 'Contact not found'))
  vi.mocked(upsertContact).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('domandaIscrizione', () => {
  it('accetta solo le voci del datasource "Domande open day"', async () => {
    expect(await domandaIscrizione('costi')).toBe('costi')
    expect(await domandaIscrizione(['Orari'])).toBe('orari')
    expect(await domandaIscrizione('qualsiasi')).toBeNull()
    expect(await domandaIscrizione('<script>')).toBeNull()
    expect(await domandaIscrizione(undefined)).toBeNull()
  })

  it('se Storyblok non risponde non scrive nulla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })))
    expect(await domandaIscrizione('costi')).toBeNull()
  })
})

describe('/api/crm con "Cosa vuoi approfondire?"', () => {
  it("iscrizione all'open day: salva OPENDAY_DOMANDA", async () => {
    await call({
      contact: { email: 'test+gtm@miia.it', attributes: { NOME: 'Prova', OPENDAY_DOMANDA: 'sbocchi' } },
      event: { event_name: 'submit_openday_form' },
    })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toMatchObject({ OPENDAY_DOMANDA: 'sbocchi' })
  })

  it('valore non previsto: OPENDAY_DOMANDA resta com’è', async () => {
    await call({
      contact: { email: 'test+gtm@miia.it', attributes: { NOME: 'Prova', OPENDAY_DOMANDA: 'inventata' } },
      event: { event_name: 'submit_openday_form' },
    })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).not.toHaveProperty('OPENDAY_DOMANDA')
  })

  it('gli altri moduli non possono scriverla', async () => {
    await call({
      contact: { email: 'test+gtm@miia.it', attributes: { NOME: 'Prova', OPENDAY_DOMANDA: 'costi' } },
      event: { event_name: 'submit_brochure_form' },
    })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).not.toHaveProperty('OPENDAY_DOMANDA')
  })
})

describe('eventParts (campo "Versione" dell\'alias)', () => {
  it('vuoto: come prima, docenti solo con "Mostra persone", agevolazione solo con iscrizione', () => {
    expect(eventParts({ persone: true })).toEqual({
      data: true,
      titolo: true,
      descrizione: true,
      docenti: true,
      agevolazione: false,
      pulsante: true,
      modulo: false,
    })
    expect(eventParts({}).docenti).toBe(false)
    expect(eventParts({ submit: [{}] })).toMatchObject({ pulsante: false, agevolazione: true })
  })

  it('collegamento: pulsante verso la pagina, niente form, docenti né agevolazione', () => {
    expect(eventParts({ versione: 'collegamento', persone: true, submit: [{}] })).toMatchObject({
      pulsante: true,
      modulo: false,
      docenti: false,
      agevolazione: false,
      descrizione: false,
    })
  })

  it('registrazione: form, docenti e agevolazione, senza pulsante', () => {
    expect(eventParts({ versione: 'registrazione' })).toMatchObject({
      pulsante: false,
      modulo: true,
      docenti: true,
      agevolazione: true,
      descrizione: true,
    })
  })
})
