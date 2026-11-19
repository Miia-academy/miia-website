import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/enrollment/db', () => ({
  getEnrollment: vi.fn(),
  saveConsensi: vi.fn(),
  logEvent: vi.fn(),
}))
vi.mock('@modules/enrollment/load-offer', () => ({ loadOffer: vi.fn() }))
vi.mock('@modules/enrollment/contact', () => ({ syncContact: vi.fn() }))

import bozza from '@pages/api/iscrizione/bozza'
import condizioni from '@pages/api/iscrizione/condizioni'
import * as db from '@modules/enrollment/db'
import { parseConditions } from '@modules/enrollment/conditions'
import { publicState } from '@modules/enrollment/state'
import { SESSION_COOKIE, signSession } from '@modules/enrollment/session'
import type { Enrollment } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'
const ID = '00000000-0000-4000-8000-000000000001'
const STEP4 = ['chi_sei', 'corso', 'dati', 'profilo'] as Enrollment['sezioni_complete']

import { ANSWERS, STORIES, changed } from './consent-fixtures'

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

function stubStoryblok(stories: unknown[] | null, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status === 200, status, json: async () => ({ stories: stories || [] }) })))
}

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('consensi da Storyblok', () => {
  it('una voce per storia, nell’ordine della cartella, con un’impronta stabile', () => {
    const c = parseConditions([...STORIES].reverse())!
    expect(c.voci.map((v) => v.chiave)).toEqual(['contratto', 'recesso', 'foto', 'newsletter'])
    expect(c.voci[2]).toMatchObject({ tipo: 'si_no', etichetta_no: 'No, non autorizzo', obbligatorio: true })
    expect(c.voci[3].obbligatorio).toBe(false)
    expect(c.impronta).toMatch(/^[0-9a-f]{16}$/)
    expect(parseConditions(STORIES)!.impronta).toBe(c.impronta)
    expect(parseConditions(changed('recesso', 'descrizione', 'Altro testo'))!.impronta).not.toBe(c.impronta)
    expect(parseConditions(STORIES.slice(0, 3))!.impronta).not.toBe(c.impronta)
  })

  it('una voce senza titolo o senza testo della casella non si mostra', () => {
    expect(parseConditions(changed('recesso', 'etichetta', ''))!.voci.map((v) => v.chiave)).not.toContain('recesso')
    expect(parseConditions([])).toBeNull()
    expect(parseConditions(null)).toBeNull()
  })

  it('GET /api/iscrizione/condizioni: 503 se non ci sono voci', async () => {
    stubStoryblok(null, 404)
    expect((await call(condizioni)).statusCode).toBe(503)
    stubStoryblok([])
    expect((await call(condizioni)).statusCode).toBe(503)
    stubStoryblok(STORIES)
    const ok = await call(condizioni)
    expect(ok.statusCode).toBe(200)
    expect(ok.body.voci).toHaveLength(4)
  })
})

describe('PUT /api/iscrizione/bozza, passo 5', () => {
  const impronta = () => parseConditions(STORIES)!.impronta
  const all = () => ({ ...ANSWERS, impronta: impronta() })
  const put = (valori: Record<string, unknown>) =>
    call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'consensi', valori }, cookies: cookie() })

  it('salva le risposte e l’impronta dei testi', async () => {
    stubStoryblok(STORIES)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    vi.mocked(db.saveConsensi).mockImplementation(async (_id, _e, value, complete) =>
      row({ sezioni_complete: complete, consensi: value as unknown as Record<string, unknown> })
    )
    const res = await put(all())
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.saveConsensi).mock.calls[0][2]).toMatchObject({
      impronta: impronta(),
      voci: { foto: { valore: 'si', titolo: 'Fotografie e video' }, newsletter: { valore: false } },
    })
    expect(res.body.iscrizione.consensi).toEqual({ impronta: impronta(), contratto: true, recesso: true, foto: 'si', newsletter: false })
    expect(res.body.iscrizione.prossima).toBe('firma')
  })

  it('se i testi sono cambiati chiede di rileggerli', async () => {
    stubStoryblok(changed('recesso', 'descrizione', 'Testo nuovo'))
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    const res = await put(all())
    expect(res.statusCode).toBe(409)
    expect(res.body.aggiornate).toBe(true)
    expect(db.saveConsensi).not.toHaveBeenCalled()
  })

  it('senza una risposta obbligatoria non salva', async () => {
    stubStoryblok(STORIES)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    const res = await put({ ...all(), recesso: false, foto: '' })
    expect(res.statusCode).toBe(400)
    expect(Object.keys(res.body.errori).sort()).toEqual(['foto', 'recesso'])
  })

  it('senza voci in Storyblok il passo non si completa', async () => {
    stubStoryblok(null, 404)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    expect((await put(all())).statusCode).toBe(503)
  })

  it('prima del passo 4 non salva', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei', 'corso', 'dati'] }))
    expect((await put(all())).statusCode).toBe(409)
  })

  it('lo stato non porta le ore dei consensi', () => {
    const state = publicState(row({ consensi: { impronta: 'x1', voci: { foto: { valore: 'no', ora: 'x', titolo: 'Foto' } } } }))
    expect(state.consensi).toEqual({ impronta: 'x1', foto: 'no' })
  })
})
