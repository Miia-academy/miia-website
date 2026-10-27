import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@modules/brevo', () => ({ upsertContact: vi.fn(), trackEvent: vi.fn() }))

import handler, { parseAnswer } from '@pages/api/openday/risposta'
import { trackEvent, upsertContact } from '@modules/brevo'

const COOKIE = 'miia_openday_risposta'

function call({ method = 'POST', query = {}, cookies = {} }: { method?: string; query?: Record<string, string>; cookies?: Record<string, string> }) {
  const req = { method, query, cookies, headers: {} } as unknown as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, unknown>,
    location: '',
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
      this.location = url
      return this
    },
  }
  return Promise.resolve(handler(req, res as unknown as NextApiResponse)).then(() => res)
}

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', 'segreto-di-prova')
  vi.mocked(upsertContact).mockReset()
  vi.mocked(trackEvent).mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('/api/openday/risposta', () => {
  it('accetta solo tipo domanda o richiesta e valori semplici', () => {
    expect(parseAnswer({ email: 'A@b.it', tipo: 'domanda', d: 'Costi' })).toEqual({ email: 'a@b.it', tipo: 'domanda', valore: 'costi' })
    expect(parseAnswer({ email: 'a@b.it', tipo: 'altro', d: 'costi' })).toBeNull()
    expect(parseAnswer({ email: 'a@b.it', tipo: 'richiesta', d: '<script>' })).toBeNull()
    expect(parseAnswer({ email: 'no', tipo: 'richiesta', d: 'simone' })).toBeNull()
  })

  it('il link dell’email non scrive nulla: lascia un cookie firmato e apre /conferma', async () => {
    const res = await call({ method: 'GET', query: { email: 'test@miia.it', tipo: 'richiesta', d: 'simone' } })
    expect(res.statusCode).toBe(302)
    expect(res.location).toBe('/conferma?type=richiesta&d=simone')
    expect(String(res.headers['Set-Cookie'])).toMatch(new RegExp(`^${COOKIE}=.+HttpOnly`))
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('un link non valido porta alla home', async () => {
    const res = await call({ method: 'GET', query: { email: 'test@miia.it', tipo: 'x', d: 'simone' } })
    expect(res.location).toBe('/')
  })

  it('dalla pagina: salva la scelta sul contatto e manda submit_answer_form', async () => {
    const token = jwt.sign({ purpose: 'risposta', email: 'test@miia.it', tipo: 'domanda', valore: 'costi' }, 'segreto-di-prova')
    const res = await call({ cookies: { [COOKIE]: token } })
    expect(res.statusCode).toBe(200)
    expect(upsertContact).toHaveBeenCalledWith({ email: 'test@miia.it', attributes: { OPENDAY_DOMANDA: 'costi' } })
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'submit_answer_form',
      email: 'test@miia.it',
      properties: { tipo: 'domanda', valore: 'costi' },
    })
    expect(String(res.headers['Set-Cookie'])).toMatch(/Max-Age=0/)
  })

  it('senza cookie valido non scrive nulla', async () => {
    const res = await call({ cookies: { [COOKIE]: jwt.sign({ purpose: 'openday', email: 'test@miia.it' }, 'segreto-di-prova') } })
    expect(res.statusCode).toBe(400)
    expect(upsertContact).not.toHaveBeenCalled()
  })
})
