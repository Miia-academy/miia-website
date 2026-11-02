import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Domande prima di entrare nell'open day (moduli/accesso-open-day in Storyblok).
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    brevoFetch: vi.fn(),
    getContact: vi.fn(),
    upsertContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})

import accedi from '@pages/api/openday/accedi'
import domandeApi from '@pages/api/openday/domande'
import { getServerSideProps } from '@pages/open-day/accedi/[codice]'
import { BrevoError, brevoFetch, getContact, trackEvent, upsertContact } from '@modules/brevo'
import { parseInizio } from '@modules/openday-accesso'
import {
  attributiDaRisposte,
  daChiedere,
  domandeDelModulo,
  parseOpzioni,
  risposteValide,
  svuotaCacheTipi,
} from '@modules/openday-domande'

const MODULO = {
  title: 'Mentre aspetti, due domande veloci',
  message: 'Se preferisci, entra senza rispondere.',
  fields: [
    {
      id: 'interesse_inizio',
      input: 'select',
      label: 'Quando vorresti iniziare?',
      options: 'Alla prossima sessione:prossima\nTra qualche anno:futura\nNon ho ancora deciso:nessuna',
    },
    {
      id: 'interesse_scopo',
      input: 'select',
      label: 'Cosa ti porta qui?',
      options: 'Cambiare professione:lavoro\nAggiornare le competenze:aggiornamento',
    },
    {
      id: 'openday_domanda',
      input: 'select',
      label: 'Cosa vuoi scoprire oggi?',
      options: 'Il programma:programma\nCosti e rate:costi',
      ask_always: true,
    },
    { id: 'nome', input: 'text', label: 'Nome' },
    { id: 'interesse_sede', input: 'multiple', label: 'Sede', options: 'Treviso:treviso', hidden: true },
    { id: 'iscrizione_sede', input: 'select', label: 'Vietato', options: 'Treviso:treviso' },
  ],
}

const EVENTO = {
  slug: 'openday-interni-novembre',
  name: 'openday-interni-novembre',
  content: {
    date: '2026-11-16 21:00',
    title: 'Open day interior design',
    openday: 'interni - primo livello',
    link_meet: 'https://meet.google.com/abc-defg-hij',
  },
}

