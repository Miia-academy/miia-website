import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/enrollment/db', () => ({
  getEnrollment: vi.fn(),
  saveDocument: vi.fn(),
  saveDati: vi.fn(),
  saveCorso: vi.fn(),
  saveChiSei: vi.fn(),
  logEvent: vi.fn(),
}))
vi.mock('@modules/google', () => ({ getSignedUploadUrl: vi.fn(), getPrivateFileInfo: vi.fn() }))
vi.mock('@modules/enrollment/load-offer', () => ({ loadOffer: vi.fn() }))
vi.mock('@modules/enrollment/contact', () => ({ syncContact: vi.fn() }))

import bozza from '@pages/api/iscrizione/bozza'
import link from '@pages/api/iscrizione/documenti/link'
import conferma from '@pages/api/iscrizione/documenti/conferma'
import * as db from '@modules/enrollment/db'
import { getPrivateFileInfo, getSignedUploadUrl } from '@modules/google'
import {
  documentExtension,
  documentPath,
  documentsComplete,
  isOwnDocumentPath,
  requiredSlots,
} from '@modules/enrollment/documents'
import { SESSION_COOKIE, signSession } from '@modules/enrollment/session'
import type { Enrollment } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'
const ID = '00000000-0000-4000-8000-000000000001'
const STEP2 = ['chi_sei', 'corso'] as Enrollment['sezioni_complete']

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

const file = (slot: string) => ({ percorso: `iscrizioni/${ID}/${slot}-1.jpg`, tipo: 'image/jpeg', dimensione: 1000, caricato_il: 'x' })
const allPhotos = {
  file: {
    documento_fronte: file('documento_fronte'),
    documento_retro: file('documento_retro'),
    tessera_fronte: file('tessera_fronte'),
    tessera_retro: file('tessera_retro'),
  },
}

const DATI = {
  data_nascita: '1985-12-10',
  luogo_nascita: 'Treviso',
  codice_fiscale: 'RSSMRA85T10A562S',
  via: 'Via Roma 1',
  comune: 'Treviso',
  provincia: 'tv',
  cap: '31100',
  documento_tipo: 'carta_identita_elettronica',
  documento_numero: 'CA12345AB',
}

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  vi.mocked(getSignedUploadUrl).mockReset()
  vi.mocked(getPrivateFileInfo).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('foto dei documenti', () => {
  it('ammette solo JPG, PNG, HEIC e PDF', () => {
    expect(documentExtension('image/jpeg')).toBe('jpg')
    expect(documentExtension('IMAGE/PNG')).toBe('png')
    expect(documentExtension('application/pdf')).toBe('pdf')
    expect(documentExtension('image/gif')).toBeNull()
    expect(documentExtension(undefined)).toBeNull()
  })

  it('accetta solo percorsi di quell’iscrizione e di quella foto', () => {
    const p = documentPath(ID, 'documento_fronte', 'jpg', new Date(1000))
    expect(p).toBe(`iscrizioni/${ID}/documento_fronte-1000.jpg`)
    expect(isOwnDocumentPath(p, ID, 'documento_fronte')).toBe(true)
    expect(isOwnDocumentPath(p, ID, 'tessera_fronte')).toBe(false)
    expect(isOwnDocumentPath(p.replace(ID, '00000000-0000-4000-8000-000000000002'), ID, 'documento_fronte')).toBe(false)
    expect(isOwnDocumentPath(`iscrizioni/${ID}/documento_fronte-1/../x.jpg`, ID, 'documento_fronte')).toBe(false)
  })

  it('il passaporto non chiede il retro', () => {
    expect(requiredSlots('passaporto')).not.toContain('documento_retro')
    expect(requiredSlots('carta_identita')).toHaveLength(4)
    const { documento_retro, ...rest } = allPhotos.file
    void documento_retro
    expect(documentsComplete({ file: rest }, 'passaporto')).toBe(true)
    expect(documentsComplete({ file: rest }, 'carta_identita')).toBe(false)
  })
})

