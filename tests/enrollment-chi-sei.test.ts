import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Database e Brevo simulati: nessuna chiamata reale.
vi.mock('@modules/enrollment/db', () => ({
  recentCodeSends: vi.fn(),
  insertCode: vi.fn(),
  latestActiveCode: vi.fn(),
  takeCodeAttempt: vi.fn(),
  markCodeUsed: vi.fn(),
  openDraft: vi.fn(),
  getEnrollment: vi.fn(),
  saveChiSei: vi.fn(),
  logEvent: vi.fn(),
}))
vi.mock('@modules/enrollment/contact', () => ({
  sendCodeEmail: vi.fn(),
  contactPrefill: vi.fn(),
  syncContact: vi.fn(),
}))

import codice from '@pages/api/iscrizione/codice'
import verifica from '@pages/api/iscrizione/verifica'
import bozza from '@pages/api/iscrizione/bozza'
import * as db from '@modules/enrollment/db'
import * as contact from '@modules/enrollment/contact'
import { codeMatches, generateCode, hashCode, normalizeCode, sendWaitSeconds } from '@modules/enrollment/codes'
import { SESSION_COOKIE, signSession, verifySession } from '@modules/enrollment/session'
import { courseFromEditionSlug, courseTitle } from '@modules/enrollment/courses'
import { normalizeCourseSlug, publicState } from '@modules/enrollment/state'
import type { Enrollment } from '@modules/enrollment/types'

const EMAIL = 'test+iscrizione@miia.it'
const CORSO = 'corso-interior-design-primo-livello'

function row(overrides: Partial<Enrollment> = {}): Enrollment {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: EMAIL,
    corso: CORSO,
    canale: 'sito',
    stato: 'bozza',
    sezioni_complete: [],
    nome: null,
    cognome: null,
    telefono: null,
    edizione_chiave: null,
    pagamento_modalita: null,
    pagamento_rata: null,
    pagamento_totale: null,
    offerta_open_day: false,
    dati: { codice_fiscale: 'RSSMRA85T10A562S' },
    profilo: {},
    consensi: {},
    documenti: {},
    firmata_il: null,
    fine_recesso: null,
    creata_il: '2026-10-14T08:00:00Z',
    aggiornata_il: '2026-10-14T08:00:00Z',
    ...overrides,
  }
}