/** Storyblok finto: elenco degli eventi e storie singole per percorso. */
function storyblok(storie: Record<string, unknown> = { 'moduli/accesso-open-day': MODULO }, eventi = [EVENTO]) {
  const fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/v2/cdn/stories', '').replace(/^\//, '')
    if (!path) return new Response(JSON.stringify({ stories: eventi }))
    const content = storie[path]
    return content ? new Response(JSON.stringify({ story: { content } })) : new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const alle = (hhmm: string) => vi.useFakeTimers({ now: parseInizio(`2026-11-16 ${hhmm}`)!, toFake: ['Date'] })

function call(fn: typeof accedi, body: Record<string, unknown>, method = 'POST') {
  const req = { method, body } as unknown as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as any,
    headers: {} as Record<string, unknown>,
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
  return Promise.resolve(fn(req, res as unknown as NextApiResponse)).then(() => res)
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token')
  vi.mocked(getContact).mockReset()
  vi.mocked(trackEvent).mockReset()
  vi.mocked(upsertContact)
    .mockReset()
    .mockResolvedValue(undefined as never)
  vi.mocked(brevoFetch)
    .mockReset()
    .mockResolvedValue({
      attributes: [
        { name: 'INTERESSE_INIZIO', type: 'multiple-choice', category: 'normal' },
        { name: 'INTERESSE_SCOPO', type: 'multiple-choice', category: 'normal' },
        { name: 'OPENDAY_DOMANDA', type: 'text', category: 'normal' },
      ],
    } as never)
  svuotaCacheTipi()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('domande del modulo di accesso', () => {
  it('legge le opzioni "Etichetta:valore" e tiene solo i campi a scelta visibili e scrivibili', () => {
    expect(parseOpzioni('Costi e rate:costi\n\nsenza valore\nOre: 20:00:orari')).toEqual([
      { label: 'Costi e rate', value: 'costi' },
      { label: 'Ore: 20:00', value: 'orari' },
    ])
    expect(domandeDelModulo(MODULO).map((d) => d.id)).toEqual([
      'interesse_inizio',
      'interesse_scopo',
      'openday_domanda',
    ])
  })

  it('chiede solo gli attributi vuoti, più quelli con "Chiedi sempre", al massimo 3', () => {
    const domande = domandeDelModulo(MODULO)
    expect(daChiedere(domande, {}).map((d) => d.id)).toEqual(['interesse_inizio', 'interesse_scopo', 'openday_domanda'])
    expect(
      daChiedere(domande, { INTERESSE_INIZIO: ['prossima'], INTERESSE_SCOPO: [], OPENDAY_DOMANDA: 'costi' }).map(
        (d) => d.id,
      ),
    ).toEqual(['interesse_scopo', 'openday_domanda'])
    const tante = domandeDelModulo({
      fields: ['a', 'b', 'c', 'd'].map((x) => ({ id: `interesse_${x}`, input: 'select', options: 'Sì:si' })),
    })
    expect(daChiedere(tante)).toHaveLength(3)
  })

  it('accetta solo risposte previste e scrive liste o testo secondo il tipo in Brevo', () => {
    const domande = domandeDelModulo(MODULO)
    const risposte = risposteValide(domande, {
      interesse_inizio: ['prossima', 'futura'],
      interesse_scopo: 'inventato',
      openday_domanda: 'costi',
      iscrizione_sede: 'treviso',
    })
    expect(risposte).toEqual({ interesse_inizio: ['prossima'], openday_domanda: ['costi'] })
    expect(attributiDaRisposte(risposte, { INTERESSE_INIZIO: 'multiple-choice', OPENDAY_DOMANDA: 'text' })).toEqual({
      INTERESSE_INIZIO: ['prossima'],
      OPENDAY_DOMANDA: 'costi',
    })
  })
})

describe('/api/openday/domande', () => {
  it('dà le domande da fare al contatto, senza i suoi valori', async () => {
    alle('20:30')
    storyblok()
    vi.mocked(getContact).mockResolvedValue({ attributes: { INTERESSE_INIZIO: ['prossima'] } } as never)
    const res = await call(domandeApi, { codice: 'openday-interni-novembre', email: 'Test@Miia.it' })
    expect(res.body.titolo).toBe('Mentre aspetti, due domande veloci')
    expect(res.body.domande.map((d: { id: string }) => d.id)).toEqual(['interesse_scopo', 'openday_domanda'])
    expect(JSON.stringify(res.body)).not.toContain('prossima"]')
  })

  it('per un’email sconosciuta risponde come per un contatto senza risposte', async () => {
    alle('20:30')
    storyblok()
    vi.mocked(getContact).mockRejectedValue(new BrevoError(404, 'Contact not found'))
    const res = await call(domandeApi, { codice: 'openday-interni-novembre', email: 'nuovo@miia.it' })
    expect(res.body.domande).toHaveLength(3)
  })

  it('usa il "Modulo di accesso" dell’evento e, se manca, quello generale', async () => {
    alle('20:30')
    const uuid = 'bb465794-1ca7-4407-90cf-9a7865760c68'
    const conModulo = { ...EVENTO, content: { ...EVENTO.content, modulo_accesso: uuid } }
    const fetchMock = storyblok(
      { [uuid]: { title: 'Solo moda', fields: [MODULO.fields[2]] }, 'moduli/accesso-open-day': MODULO },
      [conModulo],
    )
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    const res = await call(domandeApi, { codice: 'openday-interni-novembre', email: 'test@miia.it' })
    expect(res.body.titolo).toBe('Solo moda')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('find_by=uuid'))).toBe(true)

    storyblok({ 'moduli/accesso-open-day': MODULO }, [conModulo])
    const generale = await call(domandeApi, { codice: 'openday-interni-novembre', email: 'test@miia.it' })
    expect(generale.body.titolo).toBe('Mentre aspetti, due domande veloci')
  })

  it('senza modulo in Storyblok non chiede nulla', async () => {
    alle('20:30')
    storyblok({})
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    const res = await call(domandeApi, { codice: 'openday-interni-novembre', email: 'test@miia.it' })
    expect(res.body.domande).toEqual([])
  })
})

