import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    getContact: vi.fn(),
    upsertContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})

import handler from '@pages/api/openday/accedi'
import { BrevoError, getContact, trackEvent, upsertContact } from '@modules/brevo'
import {
  fase,
  inRitardo,
  normalizeCodice,
  parseInizio,
  quandoTesto,
  scadenzaOfferta,
  scadenzaTesto,
  stasera,
  toEvento,
} from '@modules/openday-accesso'

const NOVEMBRE = {
  slug: 'openday-interni-novembre',
  name: 'openday-interni-novembre',
  content: {
    date: '2026-11-16 21:00',
    title: 'Open day interior design',
    openday: 'interni - primo livello',
    link_meet: 'https://meet.google.com/abc-defg-hij',
  },
}

describe('orari dell’open day', () => {
  it('legge la data di Storyblok come ora italiana (inverno e estate)', () => {
    expect(parseInizio('2026-11-16 21:00')?.toISOString()).toBe('2026-11-16T20:00:00.000Z')
    expect(parseInizio('2026-06-15 21:00')?.toISOString()).toBe('2026-06-15T19:00:00.000Z')
    expect(parseInizio('2026-11-16T20:00:00Z')?.toISOString()).toBe('2026-11-16T20:00:00.000Z')
    expect(parseInizio('')).toBeNull()
    expect(parseInizio('domani')).toBeNull()
  })

  it('apre 15 minuti prima, segna il ritardo dopo 15 minuti, chiude dopo un’ora', () => {
    const inizio = parseInizio('2026-11-16 21:00')!
    const alle = (hhmm: string) => parseInizio(`2026-11-16 ${hhmm}`)!
    expect(fase(inizio, alle('20:44'))).toBe('presto')
    expect(fase(inizio, alle('20:45'))).toBe('aperto')
    expect(fase(inizio, alle('21:59'))).toBe('aperto')
    expect(fase(inizio, alle('22:00'))).toBe('finito')
    expect(inRitardo(inizio, alle('21:15'))).toBe(false)
    expect(inRitardo(inizio, alle('21:16'))).toBe(true)
  })

  it('scrive scadenza e data come nelle email', () => {
    const inizio = parseInizio('2026-11-16 21:00')!
    expect(scadenzaOfferta(inizio)).toBe('2026-11-30')
    expect(scadenzaTesto(inizio)).toBe('30 novembre')
    expect(quandoTesto(inizio)).toBe('lunedì 16 novembre alle 21:00')
  })

  it('accetta solo codici semplici e solo eventi open day', () => {
    expect(normalizeCodice('Openday-Interni-Novembre')).toBe('openday-interni-novembre')
    expect(normalizeCodice('../admin')).toBeNull()
    expect(toEvento(NOVEMBRE)?.area).toBe('interni')
    expect(toEvento({ ...NOVEMBRE, name: 'evento-sede' })).toBeNull()
  })

  it('trova gli open day della prima sera in calendario', () => {
    const interni = toEvento(NOVEMBRE)!
    const moda = toEvento({
      ...NOVEMBRE,
      slug: 'openday-moda-novembre',
      name: 'openday-moda-novembre',
    })!
    const dicembre = toEvento({
      ...NOVEMBRE,
      slug: 'openday-interni-dicembre',
      content: { ...NOVEMBRE.content, date: '2026-12-14 21:00' },
    })!
    const now = parseInizio('2026-11-16 18:00')!
    expect(stasera([interni, moda, dicembre], now).map((e) => e.codice)).toEqual([
      'openday-interni-novembre',
      'openday-moda-novembre',
    ])
  })
})

function call(body: unknown, method = 'POST') {
  const req = { method, body } as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, unknown>,
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
  }
  return handler(req, res as unknown as NextApiResponse).then(() => res)
}

describe('/api/openday/accedi', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ stories: [NOVEMBRE] })))
    )
    vi.mocked(getContact).mockReset()
    vi.mocked(trackEvent).mockReset()
    vi.mocked(upsertContact)
      .mockReset()
      .mockResolvedValue(undefined as never)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  const at = (hhmm: string) =>
    vi.useFakeTimers({
      now: parseInizio(`2026-11-16 ${hhmm}`)!,
      toFake: ['Date'],
    })

  it('prima delle 20:45 non dà il link', async () => {
    at('20:30')
    const res = await call({
      codice: 'openday-interni-novembre',
      email: 'test@miia.it',
    })
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ fase: 'presto' })
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('in orario segna la presenza e dà il prezzo riservato a chi ha OD_VALIDO', async () => {
    at('21:05')
    vi.mocked(getContact).mockResolvedValue({
      attributes: { OD_VALIDO: true },
    } as never)
    const res = await call({
      codice: 'openday-interni-novembre',
      email: 'Test@Miia.it',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body.link).toBe('https://meet.google.com/abc-defg-hij')
    expect(upsertContact).toHaveBeenCalledWith({
      email: 'test@miia.it',
      attributes: {
        PARTECIPAZIONE_OPENDAY: true,
        OD_RITARDO: false,
        DATA_PRESENZA: '2026-11-16',
        OD_SCADENZA_TESTO: '30 novembre',
        SCADENZA_OFFERTA: '2026-11-30',
      },
    })
  })

  it('chi entra dopo le 21:15 è in ritardo e non riceve il prezzo riservato', async () => {
    at('21:20')
    vi.mocked(getContact).mockResolvedValue({
      attributes: { OD_VALIDO: true },
    } as never)
    await call({ codice: 'openday-interni-novembre', email: 'test@miia.it' })
    const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes!
    expect(attributes.OD_RITARDO).toBe(true)
    expect(attributes.SCADENZA_OFFERTA).toBeUndefined()
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'submit_presence_form',
      email: 'test@miia.it',
      properties: { openday: '2026-11-16', openday_codice: 'openday-interni-novembre', ritardo: true },
    })
  })

  it('un’email sconosciuta entra lo stesso ma non crea contatti', async () => {
    at('21:00')
    vi.mocked(getContact).mockRejectedValue(new BrevoError(404, 'Contact not found'))
    const res = await call({
      codice: 'openday-interni-novembre',
      email: 'nuovo@miia.it',
    })
    expect(res.statusCode).toBe(200)
    expect(upsertContact).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('rifiuta codici sconosciuti e richieste non POST', async () => {
    at('21:00')
    expect((await call({ codice: 'openday-moda-novembre', email: 'test@miia.it' })).statusCode).toBe(404)
    expect((await call({}, 'GET')).statusCode).toBe(405)
  })
})
