import { createHmac } from 'crypto'
import { Readable } from 'stream'
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Newsletter dagli articoli: il webhook di pubblicazione di Storyblok crea in Brevo
// una campagna in bozza (mai inviata) per il segmento del pubblico scelto.
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return { BrevoError: actual.BrevoError, brevoFetch: vi.fn() }
})

import handler from '@pages/api/storyblok/newsletter'
import { brevoFetch } from '@modules/brevo'
import { compilaLayout, datiNewsletter, firmaValida, type ArticoloNewsletter } from '@modules/newsletter'

const SECRET = 'segreto-webhook'
const LAYOUT =
  '<a href="{{ params.LINK }}?utm_source=brevo"><img src="{{ params.IMMAGINE }}" alt="{{ params.TITOLO }}"/></a>' +
  '<h1>{{ params.TITOLO }}</h1><p>{{params.INTRO}}</p><a href="{{ params.LINK }}">Leggi</a><a href="{{ unsubscribe }}">x</a>'

function articolo(content: Partial<ArticoloNewsletter['content']> = {}): ArticoloNewsletter {
  return {
    id: 123,
    name: 'Nome',
    full_slug: 'blog/interior-design/luce-naturale',
    content: {
      component: 'article',
      title: 'La luce naturale',
      description: 'Come progettare con la luce.',
      image: { filename: 'https://a.storyblok.com/f/311109/1200x627/abc/luce.jpg' },
      newsletter: true,
      newsletter_pubblico: 'interni',
      ...content,
    },
  }
}

function firma(body: string) {
  return createHmac('sha1', SECRET).update(body).digest('hex')
}

async function call(evento: object, { signature }: { signature?: string } = {}) {
  const body = JSON.stringify(evento)
  const req = Readable.from([Buffer.from(body)]) as unknown as NextApiRequest
  Object.assign(req, { method: 'POST', headers: { 'webhook-signature': signature ?? firma(body) } })
  const res = { statusCode: 0, body: undefined as any, headers: {} as Record<string, string> }
  const api = {
    status(code: number) {
      res.statusCode = code
      return api
    },
    json(data: unknown) {
      res.body = data
      return api
    },
    setHeader(k: string, v: string) {
      res.headers[k] = v
    },
  }
  await handler(req, api as unknown as NextApiResponse)
  return res
}

function storyblokRisponde(story: ArticoloNewsletter | null) {
  vi.stubGlobal('fetch', vi.fn(async () => (story ? new Response(JSON.stringify({ story })) : new Response('{}', { status: 404 }))))
}

