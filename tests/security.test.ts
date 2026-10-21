import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake Brevo and storage: no real calls
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    brevoFetch: vi.fn(),
    getContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})
vi.mock('@modules/jobs/db', () => ({ getJobById: vi.fn() }))
vi.mock('@modules/applications/db', () => ({ createApplication: vi.fn() }))

import adminLogin from '@pages/api/admin/login'
import checkContact from '@pages/api/admin/check-contact'
import apply from '@pages/api/job/apply'
import exitPreview from '@pages/api/exit'
import { brevoFetch, getContact, trackEvent } from '@modules/brevo'
import { getJobById } from '@modules/jobs/db'
import { createApplication } from '@modules/applications/db'
import { parseUpload, safeFileName } from '@modules/uploads'

const SECRET = 'test-secret'

type Handler = (req: NextApiRequest, res: NextApiResponse) => unknown

function call(handler: Handler, req: Partial<NextApiRequest>) {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: {} as Record<string, unknown>,
    redirectedTo: undefined as string | undefined,
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
    getHeader(name: string) {
      return this.headers[name]
    },
    redirect(target: string) {
      this.statusCode = 307
      this.redirectedTo = target
      return this
    },
    setDraftMode() {
      return this
    },
  }
  const fullReq = { method: 'POST', headers: {}, cookies: {}, query: {}, body: {}, ...req } as NextApiRequest
  return Promise.resolve(handler(fullReq, res as unknown as NextApiResponse)).then(() => res)
}

const session = (payload: object) => ({ miia_auth_token: jwt.sign(payload, SECRET) })

beforeEach(() => {
  vi.stubEnv('JWT_SECRET', SECRET)
  vi.mocked(getContact).mockReset()
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('admin login', () => {
  it('without ADMIN_EMAIL and ADMIN_PASSWORD nobody gets in, not even with an empty request', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')
    vi.stubEnv('ADMIN_PASSWORD', '')
    const res = await call(adminLogin, { body: {} })
    expect(res.statusCode).toBe(401)
    expect(res.headers['Set-Cookie']).toBeUndefined()
  })

  it('wrong password: refused', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@miia.it')
    vi.stubEnv('ADMIN_PASSWORD', 'giusta')
    const res = await call(adminLogin, { body: { email: 'admin@miia.it', password: 'sbagliata' } })
    expect(res.statusCode).toBe(401)
  })

  it('right credentials: session cookie', async () => {
    vi.stubEnv('ADMIN_EMAIL', 'admin@miia.it')
    vi.stubEnv('ADMIN_PASSWORD', 'giusta')
    const res = await call(adminLogin, { body: { email: 'admin@miia.it', password: 'giusta' } })
    expect(res.statusCode).toBe(200)
    expect(String((res.headers['Set-Cookie'] as string[])[0])).toMatch(/^miia_auth_token=/)
  })
})

describe('/api/admin/check-contact', () => {
  it('a student session cannot read the Brevo attributes', async () => {
    const res = await call(checkContact, {
      method: 'GET',
      cookies: session({ email: 's@miia.it', tipo_utente: 'Studente' }),
    })
    expect(res.statusCode).toBe(403)
    expect(brevoFetch).not.toHaveBeenCalled()
  })
})

describe('/api/job/apply', () => {
  it('ignores a CV link sent by the browser and uses the one in the profile', async () => {
    vi.mocked(getJobById).mockResolvedValue({ id: 'j1', title: 'T', company_email: 'a@b.it', provincie: [] } as never)
    vi.mocked(createApplication).mockResolvedValue({ id: 'a1' } as never)
    vi.mocked(getContact).mockResolvedValue({ attributes: { CV_URL: '/api/job/download?file=cv%2Fmio.pdf' } } as never)

    const res = await call(apply, {
      cookies: session({ email: 's@miia.it', tipo_utente: 'Studente' }),
      body: { jobId: 'j1', cv_url: '/api/job/download?file=cv%2Faltro.pdf' },
    })

    expect(res.statusCode).toBe(200)
    expect(createApplication).toHaveBeenCalledWith(
      expect.objectContaining({ cv_url: '/api/job/download?file=cv%2Fmio.pdf' })
    )
  })

  it('without a CV in the profile: refused, even if the browser sends one', async () => {
    vi.mocked(getJobById).mockResolvedValue({ id: 'j1', title: 'T', company_email: 'a@b.it', provincie: [] } as never)
    vi.mocked(createApplication).mockReset()
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)

    const res = await call(apply, {
      cookies: session({ email: 's@miia.it', tipo_utente: 'Studente' }),
      body: { jobId: 'j1', cv_url: 'https://altro.sito/cv.pdf' },
    })

    expect(res.statusCode).toBe(400)
    expect(createApplication).not.toHaveBeenCalled()
  })
})

describe('/api/exit', () => {
  it.each([
    ['corsi/interior-design', '/corsi/interior-design'],
    ['/evil.com', '/evil.com'],
    ['//evil.com', '/evil.com'],
    ['/\\evil.com', '/evil.com'],
    ['https://evil.com', '/'],
  ])('slug %s → %s', async (slug, target) => {
    const res = await call(exitPreview, { method: 'GET', query: { slug } })
    expect(res.redirectedTo).toBe(target)
  })
})

describe('uploads', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]).toString('base64')
  const pdf = Buffer.from('%PDF-1.7 test').toString('base64')
  const html = Buffer.from('<html><script>alert(1)</script></html>').toString('base64')
  const rules = { kinds: ['png' as const, 'jpeg' as const, 'webp' as const], maxBytes: 1000, label: 'logo', formats: 'PNG, JPG o WebP' }

  it('nothing uploaded: null', () => {
    expect(parseUpload('', rules)).toBeNull()
  })

  it('type decided from the content, with or without the data: prefix', () => {
    expect(parseUpload(`data:text/html;base64,${png}`, rules)?.mime).toBe('image/png')
    expect(parseUpload(pdf, { ...rules, kinds: ['pdf'] })?.ext).toBe('pdf')
  })

  it('a page disguised as an image is refused', () => {
    expect(() => parseUpload(html, rules)).toThrow('Formato del logo non valido: usa PNG, JPG o WebP.')
  })

  it('too big: refused', () => {
    expect(() => parseUpload(png, { ...rules, maxBytes: 5 })).toThrow('supera la dimensione massima')
  })

  it('file names: only safe characters and the real extension', () => {
    expect(safeFileName('Il mio CV (2026).html', 'pdf')).toBe('il-mio-cv-2026.pdf')
    expect(safeFileName(undefined, 'png')).toBe('file.png')
  })
})
