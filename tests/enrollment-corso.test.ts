import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/enrollment/db', () => ({
  getEnrollment: vi.fn(),
  saveCorso: vi.fn(),
  saveChiSei: vi.fn(),
  logEvent: vi.fn(),
  countSignedByEdition: vi.fn(),
}))
vi.mock('@modules/enrollment/load-offer', () => ({ loadOffer: vi.fn() }))
vi.mock('@modules/enrollment/contact', () => ({ syncContact: vi.fn() }))

import bozza from '@pages/api/iscrizione/bozza'
import offerta from '@pages/api/iscrizione/offerta'
import posti from '@pages/api/iscrizione/posti'
import * as db from '@modules/enrollment/db'
import { loadOffer } from '@modules/enrollment/load-offer'
import { parsePriceList, toEdition, type Edition } from '@modules/enrollment/catalog'
import { buildOffer, openEditions } from '@modules/enrollment/offer'
import { SESSION_COOKIE, signSession } from '@modules/enrollment/session'
import { seatsLabel } from '@components/enrollment/use-seats'
import type { Enrollment, PriceList } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'
const UUID = '11111111-2222-4333-8444-555555555555'
const LIST: PriceList = { unica: 5490, rata5: 1140, rata10: 594, offerta: 4990, esame: 366 }
const NOW = new Date('2026-10-14T08:00:00Z')

const edition = (over: Partial<Edition> = {}): Edition => ({
  chiave: `${UUID}:2026-11-07`,
  titolo: 'Treviso sabato',
  sede: 'Treviso',
  giorni: ['Sabato'],
  orari: ['9:00/12:00'],
  inizio: '2026-11-07',
  fine: '2027-06-26',
  posti: 20,
  ...over,
})

function row(over: Partial<Enrollment> = {}): Enrollment {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: EMAIL,
    corso: CORSO,
    canale: 'sito',
    stato: 'bozza',
    sezioni_complete: ['chi_sei'],
    nome: 'Mario',
    cognome: 'Rossi',
    telefono: '+393331234567',
    edizione_chiave: null,
    pagamento_modalita: null,
    pagamento_rata: null,
    pagamento_totale: null,
    offerta_open_day: false,
    dati: {},
    profilo: {},
    consensi: {},
    documenti: {},
    firmata_il: null,
    fine_recesso: null,
    creata_il: '2026-10-14T08:00:00Z',
    aggiornata_il: '2026-10-14T08:00:00Z',
    ...over,
  }
}

function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  { method = 'GET', body = {}, query = {}, cookies = {} }: { method?: string; body?: unknown; query?: Record<string, string>; cookies?: Record<string, string> } = {}
) {
  const req = { method, body, query, cookies, headers: {}, url: '/api/iscrizione' } as unknown as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, unknown>,
    headersSent: false,
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
  return Promise.resolve(handler(req, res as unknown as NextApiResponse)).then(() => res)
}

const cookie = () => ({ [SESSION_COOKIE]: signSession({ id: row().id, email: EMAIL, corso: CORSO }) })

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  vi.mocked(loadOffer).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('listino dal datasource Storyblok', () => {
  it('legge le voci del listino', () => {
    const entries = [
      { name: 'prezzo_unica', value: '5490' },
      { name: 'rata_5', value: '1.140,00' },
      { name: 'rata_10', value: '594' },
      { name: 'prezzo_open_day', value: '€ 4990' },
      { name: 'quota_esame', value: '366' },
      { name: 'giorni_offerta', value: '14' },
    ]
    expect(parsePriceList(entries)).toEqual(LIST)
  })

  it('senza una voce il listino non vale', () => {
    expect(parsePriceList([{ name: 'prezzo_unica', value: '5490' }])).toBeNull()
    expect(parsePriceList([])).toBeNull()
  })
})

