import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/enrollment/db', () => ({
  getEnrollment: vi.fn(),
  logEvent: vi.fn(),
  recentCodeSends: vi.fn(),
  insertCode: vi.fn(),
  latestActiveCode: vi.fn(),
  takeCodeAttempt: vi.fn(),
  markCodeUsed: vi.fn(),
  signEnrollment: vi.fn(),
}))
vi.mock('@modules/enrollment/load-offer', () => ({ loadOffer: vi.fn() }))
vi.mock('@modules/enrollment/contact', () => ({ sendSignatureSms: vi.fn(), sendContractEmail: vi.fn() }))
vi.mock('@modules/google', () => ({ uploadFile: vi.fn() }))

import codice from '@pages/api/iscrizione/firma/codice'
import conferma from '@pages/api/iscrizione/firma/conferma'
import * as db from '@modules/enrollment/db'
import * as contact from '@modules/enrollment/contact'
import { uploadFile } from '@modules/google'
import { loadOffer } from '@modules/enrollment/load-offer'
import { hashCode } from '@modules/enrollment/codes'
import { parseConditions } from '@modules/enrollment/conditions'
import { buildContractPdf, pdfSafe } from '@modules/enrollment/contract'
import { maskPhone } from '@modules/enrollment/sign'
import { SESSION_COOKIE, signSession } from '@modules/enrollment/session'
import type { CourseOffer } from '@modules/enrollment/offer'
import type { Enrollment } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'
const ID = '00000000-0000-4000-8000-000000000001'
const KEY = '11111111-2222-4333-8444-555555555555:2026-11-07'
const STEP5 = ['chi_sei', 'corso', 'dati', 'profilo', 'consensi'] as Enrollment['sezioni_complete']

const CONTENT = {
  versione: '2026-11',
  contratto_punti: '- La retta è dovuta per intero.',
  contratto_testo: 'a) Oggetto del contratto: corso “Interior design”.\n\nb) Durata… fino a € 5.490.',
  clausole_1341: 'e) ritardo nei pagamenti, k) foro competente di Treviso',
  recesso_testo: 'Puoi annullare entro 14 giorni dalla firma.',
  privacy_testo: 'Titolare del trattamento: Made in Italy Academy.',
  dopo_la_firma: '- Ti chiamiamo per il benvenuto\n- Ricevi il calendario',
}
const IMPRONTA = parseConditions(CONTENT)!.impronta

const OFFER = (stato: 'disponibile' | 'completa' = 'disponibile'): CourseOffer => ({
  edizioni: [
    {
      chiave: KEY,
      titolo: 'Treviso sabato',
      sede: 'Treviso',
      giorni: ['Sabato'],
      orari: ['9:00/12:00'],
      inizio: '2026-11-07',
      fine: '2027-06-26',
      posti: 12,
      posti_liberi: stato === 'completa' ? 0 : 5,
      stato,
    },
  ],
  prezzi: null,
  quota_esame: 366,
  offerta: false,
  scadenza_offerta: null,
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

const cookie = () => ({ [SESSION_COOKIE]: signSession({ id: ID, email: EMAIL, corso: CORSO }) })

function ready(over: Partial<Enrollment> = {}) {
  return row({
    sezioni_complete: STEP5,
    edizione_chiave: KEY,
    pagamento_modalita: '10_rate',
    pagamento_rata: '594.00',
    pagamento_totale: '5940.00',
    dati: {
      data_nascita: '1985-12-10',
      luogo_nascita: 'Treviso',
      codice_fiscale: 'RSSMRA85T10A562S',
      via: 'Via Roma 1',
      comune: 'Treviso',
      provincia: 'TV',
      cap: '31100',
      documento_tipo: 'carta_identita',
      documento_numero: 'CA12345AB',
      documenti: 'dopo',
      azienda: null,
    },
    profilo: { scopo: 'professione', titolo_studi: 'diploma', saltato: false },
    consensi: {
      versione: '2026-11',
      impronta: IMPRONTA,
      contratto: { valore: true, ora: '2026-10-14T08:00:00Z' },
      foto: { valore: 'si', ora: '2026-10-14T08:00:00Z' },
    },
    ...over,
  })
}

function stubStoryblok(content: Record<string, unknown> | null) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: !!content, status: content ? 200 : 404, json: async () => ({ story: { content } }) })))
}

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token-di-prova')
  for (const fn of [...Object.values(db), ...Object.values(contact)]) vi.mocked(fn as any).mockReset()
  vi.mocked(uploadFile).mockReset()
  vi.mocked(loadOffer).mockReset()
  vi.mocked(db.recentCodeSends).mockResolvedValue({ perEmail: 0, perIp: 0, lastAt: null })
  vi.mocked(loadOffer).mockResolvedValue(OFFER())
  stubStoryblok(CONTENT)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('PDF del contratto', () => {
  it('sostituisce i caratteri che i font del PDF non hanno', () => {
    expect(pdfSafe('“Ciao” – l’aula… €')).toBe('"Ciao" - l\'aula... €')
    expect(pdfSafe('emoji 😀 e accenti àèìòù')).toBe('emoji  e accenti àèìòù')
  })

  it('genera un PDF con impronta', async () => {
    const { bytes, sha256 } = await buildContractPdf({
      corso: CORSO,
      row: ready({ nome: 'Mario', cognome: 'Rossi' }),
      edizione: OFFER().edizioni[0],
      quota_esame: 366,
      condizioni: parseConditions(CONTENT)!,
      firma: { ora: new Date('2026-10-14T08:30:00Z'), telefono: '+393331234567', ip: '1.2.3.4', fine_recesso: '2026-10-28' },
    })
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-')
    expect(sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('maschera il cellulare', () => {
    expect(maskPhone('+393331234567')).toBe('+39 333 ••• 4567')
  })
})

describe('POST /api/iscrizione/firma/codice', () => {
  const send = () => call(codice, { method: 'POST', body: { corso: CORSO }, cookies: cookie() })

  it('manda il codice via SMS al cellulare del passo 1', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(ready())
    const res = await send()
    expect(res.statusCode).toBe(200)
    expect(res.body.telefono).toBe('+39 333 ••• 4567')
    expect(contact.sendSignatureSms).toHaveBeenCalledWith('+393331234567', expect.stringMatching(/^\d{6}$/), 10)
    expect(vi.mocked(db.insertCode).mock.calls[0][1]).toBe('firma')
  })

  it('prima dei consensi non si firma', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(ready({ sezioni_complete: ['chi_sei', 'corso', 'dati', 'profilo'] }))
    const res = await send()
    expect(res.statusCode).toBe(409)
    expect(contact.sendSignatureSms).not.toHaveBeenCalled()
  })

  it('se i testi sono cambiati riporta ai consensi', async () => {
    stubStoryblok({ ...CONTENT, privacy_testo: 'Nuovo testo' })
    vi.mocked(db.getEnrollment).mockResolvedValue(ready())
    const res = await send()
    expect(res.statusCode).toBe(409)
    expect(res.body.passo).toBe('consensi')
  })

  it('se l’edizione è piena riporta alla scelta del corso', async () => {
    vi.mocked(loadOffer).mockResolvedValue(OFFER('completa'))
    vi.mocked(db.getEnrollment).mockResolvedValue(ready())
    const res = await send()
    expect(res.statusCode).toBe(409)
    expect(res.body.passo).toBe('corso')
  })

  it('rispetta l’attesa tra un invio e l’altro', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(ready())
    vi.mocked(db.recentCodeSends).mockResolvedValue({ perEmail: 1, perIp: 1, lastAt: new Date() })
    const res = await send()
    expect(res.statusCode).toBe(429)
  })
})

