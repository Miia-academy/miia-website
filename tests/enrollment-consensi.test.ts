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

const CONTENT = {
  versione: '2026-11',
  contratto_punti: '- La retta è dovuta per intero.\n- Le lezioni perse non si recuperano.\n',
  contratto_testo: 'a) Oggetto.\n\nb) Durata.',
  clausole_1341: 'e) ritardo nei pagamenti, k) foro competente di Treviso',
  recesso_testo: 'Puoi annullare entro 14 giorni dalla firma.',
  privacy_testo: 'Titolare del trattamento: …',
}

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

function stubStoryblok(content: Record<string, unknown> | null, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: status === 200, status, json: async () => (content ? { story: { content } } : {}) }))
  )
}

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('testi delle condizioni da Storyblok', () => {
  it('legge versione, punti chiave e testi, con un’impronta stabile', () => {
    const c = parseConditions(CONTENT)
    expect(c).toMatchObject({ versione: '2026-11', contratto_punti: ['La retta è dovuta per intero.', 'Le lezioni perse non si recuperano.'] })
    expect(c?.impronta).toMatch(/^[0-9a-f]{16}$/)
    expect(parseConditions({ ...CONTENT })?.impronta).toBe(c?.impronta)
    expect(parseConditions({ ...CONTENT, privacy_testo: 'Altro testo' })?.impronta).not.toBe(c?.impronta)
  })

  it('senza un testo obbligatorio non si può accettare niente', () => {
    expect(parseConditions({ ...CONTENT, versione: '' })).toBeNull()
    expect(parseConditions({ ...CONTENT, clausole_1341: undefined })).toBeNull()
    expect(parseConditions(null)).toBeNull()
  })

  it('GET /api/iscrizione/condizioni: 503 se la storia non c’è', async () => {
    stubStoryblok(null, 404)
    const res = await call(condizioni)
    expect(res.statusCode).toBe(503)
    stubStoryblok(CONTENT)
    const ok = await call(condizioni)
    expect(ok.statusCode).toBe(200)
    expect(ok.body.versione).toBe('2026-11')
  })
})

describe('PUT /api/iscrizione/bozza, passo 5', () => {
  const impronta = () => parseConditions(CONTENT)!.impronta
  const all = () => ({ contratto: true, clausole: true, recesso: true, privacy: true, foto: 'si', newsletter: false, versione: '2026-11', impronta: impronta() })
  const put = (valori: Record<string, unknown>) =>
    call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'consensi', valori }, cookies: cookie() })

  it('salva consensi, versione e impronta dei testi', async () => {
    stubStoryblok(CONTENT)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    vi.mocked(db.saveConsensi).mockImplementation(async (_id, _e, value, complete) =>
      row({ sezioni_complete: complete, consensi: value as unknown as Record<string, unknown> })
    )
    const res = await put(all())
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.saveConsensi).mock.calls[0][2]).toMatchObject({ versione: '2026-11', impronta: impronta(), foto: { valore: 'si' } })
    expect(res.body.iscrizione.consensi).toEqual({
      versione: '2026-11',
      contratto: true,
      clausole: true,
      recesso: true,
      privacy: true,
      foto: 'si',
      newsletter: false,
    })
    expect(res.body.iscrizione.prossima).toBe('firma')
  })

  it('se i testi sono cambiati chiede di rileggerli', async () => {
    stubStoryblok({ ...CONTENT, recesso_testo: 'Testo nuovo' })
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    const res = await put(all())
    expect(res.statusCode).toBe(409)
    expect(res.body.aggiornate).toBe(true)
    expect(db.saveConsensi).not.toHaveBeenCalled()
  })

  it('senza un consenso obbligatorio o la scelta sulle foto non salva', async () => {
    stubStoryblok(CONTENT)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    const res = await put({ ...all(), clausole: false, foto: '' })
    expect(res.statusCode).toBe(400)
    expect(Object.keys(res.body.errori).sort()).toEqual(['clausole', 'foto'])
  })

  it('senza condizioni in Storyblok il passo non si completa', async () => {
    stubStoryblok(null, 404)
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP4 }))
    const res = await put(all())
    expect(res.statusCode).toBe(503)
  })

  it('prima del passo 4 non salva', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei', 'corso', 'dati'] }))
    const res = await put(all())
    expect(res.statusCode).toBe(409)
  })

  it('lo stato non porta le ore dei consensi', () => {
    const state = publicState(row({ consensi: { versione: 'v1', foto: { valore: 'no', ora: 'x' } } }))
    expect(state.consensi).toEqual({ versione: 'v1', foto: 'no' })
  })
})