describe('edizioni da Storyblok', () => {
  const locations = new Map([['loc-tv', 'Treviso']])
  const story = (content: Record<string, unknown>) => ({ uuid: UUID, full_slug: 'corsi/x/corso-x/y/z', content })

  it('legge sede, giorni, orari, date e posti', () => {
    const e = toEdition(
      story({ title: 'Treviso sabato', location: 'loc-tv', days: ['Sabato', ''], hours: ['9:00/12:00'], starts: '2026-11-07 00:00', ends: '2027-06-26', seats: '20' }),
      locations,
      NOW
    )
    expect(e).toEqual(edition())
  })

  it('esclude le edizioni senza data o già iniziate', () => {
    expect(toEdition(story({ title: 'x' }), locations, NOW)).toBeNull()
    expect(toEdition(story({ starts: '2026-10-01' }), locations, NOW)).toBeNull()
  })

  it('posti non numerici restano non indicati', () => {
    expect(toEdition(story({ starts: '2026-11-07', seats: 'pochi' }), locations, NOW)?.posti).toBeNull()
  })
})

describe('offerta del passo 2', () => {
  it('calcola posti rimasti e importi a prezzo pieno', () => {
    const offer = buildOffer([edition(), edition({ chiave: `${UUID}:2027-01-09`, posti: 10 })], { [`${UUID}:2027-01-09`]: 10 }, LIST, null, NOW)
    expect(offer.edizioni.map((e) => [e.stato, e.posti_liberi])).toEqual([
      ['disponibile', 20],
      ['completa', 0],
    ])
    expect(openEditions(offer)).toEqual([`${UUID}:2026-11-07`])
    expect(offer.prezzi?.unica.totale).toBe(5490)
    expect(offer.prezzi?.['5_rate'].rata).toBe(1140)
    expect(offer.offerta).toBe(false)
    expect(offer.quota_esame).toBe(366)
  })

  it('con SCADENZA_OFFERTA valida tutte le modalità costano il prezzo open day', () => {
    const offer = buildOffer([edition()], {}, LIST, '2026-10-20', NOW)
    expect(offer.offerta).toBe(true)
    expect(offer.scadenza_offerta).toBe('2026-10-20')
    expect([offer.prezzi?.unica.totale, offer.prezzi?.['5_rate'].totale, offer.prezzi?.['10_rate'].rata]).toEqual([4990, 4990, 499])
  })

  it('offerta scaduta: prezzo pieno e nessuna data mostrata', () => {
    const offer = buildOffer([edition()], {}, LIST, '2026-10-13', NOW)
    expect(offer.offerta).toBe(false)
    expect(offer.scadenza_offerta).toBeNull()
  })

  it('senza listino non ci sono importi', () => {
    expect(buildOffer([edition()], {}, null, '2026-10-20', NOW).prezzi).toBeNull()
  })
})

describe('posti rimasti nei blocchi corso', () => {
  it('posti dell’edizione meno iscritti, oppure il valore di Storyblok', () => {
    const key = `${UUID}:2026-11-07`
    expect(seatsLabel('20', key, null)).toBe('20')
    expect(seatsLabel('20', key, { [key]: 18 })).toBe('2')
    expect(seatsLabel(20, key, { [key]: 20 })).toBe('completo')
    expect(seatsLabel('pochi', key, { [key]: 3 })).toBe('pochi')
    expect(seatsLabel('', key, { [key]: 3 })).toBeNull()
  })
})

describe('GET /api/iscrizione/posti', () => {
  it('restituisce solo i conteggi delle chiavi valide', async () => {
    vi.mocked(db.countSignedByEdition).mockResolvedValue({ [`${UUID}:2026-11-07`]: 3 })
    const res = await call(posti, { query: { chiavi: `${UUID}:2026-11-07,${UUID}:2027-01-09,'; drop table` } })
    expect(res.statusCode).toBe(200)
    expect(db.countSignedByEdition).toHaveBeenCalledWith([`${UUID}:2026-11-07`, `${UUID}:2027-01-09`])
    expect(res.body.iscritti).toEqual({ [`${UUID}:2026-11-07`]: 3, [`${UUID}:2027-01-09`]: 0 })
  })

  it('è spenta insieme all’iscrizione online', async () => {
    vi.stubEnv('ENROLLMENT_ONLINE', '')
    const res = await call(posti, { query: { chiavi: `${UUID}:2026-11-07` } })
    expect(res.statusCode).toBe(404)
  })
})