describe('/api/openday/accedi con le risposte', () => {
  it('salva le risposte sul contatto e le manda nell’evento submit_presence_form', async () => {
    alle('21:05')
    storyblok()
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    const res = await call(accedi, {
      codice: 'openday-interni-novembre',
      email: 'test@miia.it',
      risposte: { interesse_inizio: ['prossima'], interesse_scopo: [], openday_domanda: ['costi'], ok: 'no' },
    })
    expect(res.body.link).toBe('https://meet.google.com/abc-defg-hij')
    const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes!
    expect(attributes.INTERESSE_INIZIO).toEqual(['prossima'])
    expect(attributes.OPENDAY_DOMANDA).toBe('costi')
    // Una domanda saltata non cancella il valore che c'era
    expect(attributes).not.toHaveProperty('INTERESSE_SCOPO')
    expect(attributes.OPENDAY_PRESENTE).toBe(true)
    const properties = vi.mocked(trackEvent).mock.calls[0][0].properties!
    expect(properties.interesse_inizio).toBe('prossima')
    expect(properties.openday_domanda).toBe('costi')
    expect(properties).not.toHaveProperty('ok')
    expect(properties.openday_codice).toBe('openday-interni-novembre')
  })

  it('senza risposte non legge il modulo né i tipi degli attributi', async () => {
    alle('21:05')
    const fetchMock = storyblok()
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    await call(accedi, { codice: 'openday-interni-novembre', email: 'test@miia.it' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(brevoFetch).not.toHaveBeenCalled()
  })

  it('se Brevo non dà i tipi degli attributi la persona entra e le risposte restano nell’evento', async () => {
    alle('21:05')
    storyblok()
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    vi.mocked(brevoFetch).mockRejectedValue(new Error('down'))
    const res = await call(accedi, {
      codice: 'openday-interni-novembre',
      email: 'test@miia.it',
      risposte: { openday_domanda: 'costi' },
    })
    expect(res.body.link).toBeTruthy()
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).not.toHaveProperty('OPENDAY_DOMANDA')
    expect(vi.mocked(trackEvent).mock.calls[0][0].properties!.openday_domanda).toBe('costi')
  })
})

describe('pagina /open-day/accedi/<codice>', () => {
  const context = (query: Record<string, string>) =>
    ({
      params: { codice: 'openday-interni-novembre' },
      query,
      res: { setHeader: () => {} },
    }) as unknown as GetServerSidePropsContext

  it('con l’email nel link prepara già le domande', async () => {
    alle('20:30')
    storyblok()
    vi.mocked(getContact).mockResolvedValue({ attributes: { OPENDAY_DOMANDA: 'costi' } } as never)
    const result = (await getServerSideProps(context({ email: 'test@miia.it' }))) as { props: any }
    expect(result.props.accesso.domande.map((d: { id: string }) => d.id)).toEqual([
      'interesse_inizio',
      'interesse_scopo',
      'openday_domanda',
    ])
    expect(JSON.stringify(result.props)).not.toContain('meet.google.com')
  })

  it('senza email le domande arrivano dopo, dall’API', async () => {
    alle('20:30')
    storyblok()
    const result = (await getServerSideProps(context({}))) as { props: any }
    expect(result.props.accesso).toBeNull()
    expect(getContact).not.toHaveBeenCalled()
  })
})