beforeEach(() => {
  vi.stubEnv('STORYBLOK_WEBHOOK_SECRET', SECRET)
  vi.stubEnv('STORYBLOK_TOKEN', 'tok')
  vi.stubEnv('BREVO_NEWSLETTER_SEGMENT_INTERNI', '31')
  vi.stubEnv('BREVO_NEWSLETTER_SEGMENT_MODA', '32')
  vi.stubEnv('BREVO_NEWSLETTER_SEGMENT_TUTTI', '33')
  vi.mocked(brevoFetch).mockReset()
  vi.mocked(brevoFetch).mockImplementation(async (endpoint: string, opts: any = {}) => {
    if (endpoint === '/emailCampaigns' && opts.method === 'GET') return { campaigns: [] }
    if (endpoint.startsWith('/smtp/templates/')) return { htmlContent: LAYOUT }
    if (endpoint === '/emailCampaigns' && opts.method === 'POST') return { id: 900 }
    throw new Error(`inatteso ${endpoint}`)
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function campagnaCreata() {
  const post = vi.mocked(brevoFetch).mock.calls.find(([e, o]: any) => e === '/emailCampaigns' && o?.method === 'POST')
  return post?.[1]?.body as any
}

describe('dati della mail', () => {
  it('i campi vuoti della scheda Newsletter prendono titolo e riassunto dell\'articolo', () => {
    const d = datiNewsletter(articolo())
    expect(d).toMatchObject({
      titolo: 'La luce naturale',
      intro: 'Come progettare con la luce.',
      oggetto: 'La luce naturale',
      anteprima: 'Come progettare con la luce.',
      link: 'https://miia.it/blog/interior-design/luce-naturale',
      immagine: 'https://a.storyblok.com/f/311109/1200x627/abc/luce.jpg/m/1200x0',
      pubblico: 'interni',
    })
  })

  it('i campi compilati vincono, senza pubblico vale generico', () => {
    const d = datiNewsletter(
      articolo({ newsletter_oggetto: 'Oggetto', newsletter_intro: 'Intro mail', newsletter_pubblico: '' })
    )
    expect(d.oggetto).toBe('Oggetto')
    expect(d.intro).toBe('Intro mail')
    expect(d.pubblico).toBe('generico')
  })

  it('il layout riceve i dati con l\'HTML protetto e senza UTM del modello', () => {
    const html = compilaLayout(LAYOUT, datiNewsletter(articolo({ newsletter_intro: 'Riga 1 <b>\nRiga 2' })))
    expect(html).toContain('<a href="https://miia.it/blog/interior-design/luce-naturale">')
    expect(html).not.toContain('utm_source')
    expect(html).toContain('<p>Riga 1 &lt;b&gt;<br/>Riga 2</p>')
    expect(html).not.toContain('params.')
    expect(html).toContain('{{ unsubscribe }}')
  })

  it('senza immagine toglie il tag img', () => {
    const html = compilaLayout(LAYOUT, datiNewsletter(articolo({ image: null })))
    expect(html).not.toContain('<img')
  })

  it('controlla la firma del webhook', () => {
    expect(firmaValida('abc', firma('abc'), SECRET)).toBe(true)
    expect(firmaValida('abc', firma('abd'), SECRET)).toBe(false)
    expect(firmaValida('abc', undefined, SECRET)).toBe(false)
  })
})

describe('webhook /api/storyblok/newsletter', () => {
  it('rifiuta una firma sbagliata senza toccare Brevo', async () => {
    storyblokRisponde(articolo())
    const res = await call({ action: 'published', story_id: 123 }, { signature: 'falsa' })
    expect(res.statusCode).toBe(401)
    expect(brevoFetch).not.toHaveBeenCalled()
  })

  it('senza segreto configurato non fa niente', async () => {
    vi.stubEnv('STORYBLOK_WEBHOOK_SECRET', '')
    const res = await call({ action: 'published', story_id: 123 })
    expect(res.statusCode).toBe(503)
  })

  it('crea la bozza per il segmento del pubblico scelto, senza programmarla', async () => {
    storyblokRisponde(articolo({ newsletter_pubblico: 'moda' }))
    const res = await call({ action: 'published', story_id: 123 })
    expect(res.statusCode).toBe(201)
    const body = campagnaCreata()
    expect(body).toMatchObject({
      name: 'Newsletter - La luce naturale [articolo 123]',
      subject: 'La luce naturale',
      sender: { id: 1, name: 'Miia - info' },
      recipients: { segmentIds: [32] },
      tag: 'newsletter',
    })
    expect(body.scheduledAt).toBeUndefined()
    expect(body.htmlContent).toContain('<h1>La luce naturale</h1>')
  })

  it('non crea un doppione se l\'articolo viene ripubblicato', async () => {
    storyblokRisponde(articolo())
    vi.mocked(brevoFetch).mockImplementation(async (endpoint: string, opts: any = {}) => {
      if (endpoint === '/emailCampaigns' && opts.method === 'GET') {
        return { campaigns: [{ id: 77, name: 'Newsletter - La luce naturale [articolo 123]' }] }
      }
      throw new Error(`inatteso ${endpoint}`)
    })
    const res = await call({ action: 'published', story_id: 123 })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ esito: 'già creata', campagna: 77 })
    expect(campagnaCreata()).toBeUndefined()
  })

  it('ignora articoli senza la casella e altre azioni', async () => {
    storyblokRisponde(articolo({ newsletter: false }))
    expect((await call({ action: 'published', story_id: 123 })).body.esito).toBe('nessuna newsletter')
    expect((await call({ action: 'unpublished', story_id: 123 })).body.esito).toBe('ignorato')
    storyblokRisponde({ ...articolo(), content: { component: 'page', newsletter: true } })
    expect((await call({ action: 'published', story_id: 123 })).body.esito).toBe('nessuna newsletter')
    expect(brevoFetch).not.toHaveBeenCalled()
  })

  it('senza segmento configurato non crea niente e lo segnala', async () => {
    vi.stubEnv('BREVO_NEWSLETTER_SEGMENT_INTERNI', '')
    storyblokRisponde(articolo())
    const res = await call({ action: 'published', story_id: 123 })
    expect(res.statusCode).toBe(500)
    expect(campagnaCreata()).toBeUndefined()
  })
})