describe('POST /api/iscrizione/documenti/link', () => {
  const send = { corso: CORSO, foto: 'documento_fronte', tipo_file: 'image/jpeg', dimensione: 500000 }

  it('dà un link firmato con tipo e dimensione fissati', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    vi.mocked(getSignedUploadUrl).mockResolvedValue('https://storage.example/firmato')
    const res = await call(link, { method: 'POST', body: send, cookies: cookie() })
    expect(res.statusCode).toBe(200)
    expect(res.body.url).toBe('https://storage.example/firmato')
    expect(res.body.percorso).toMatch(new RegExp(`^iscrizioni/${ID}/documento_fronte-\\d+\\.jpg$`))
    expect(res.body.headers['Content-Type']).toBe('image/jpeg')
    expect(vi.mocked(getSignedUploadUrl).mock.calls[0][1]).toBe('image/jpeg')
  })

  it('senza email verificata risponde 401', async () => {
    const res = await call(link, { method: 'POST', body: send })
    expect(res.statusCode).toBe(401)
    expect(getSignedUploadUrl).not.toHaveBeenCalled()
  })

  it('prima del passo 2 non dà link', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei'] }))
    const res = await call(link, { method: 'POST', body: send, cookies: cookie() })
    expect(res.statusCode).toBe(409)
  })

  it('rifiuta tipi e dimensioni non ammessi', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    const gif = await call(link, { method: 'POST', body: { ...send, tipo_file: 'image/gif' }, cookies: cookie() })
    expect(gif.statusCode).toBe(400)
    const big = await call(link, { method: 'POST', body: { ...send, dimensione: 11 * 1024 * 1024 }, cookies: cookie() })
    expect(big.statusCode).toBe(400)
    const slot = await call(link, { method: 'POST', body: { ...send, foto: 'selfie' }, cookies: cookie() })
    expect(slot.statusCode).toBe(400)
    expect(getSignedUploadUrl).not.toHaveBeenCalled()
  })
})

describe('POST /api/iscrizione/documenti/conferma', () => {
  const percorso = `iscrizioni/${ID}/documento_fronte-1700000000000.jpg`

  it('registra la foto se il file esiste nel bucket', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    vi.mocked(getPrivateFileInfo).mockResolvedValue({ contentType: 'image/jpeg', size: 400000 })
    vi.mocked(db.saveDocument).mockResolvedValue(row({ documenti: { file: { documento_fronte: file('documento_fronte') } } }))
    const res = await call(conferma, { method: 'POST', body: { corso: CORSO, foto: 'documento_fronte', percorso }, cookies: cookie() })
    expect(res.statusCode).toBe(200)
    expect(res.body.caricate).toEqual(['documento_fronte'])
    expect(vi.mocked(db.saveDocument).mock.calls[0][2]).toBe('documento_fronte')
    expect(db.logEvent).toHaveBeenCalledWith(ID, 'documento_caricato', 'sconosciuto', null, { foto: 'documento_fronte' })
  })

  it('rifiuta percorsi di altre iscrizioni', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    const other = percorso.replace(ID, '00000000-0000-4000-8000-000000000002')
    const res = await call(conferma, { method: 'POST', body: { corso: CORSO, foto: 'documento_fronte', percorso: other }, cookies: cookie() })
    expect(res.statusCode).toBe(400)
    expect(getPrivateFileInfo).not.toHaveBeenCalled()
  })

  it('se il file non c’è non registra niente', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    vi.mocked(getPrivateFileInfo).mockResolvedValue(null)
    const res = await call(conferma, { method: 'POST', body: { corso: CORSO, foto: 'documento_fronte', percorso }, cookies: cookie() })
    expect(res.statusCode).toBe(400)
    expect(db.saveDocument).not.toHaveBeenCalled()
  })
})

describe('PUT /api/iscrizione/bozza, passo 3', () => {
  const put = (valori: Record<string, unknown>) =>
    call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'dati', valori }, cookies: cookie() })

  it('salva i dati quando le foto sono sul server', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2, documenti: allPhotos }))
    vi.mocked(db.saveDati).mockResolvedValue(row({ sezioni_complete: [...STEP2, 'dati'], documenti: allPhotos }))
    const res = await put(DATI)
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.saveDati).mock.calls[0][2]).toMatchObject({ provincia: 'TV', documenti: 'caricati', azienda: null })
    expect(res.body.iscrizione.foto_caricate).toHaveLength(4)
  })

  it('senza foto chiede di caricarle o di scegliere "Li carico dopo"', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    const res = await put(DATI)
    expect(res.statusCode).toBe(400)
    expect(res.body.errori.documenti).toBeDefined()
    expect(db.saveDati).not.toHaveBeenCalled()
  })

  it('le foto dichiarate dal browser non contano', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    const res = await put({ ...DATI, documenti: allPhotos })
    expect(res.statusCode).toBe(400)
  })

  it('con "Li carico dopo" e fatturazione azienda', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: STEP2 }))
    vi.mocked(db.saveDati).mockResolvedValue(row({ sezioni_complete: [...STEP2, 'dati'] }))
    const azienda = { ragione_sociale: 'Studio Srl', via: 'Via Po 2', cap: '31100', partita_iva: '01234567890', sdi: 'abc1234' }
    const res = await put({ ...DATI, documenti_dopo: true, fatturazione_azienda: true, azienda })
    expect(res.statusCode).toBe(200)
    expect(vi.mocked(db.saveDati).mock.calls[0][2]).toMatchObject({ documenti: 'dopo', azienda: { sdi: 'ABC1234' } })
  })

  it('prima del passo 2 non salva', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei'], documenti: allPhotos }))
    const res = await put(DATI)
    expect(res.statusCode).toBe(409)
  })
})