function call(
  handler: (req: NextApiRequest, res: NextApiResponse) => unknown,
  { method = 'POST', body = {}, query = {}, cookies = {} }: { method?: string; body?: unknown; query?: Record<string, string>; cookies?: Record<string, string> } = {}
) {
  const req = { method, body, query, cookies, headers: { 'x-forwarded-for': '203.0.113.7' }, url: '/api/iscrizione' } as unknown as NextApiRequest
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

const cookieFor = (corso = CORSO) => ({ [SESSION_COOKIE]: signSession({ id: row().id, email: EMAIL, corso }) })

beforeEach(() => {
  vi.stubEnv('ENROLLMENT_ONLINE', 'on')
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  for (const fn of Object.values(db)) vi.mocked(fn as any).mockReset()
  for (const fn of Object.values(contact)) vi.mocked(fn as any).mockReset()
  vi.mocked(db.recentCodeSends).mockResolvedValue({ perEmail: 0, perIp: 0, lastAt: null })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('codici di verifica', () => {
  it('sono di 6 cifre e si confrontano solo con email e scopo giusti', () => {
    vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
    const code = generateCode()
    expect(code).toMatch(/^\d{6}$/)
    const hash = hashCode(EMAIL, 'email', code)
    expect(hash).not.toContain(code)
    expect(codeMatches(hash, EMAIL, 'email', code)).toBe(true)
    expect(codeMatches(hash, 'altra@miia.it', 'email', code)).toBe(false)
    expect(codeMatches(hash, EMAIL, 'firma', code)).toBe(false)
  })

  it('accetta il codice incollato con spazi', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456')
    expect(normalizeCode('12345')).toBeNull()
    expect(normalizeCode('12a456')).toBeNull()
  })

  it('fa attendere 30 secondi tra un invio e l’altro e blocca dopo 3 invii l’ora', () => {
    const now = new Date('2026-10-14T08:00:30Z')
    expect(sendWaitSeconds({ perEmail: 1, perIp: 1, lastAt: new Date('2026-10-14T08:00:10Z') }, now)).toBe(10)
    expect(sendWaitSeconds({ perEmail: 1, perIp: 1, lastAt: new Date('2026-10-14T07:59:00Z') }, now)).toBe(0)
    expect(sendWaitSeconds({ perEmail: 3, perIp: 3, lastAt: null }, now)).toBe(3600)
    expect(sendWaitSeconds({ perEmail: 0, perIp: 10, lastAt: null }, now)).toBe(3600)
  })
})

describe('cookie dell’iscrizione', () => {
  it('non accetta il cookie del login di studenti e aziende', () => {
    const login = jwt.sign({ id: 'x', email: EMAIL, corso: CORSO }, 'segreto-di-prova')
    expect(verifySession(login)).toBeNull()
    expect(verifySession(signSession({ id: 'x', email: EMAIL, corso: CORSO }))).toEqual({ id: 'x', email: EMAIL, corso: CORSO })
  })
})

describe('corsi e stato', () => {
  it('ricava il corso dalla cartella dell’edizione in Storyblok', () => {
    expect(courseFromEditionSlug('corsi/interior-design/corso-interior-design-primo-livello/corsi-interni-primo-livello/treviso-sabato')).toBe(CORSO)
    expect(courseFromEditionSlug('corsi/interior-design/corso-interior-design-primo-livello-padova')).toBeNull()
    expect(courseTitle(CORSO)).toBe('Interior design, primo livello')
    expect(courseTitle('corso-fashion-design-secondo-livello')).toBe('Fashion design, secondo livello')
  })

  it('accetta solo nomi di corso semplici', () => {
    expect(normalizeCourseSlug('Corso-Interior-Design-Primo-Livello')).toBe(CORSO)
    expect(normalizeCourseSlug('../admin')).toBeNull()
    expect(normalizeCourseSlug('a--b')).toBeNull()
  })

  it('al browser manda solo i dati del passo 1 e l’avanzamento', () => {
    const state = publicState(row({ nome: 'Mario', cognome: 'Rossi', telefono: '+393331234567', sezioni_complete: ['chi_sei'] }))
    expect(state).toEqual({
      email: EMAIL,
      corso: CORSO,
      sezioni_complete: ['chi_sei'],
      prossima: 'corso',
      chi_sei: { nome: 'Mario', cognome: 'Rossi', telefono: '+393331234567' },
    })
    expect(JSON.stringify(state)).not.toContain('RSSMRA')
  })
})

describe('POST /api/iscrizione/codice', () => {
  it('non esiste finché l’interruttore è spento', async () => {
    vi.stubEnv('ENROLLMENT_ONLINE', '')
    const res = await call(codice, { body: { email: EMAIL, corso: CORSO } })
    expect(res.statusCode).toBe(404)
    expect(contact.sendCodeEmail).not.toHaveBeenCalled()
  })

  it('rifiuta un’email non valida', async () => {
    const res = await call(codice, { body: { email: 'nonvalida', corso: CORSO } })
    expect(res.statusCode).toBe(400)
    expect(res.body.campo).toBe('email')
  })

  it('salva solo l’impronta e manda il codice per email', async () => {
    const res = await call(codice, { body: { email: ' Test+Iscrizione@miia.it ', corso: CORSO } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, attesa: 30 })
    const [email, scopo, hash, minutes, ip] = vi.mocked(db.insertCode).mock.calls[0]
    const [, sent] = vi.mocked(contact.sendCodeEmail).mock.calls[0]
    expect([email, scopo, minutes, ip]).toEqual([EMAIL, 'email', 10, '203.0.113.7'])
    expect(hash).toBe(hashCode(EMAIL, 'email', sent))
    // Nessuna lettura del contatto prima della verifica.
    expect(contact.contactPrefill).not.toHaveBeenCalled()
  })

  it('fa aspettare chi chiede un nuovo codice troppo presto', async () => {
    vi.mocked(db.recentCodeSends).mockResolvedValue({ perEmail: 1, perIp: 1, lastAt: new Date(Date.now() - 5000) })
    const res = await call(codice, { body: { email: EMAIL, corso: CORSO } })
    expect(res.statusCode).toBe(429)
    expect(res.body.attesa).toBeGreaterThan(20)
    expect(contact.sendCodeEmail).not.toHaveBeenCalled()
  })

  it('ai bot risponde come se fosse andato tutto bene, senza inviare', async () => {
    const res = await call(codice, { body: { email: EMAIL, corso: CORSO, validation: 'spam' } })
    expect(res.statusCode).toBe(200)
    expect(contact.sendCodeEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/iscrizione/verifica', () => {
  const active = () => ({ id: 'c1', codice_hash: hashCode(EMAIL, 'email', '123456'), tentativi: 0, attivo: true })

  it('con il codice sbagliato dice quanti tentativi restano', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue(active())
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(true)
    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '654321' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toContain('Tentativi rimasti: 4')
    expect(db.openDraft).not.toHaveBeenCalled()
  })

  it('finiti i tentativi non confronta più il codice', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue({ ...active(), tentativi: 5 })
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(false)
    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '123456' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toContain('Troppi tentativi')
    expect(db.markCodeUsed).not.toHaveBeenCalled()
  })

  it('senza codice attivo chiede di farne mandare uno nuovo', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue(null)
    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '123456' } })
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toContain('scaduto')
  })

  it('con il codice giusto apre la bozza, imposta il cookie e solo ora precompila da Brevo', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue(active())
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(true)
    vi.mocked(db.markCodeUsed).mockResolvedValue(true)
    vi.mocked(db.openDraft).mockResolvedValue(row())
    vi.mocked(contact.contactPrefill).mockResolvedValue({ trovato: true, nome: 'Giulia', cognome: 'Bianchi', telefono: '+393331234567' })

    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '123 456' } })

    expect(res.statusCode).toBe(200)
    expect(res.body.trovato).toBe(true)
    expect(res.body.iscrizione.chi_sei).toEqual({ nome: 'Giulia', cognome: 'Bianchi', telefono: '+393331234567' })
    const cookie = String(res.headers['Set-Cookie'])
    expect(cookie).toContain(`${SESSION_COOKIE}=`)
    expect(cookie).toContain('HttpOnly')
    expect(verifySession(cookie.split(';')[0].split('=')[1])).toEqual({ id: row().id, email: EMAIL, corso: CORSO })
    expect(db.logEvent).toHaveBeenCalledWith(row().id, 'email_verificata', '203.0.113.7', null, { corso: CORSO })
  })

  it('chi ha già completato il passo 1 ritrova i propri dati, non quelli di Brevo', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue(active())
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(true)
    vi.mocked(db.markCodeUsed).mockResolvedValue(true)
    vi.mocked(db.openDraft).mockResolvedValue(row({ nome: 'Mario', cognome: 'Rossi', telefono: '+393330000000', sezioni_complete: ['chi_sei'] }))
    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '123456' } })
    expect(res.body.iscrizione.chi_sei.nome).toBe('Mario')
    expect(contact.contactPrefill).not.toHaveBeenCalled()
  })

  it('se Brevo non risponde si prosegue con i campi vuoti', async () => {
    vi.mocked(db.latestActiveCode).mockResolvedValue(active())
    vi.mocked(db.takeCodeAttempt).mockResolvedValue(true)
    vi.mocked(db.markCodeUsed).mockResolvedValue(true)
    vi.mocked(db.openDraft).mockResolvedValue(row())
    vi.mocked(contact.contactPrefill).mockRejectedValue(new Error('Brevo giù'))
    const res = await call(verifica, { body: { email: EMAIL, corso: CORSO, codice: '123456' } })
    expect(res.statusCode).toBe(200)
    expect(res.body.iscrizione.chi_sei).toEqual({ nome: '', cognome: '', telefono: '' })
  })
})