describe('POST /api/iscrizione/firma/conferma', () => {
  const sign = (codice = '123456') => call(conferma, { method: 'POST', body: { corso: CORSO, codice }, cookies: cookie() })
  const active = () => ({ id: 'cod-1', codice_hash: hashCode(EMAIL, 'firma', '123456'), tentativi: 0 })

  beforeEach(() => {
    vi.mocked(db.getEnrollment).mockResolvedValue(ready())
    vi.mocked(db.latestActiveCode).mockResolvedValue(active() as any)
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(true)
    vi.mocked(db.markCodeUsed).mockResolvedValue(true)
    vi.mocked(uploadFile).mockResolvedValue({ id: `iscrizioni/${ID}/contratto-1.pdf` } as any)
    vi.mocked(db.signEnrollment).mockImplementation(async (_id, _e, v) =>
      ready({ stato: 'firmata', firmata_il: v.firmata_il.toISOString(), fine_recesso: v.fine_recesso })
    )
  })

  it('firma: PDF nel bucket privato, iscrizione firmata, contratto per email', async () => {
    const res = await sign()
    expect(res.statusCode).toBe(200)
    expect(res.body.iscrizione.stato).toBe('firmata')
    expect(vi.mocked(uploadFile).mock.calls[0][0]).toMatchObject({ mimeType: 'application/pdf', folderPath: `iscrizioni/${ID}` })
    const signed = vi.mocked(db.signEnrollment).mock.calls[0][2]
    expect(signed.pdf_percorso).toBe(`iscrizioni/${ID}/contratto-1.pdf`)
    expect(signed.fine_recesso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(signed.edizione).toMatchObject({ chiave: KEY, condizioni: { versione: '2026-11', impronta: IMPRONTA } })
    expect(contact.sendContractEmail).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, dopo: ['Ti chiamiamo per il benvenuto', 'Ricevi il calendario'] })
    )
    const events = vi.mocked(db.logEvent).mock.calls.map((c) => c[1])
    expect(events).toEqual(['firmata', 'email_inviata'])
  })

  it('codice sbagliato: niente firma', async () => {
    const res = await sign('000000')
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/Tentativi rimasti: 4/)
    expect(db.signEnrollment).not.toHaveBeenCalled()
  })

  it('se l’email non parte la firma resta valida', async () => {
    vi.mocked(contact.sendContractEmail).mockRejectedValue(new Error('Brevo giù'))
    const res = await sign()
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.logEvent).mock.calls.map((c) => c[1])).toEqual(['firmata', 'email_non_inviata'])
  })

  it('l’edizione si è riempita nel frattempo: il codice non si consuma', async () => {
    vi.mocked(loadOffer).mockResolvedValue(OFFER('completa'))
    const res = await sign()
    expect(res.statusCode).toBe(409)
    expect(db.markCodeUsed).not.toHaveBeenCalled()
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('due firme insieme: la seconda non firma di nuovo', async () => {
    vi.mocked(db.signEnrollment).mockResolvedValue(null)
    const res = await sign()
    expect(res.statusCode).toBe(409)
    expect(contact.sendContractEmail).not.toHaveBeenCalled()
  })
})
