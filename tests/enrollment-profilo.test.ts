import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/enrollment/db', () => ({
  getEnrollment: vi.fn(),
  saveProfilo: vi.fn(),
  logEvent: vi.fn(),
}))
vi.mock('@modules/enrollment/load-offer', () => ({ loadOffer: vi.fn() }))
vi.mock('@modules/enrollment/contact', () => ({ syncContact: vi.fn() }))

import bozza from '@pages/api/iscrizione/bozza'
import * as db from '@modules/enrollment/db'
import { suggestedSources } from '@modules/enrollment/profile'
import { publicState } from '@modules/enrollment/state'
import { validateProfilo } from '@modules/enrollment/validation'
import { SESSION_COOKIE, signSession } from '@modules/enrollment/session'
import type { Enrollment } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'
const ID = '00000000-0000-4000-8000-000000000001'
const STEP3 = ['chi_sei', 'corso', 'dati'] as Enrollment['sezioni_complete']

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

const cookie = () => ({ [SESSION_COOKIE]: signSession({ id: ID, email: EMAIL, corso: CORSO }) })

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('come ci hai conosciuto, dalla provenienza', () => {
  it('traduce sorgente e mezzo nelle voci del passo 4', () => {
    expect(suggestedSources({ origine_sorgente: 'instagram', origine_mezzo: 'paid_social' })).toEqual(['instagram'])
    expect(suggestedSources({ origine_sorgente: 'google', origine_mezzo: 'organic' })).toEqual(['google'])
    expect(suggestedSources({ origine_sorgente: 'google', origine_mezzo: 'cpc', ultima_sorgente: 'fb', ultima_mezzo: 'paid' })).toEqual([
      'pubblicita_internet',
      'facebook',
    ])
    expect(suggestedSources({ origine_sorgente: 'spotify' })).toEqual(['spotify_radio'])
  })

  it('senza provenienza o con fonti sconosciute non suggerisce niente', () => {
    expect(suggestedSources({})).toEqual([])
    expect(suggestedSources(undefined)).toEqual([])
    expect(suggestedSources({ origine_sorgente: 'newsletter', origine_mezzo: 'email' })).toEqual([])
  })

  it('prima del salvataggio lo stato porta solo i suggerimenti, poi le risposte senza lo scopo', () => {
    const draft = publicState(row({ sezioni_complete: STEP3, provenienza: { origine_sorgente: 'ig' }, profilo: { scopo: 'lavoro' } }))
    expect(draft.profilo).toEqual({ come_ci_hai_conosciuto: ['instagram'] })
    const done = publicState(
      row({ sezioni_complete: [...STEP3, 'profilo'], profilo: { scopo: 'lavoro', titolo_studi: 'diploma', saltato: false } })
    )
    expect(done.profilo).toEqual({ titolo_studi: 'diploma', saltato: false })
  })
})

describe('validazione del profilo', () => {
  it('accetta solo le voci delle scelte', () => {
    expect(validateProfilo({ titolo_studi: 'diploma', ore_settimana: 'almeno_6', computer: 'buona' }).ok).toBe(true)
    const r = validateProfilo({ titolo_studi: 'dottorato', computer: 'esperto' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['computer', 'titolo_studi'])
  })

  it('con "Non lavoro ancora" occupazione e ruolo restano vuoti', () => {
    const r = validateProfilo({ non_lavoro: true, occupazione: 'Commessa', ruolo: 'x' })
    expect(r.ok && r.value).toMatchObject({ non_lavoro: true, occupazione: '', ruolo: '' })
  })
})

describe('PUT /api/iscrizione/bozza, passo 4', () => {
  const put = (valori: Record<string, unknown>) =>
    call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'profilo', valori }, cookies: cookie() })

  it('salva le risposte', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP3 }))
    vi.mocked(db.saveProfilo).mockResolvedValue(row({ sezioni_complete: [...STEP3, 'profilo'] }))
    const res = await put({ titolo_studi: 'laurea_triennale', anno_studi: '2015', come_ci_hai_conosciuto: ['google', 'google', 'tiktok'] })
    expect(res.statusCode).toBe(200)
    const [, , value, complete] = vi.mocked(db.saveProfilo).mock.calls[0]
    expect(value).toMatchObject({ titolo_studi: 'laurea_triennale', anno_studi: '2015', come_ci_hai_conosciuto: ['google'], saltato: false })
    expect(complete).toEqual([...STEP3, 'profilo'])
  })

  it('"Salta questo passo" cancella le risposte e completa il passo', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP3 }))
    vi.mocked(db.saveProfilo).mockResolvedValue(row({ sezioni_complete: [...STEP3, 'profilo'] }))
    const res = await put({ saltato: true, titolo_studi: 'diploma' })
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.saveProfilo).mock.calls[0][2]).toMatchObject({ saltato: true, titolo_studi: '', come_ci_hai_conosciuto: [] })
    expect(db.logEvent).toHaveBeenCalledWith(ID, 'sezione_salvata', 'sconosciuto', null, { sezione: 'profilo', saltato: true })
  })

  it('un anno scritto male torna come errore', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP3 }))
    const res = await put({ anno_studi: '15' })
    expect(res.statusCode).toBe(400)
    expect(res.body.errori.anno_studi).toBeDefined()
  })

  it('prima del passo 3 non salva', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei', 'corso'] }))
    const res = await put({})
    expect(res.statusCode).toBe(409)
    expect(db.saveProfilo).not.toHaveBeenCalled()
  })
})