describe('GET /api/iscrizione/offerta', () => {
  it('serve la verifica dell’email', async () => {
    const res = await call(offerta, { query: { corso: CORSO } })
    expect(res.statusCode).toBe(401)
    expect(loadOffer).not.toHaveBeenCalled()
  })

  it('legge l’offerta per l’email verificata', async () => {
    vi.mocked(loadOffer).mockResolvedValue(buildOffer([edition()], {}, LIST, null, NOW))
    const res = await call(offerta, { query: { corso: CORSO }, cookies: cookie() })
    expect(res.statusCode).toBe(200)
    expect(loadOffer).toHaveBeenCalledWith(CORSO, EMAIL)
    expect(res.body.edizioni).toHaveLength(1)
  })
})

describe('PUT /api/iscrizione/bozza, passo 2', () => {
  const put = (valori: Record<string, unknown>) =>
    call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'corso', valori }, cookies: cookie() })

  it('non si salva prima del passo 1', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: [] }))
    const res = await put({ edizione: `${UUID}:2026-11-07`, scopo: 'professione', modalita: 'unica' })
    expect(res.statusCode).toBe(409)
  })

  it('rifiuta un’edizione completa', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row())
    vi.mocked(loadOffer).mockResolvedValue(buildOffer([edition({ posti: 5 })], { [`${UUID}:2026-11-07`]: 5 }, LIST, null, NOW))
    const res = await put({ edizione: `${UUID}:2026-11-07`, scopo: 'professione', modalita: 'unica' })
    expect(res.statusCode).toBe(400)
    expect(res.body.errori.edizione).toContain('non è più disponibile')
    expect(db.saveCorso).not.toHaveBeenCalled()
  })

  it('salva gli importi calcolati sul server, non quelli del browser', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row())
    vi.mocked(loadOffer).mockResolvedValue(buildOffer([edition()], {}, LIST, '2026-10-20', NOW))
    vi.mocked(db.saveCorso).mockImplementation(async (_id, _email, value, price, complete) =>
      row({
        edizione_chiave: value.edizione,
        pagamento_modalita: value.modalita,
        pagamento_rata: String(price.rata),
        pagamento_totale: String(price.totale),
        offerta_open_day: price.offerta,
        profilo: { scopo: value.scopo },
        sezioni_complete: complete,
      })
    )
    const res = await put({ edizione: `${UUID}:2026-11-07`, scopo: 'professione', modalita: '10_rate', totale: 1 })
    expect(res.statusCode).toBe(200)
    const [, , value, price, complete] = vi.mocked(db.saveCorso).mock.calls[0]
    expect(value).toEqual({ edizione: `${UUID}:2026-11-07`, scopo: 'professione', modalita: '10_rate' })
    expect([price.totale, price.rata, price.offerta]).toEqual([4990, 499, true])
    expect(complete).toEqual(['chi_sei', 'corso'])
    expect(res.body.iscrizione.corso_pagamento).toEqual({
      edizione: `${UUID}:2026-11-07`,
      scopo: 'professione',
      modalita: '10_rate',
      rata: 499,
      totale: 4990,
      offerta: true,
    })
    expect(res.body.iscrizione.prossima).toBe('dati')
  })

  it('senza listino non salva e lo dice', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row())
    vi.mocked(loadOffer).mockResolvedValue(buildOffer([edition()], {}, null, null, NOW))
    const res = await put({ edizione: `${UUID}:2026-11-07`, scopo: 'professione', modalita: 'unica' })
    expect(res.statusCode).toBe(503)
    expect(db.saveCorso).not.toHaveBeenCalled()
  })
})