describe('/api/iscrizione/bozza', () => {
  it('senza cookie chiede di verificare l’email', async () => {
    const res = await call(bozza, { method: 'GET', query: { corso: CORSO } })
    expect(res.statusCode).toBe(401)
    expect(db.getEnrollment).not.toHaveBeenCalled()
  })

  it('il cookie vale solo per il corso verificato', async () => {
    const res = await call(bozza, { method: 'GET', query: { corso: 'corso-fashion-design-primo-livello' }, cookies: cookieFor() })
    expect(res.statusCode).toBe(401)
  })

  it('riprende la bozza di chi ha il cookie', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ nome: 'Mario', sezioni_complete: ['chi_sei'] }))
    const res = await call(bozza, { method: 'GET', query: { corso: CORSO }, cookies: cookieFor() })
    expect(res.statusCode).toBe(200)
    expect(res.body.iscrizione.prossima).toBe('corso')
    expect(db.getEnrollment).toHaveBeenCalledWith(row().id, EMAIL)
  })

  it('un’iscrizione già firmata non si modifica da qui', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ stato: 'firmata' }))
    const res = await call(bozza, { method: 'GET', query: { corso: CORSO }, cookies: cookieFor() })
    expect(res.statusCode).toBe(401)
  })

  it('segnala i campi mancanti del passo 1', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row())
    const res = await call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'chi_sei', valori: { nome: 'Mario' } }, cookies: cookieFor() })
    expect(res.statusCode).toBe(400)
    expect(Object.keys(res.body.errori)).toEqual(['cognome', 'telefono'])
    expect(db.saveChiSei).not.toHaveBeenCalled()
  })

  it('salva il passo 1 con l’email verificata e aggiorna il contatto', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row())
    vi.mocked(db.saveChiSei).mockImplementation(async (_id, _email, value, complete) =>
      row({ nome: value.nome, cognome: value.cognome, telefono: value.telefono, sezioni_complete: complete })
    )
    const res = await call(bozza, {
      method: 'PUT',
      body: { corso: CORSO, sezione: 'chi_sei', valori: { nome: 'Mario', cognome: 'Rossi', telefono: '333 123 4567', email: 'altra@miia.it' } },
      cookies: cookieFor(),
    })
    expect(res.statusCode).toBe(200)
    const value = { email: EMAIL, nome: 'Mario', cognome: 'Rossi', telefono: '+393331234567' }
    expect(db.saveChiSei).toHaveBeenCalledWith(row().id, EMAIL, value, ['chi_sei'])
    expect(contact.syncContact).toHaveBeenCalledWith(EMAIL, value)
    expect(res.body.iscrizione.prossima).toBe('corso')
  })

  it('le altre sezioni non si salvano ancora', async () => {
    vi.mocked(db.getEnrollment).mockResolvedValue(row({ sezioni_complete: ['chi_sei'] }))
    const res = await call(bozza, { method: 'PUT', body: { corso: CORSO, sezione: 'profilo', valori: {} }, cookies: cookieFor() })
    expect(res.statusCode).toBe(400)
  })
})
