import type { NextApiRequest, NextApiResponse } from 'next'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Brevo simulato: nessuna chiamata reale, registriamo solo cosa verrebbe inviato.
vi.mock('@modules/brevo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modules/brevo')>()
  return {
    BrevoError: actual.BrevoError,
    getContact: vi.fn(),
    upsertContact: vi.fn(),
    trackEvent: vi.fn(),
  }
})

// Open day details (OD_*, PREZZO_*) are tested in openday-details.test.ts
vi.mock('@modules/openday-details', () => ({ loadOpendayDetails: vi.fn(async () => ({})) }))

import handler from '@pages/api/crm'
import { BrevoError, getContact, trackEvent, upsertContact } from '@modules/brevo'
import { loadOpendayDetails } from '@modules/openday-details'

const TEST_EMAIL = 'test+gtm@miia.it'

function call(body: unknown, method = 'POST') {
  const req = { method, body } as NextApiRequest
  const res = {
    statusCode: 200,
    body: undefined as unknown,
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
  return handler(req, res as unknown as NextApiResponse).then(() => res)
}

const newContact = () =>
  vi.mocked(getContact).mockRejectedValue(new BrevoError(404, 'Contact not found'))

beforeEach(() => {
  vi.mocked(getContact).mockReset()
  vi.mocked(upsertContact).mockReset().mockResolvedValue(undefined as never)
  vi.mocked(trackEvent).mockReset().mockResolvedValue(undefined as never)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('/api/crm', () => {
  it('accetta solo POST', async () => {
    const res = await call({}, 'GET')
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toEqual(['POST'])
    expect(getContact).not.toHaveBeenCalled()
  })

  it('rifiuta un modulo senza email valida', async () => {
    const res = await call({ contact: { email: 'non-valida' } })
    expect(res.statusCode).toBe(400)
    expect(upsertContact).not.toHaveBeenCalled()
  })

  it('nuovo contatto: salva attributi e liste ammessi e registra l\'evento', async () => {
    newContact()
    const res = await call({
      contact: {
        email: ' Test+GTM@miia.it ',
        attributes: { NOME: 'Prova', SMS: '333 1234567', TIPO_UTENTE: 'Admin' },
        listIds: [15, 42],
      },
      event: { event_name: 'submit_openday_form', event_properties: { corso: 'Interior' } },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ success: true, returning: false })
    expect(upsertContact).toHaveBeenCalledOnce()
    expect(upsertContact).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      attributes: { NOME: 'Prova', SMS: '+393331234567' },
      listIds: [15],
    })
    expect(trackEvent).toHaveBeenCalledWith({
      eventName: 'submit_openday_form',
      email: TEST_EMAIL,
      properties: { corso: 'Interior' },
    })
  })

  it('evento leggero: solo le proprietà dell’elenco fisso', async () => {
    newContact()
    await call({
      contact: { email: TEST_EMAIL },
      event: {
        event_name: 'submit_brochure_form',
        event_properties: { area: 'interior', programma: 'primo', finalita: 'lavoro', sede: 'treviso', messaggio: 'ciao' },
      },
    })
    expect(vi.mocked(trackEvent).mock.calls[0][0].properties).toEqual({ area: 'interior', programma: 'primo' })
  })

  it('nomi vecchi senza _form non partono più', async () => {
    newContact()
    await call({ contact: { email: TEST_EMAIL }, event: { event_name: 'submit_download' } })
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('contatto già in Brevo: unisce le scelte multiple e risponde returning', async () => {
    vi.mocked(getContact).mockResolvedValue({ attributes: { CORSI: ['Moda'] } } as never)
    const res = await call({
      contact: { email: TEST_EMAIL, attributes: { CORSI: ['Interior'] } },
    })

    expect(res.body).toEqual({ success: true, returning: true })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toEqual({
      CORSI: ['Moda', 'Interior'],
    })
  })

  it('iscrizione a un open day: salva il codice e azzera presenza e ritardo precedenti', async () => {
    vi.mocked(getContact).mockResolvedValue({ attributes: { OPENDAY_PRESENTE: true } } as never)
    await call({
      contact: {
        email: TEST_EMAIL,
        attributes: { OPENDAY_DATA: '2026-11-16T20:00:00.000Z', OPENDAY_CODICE: 'openday-interni-novembre', OPENDAY_PRESENTE: true },
      },
    })
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toEqual({
      OPENDAY_DATA: '2026-11-16T20:00:00.000Z',
      OPENDAY_CODICE: 'openday-interni-novembre',
      OPENDAY_PRESENTE: false,
      OPENDAY_RITARDO: false,
    })
  })

  it('open day sign-up: adds the details of that open day from Storyblok', async () => {
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    vi.mocked(loadOpendayDetails).mockResolvedValueOnce({ OPENDAY_VALIDO: true, OPENDAY_PARTENZA_TESTO: 'marzo 2027', INTERESSE_CORSO: 1 })
    await call({
      contact: {
        email: TEST_EMAIL,
        attributes: { OPENDAY_DATA: '2026-11-16T20:00:00.000Z', OPENDAY_CODICE: 'openday-interni-novembre', OPENDAY_VALIDO: false },
      },
    })
    expect(loadOpendayDetails).toHaveBeenCalledWith('openday-interni-novembre')
    expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toMatchObject({ OPENDAY_VALIDO: true, OPENDAY_PARTENZA_TESTO: 'marzo 2027', INTERESSE_CORSO: 1 })
  })

  it('other forms do not load open day details', async () => {
    vi.mocked(getContact).mockResolvedValue({ attributes: {} } as never)
    vi.mocked(loadOpendayDetails).mockClear()
    await call({ contact: { email: TEST_EMAIL, attributes: { NOME: 'Anna' } } })
    expect(loadOpendayDetails).not.toHaveBeenCalled()
  })

  it('non restituisce mai i dati del contatto al browser', async () => {
    vi.mocked(getContact).mockResolvedValue({
      email: TEST_EMAIL,
      attributes: { NOME: 'Segreto', SMS: '+393331234567' },
    } as never)
    const res = await call({ contact: { email: TEST_EMAIL } })
    expect(JSON.stringify(res.body)).not.toContain('Segreto')
    expect(JSON.stringify(res.body)).not.toContain('+39333')
  })

  it('bot (campo nascosto compilato): risponde ok ma non scrive nulla', async () => {
    const res = await call({
      contact: { email: TEST_EMAIL, attributes: { NOME: 'Bot' } },
      fields: { validation: 'compilato' },
    })
    expect(res.statusCode).toBe(200)
    expect(getContact).not.toHaveBeenCalled()
    expect(upsertContact).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('evento con nome non ammesso: salva il contatto ma non registra l\'evento', async () => {
    newContact()
    await call({ contact: { email: TEST_EMAIL }, event: { event_name: 'delete_all' } })
    expect(upsertContact).toHaveBeenCalledOnce()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('se Brevo rifiuta un attributo, salva comunque nome, cognome e telefono', async () => {
    newContact()
    vi.mocked(upsertContact)
      .mockRejectedValueOnce(new BrevoError(400, 'Invalid attribute value'))
      .mockResolvedValueOnce(undefined as never)

    const res = await call({
      contact: {
        email: TEST_EMAIL,
        attributes: { NOME: 'Prova', COGNOME: 'Test', SMS: '3331234567', CORSI: ['Inesistente'] },
        listIds: [16],
      },
    })

    expect(res.statusCode).toBe(200)
    expect(upsertContact).toHaveBeenCalledTimes(2)
    expect(vi.mocked(upsertContact).mock.calls[1][0]).toEqual({
      email: TEST_EMAIL,
      attributes: { NOME: 'Prova', COGNOME: 'Test', SMS: '+393331234567' },
      listIds: [16],
    })
  })

  it('se Brevo non risponde, il modulo riceve un errore generico', async () => {
    vi.mocked(getContact).mockRejectedValue(new BrevoError(500, 'Internal error'))
    const res = await call({ contact: { email: TEST_EMAIL } })
    expect(res.statusCode).toBe(502)
    expect(upsertContact).not.toHaveBeenCalled()
  })

  describe('provenienza', () => {
    const source = {
      first: { source: 'google', medium: 'cpc', campaign: 'openday', date: '2026-10-01T10:00:00Z' },
      last: { source: 'newsletter', medium: 'email', campaign: 'reminder', date: '2026-10-10T10:00:00Z' },
    }

    it('spenta (default): nessun attributo ORIGINE o ULTIMA', async () => {
      newContact()
      await call({ contact: { email: TEST_EMAIL, attributes: { NOME: 'Prova' } }, source })
      expect(vi.mocked(upsertContact).mock.calls[0][0].attributes).toEqual({ NOME: 'Prova' })
    })

    it('accesa: nuovo contatto riceve ORIGINE e ULTIMA', async () => {
      vi.stubEnv('CRM_SOURCE_ATTRIBUTES', 'on')
      newContact()
      await call({ contact: { email: TEST_EMAIL }, source })
      const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes
      expect(attributes).toMatchObject({
        ORIGINE_SORGENTE: 'google',
        ORIGINE_CAMPAGNA: 'openday',
        ULTIMA_SORGENTE: 'newsletter',
        ULTIMA_CAMPAGNA: 'reminder',
      })
    })

    it('accesa: contatto con ORIGINE già salvata aggiorna solo ULTIMA', async () => {
      vi.stubEnv('CRM_SOURCE_ATTRIBUTES', 'on')
      vi.mocked(getContact).mockResolvedValue({
        attributes: { ORIGINE_SORGENTE: 'facebook' },
      } as never)
      await call({ contact: { email: TEST_EMAIL }, source })
      const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes!
      expect(Object.keys(attributes).filter((k) => k.startsWith('ORIGINE_'))).toEqual([])
      expect(attributes.ULTIMA_SORGENTE).toBe('newsletter')
    })

    it('il browser non può scrivere ORIGINE direttamente negli attributi', async () => {
      vi.stubEnv('CRM_SOURCE_ATTRIBUTES', 'on')
      vi.mocked(getContact).mockResolvedValue({
        attributes: { ORIGINE_SORGENTE: 'facebook' },
      } as never)
      await call({ contact: { email: TEST_EMAIL, attributes: { ORIGINE_SORGENTE: 'falsa' } } })
      const attributes = vi.mocked(upsertContact).mock.calls[0][0].attributes!
      expect(attributes).not.toHaveProperty('ORIGINE_SORGENTE')
    })

    it('accesa: la provenienza va anche nell’evento Brevo che avvia le automazioni', async () => {
      vi.stubEnv('CRM_SOURCE_ATTRIBUTES', 'on')
      newContact()
      await call({ contact: { email: TEST_EMAIL }, event: { event_name: 'submit_openday_form' }, source })
      const properties = vi.mocked(trackEvent).mock.calls[0][0].properties
      expect(properties).toMatchObject({ ultima_campagna: 'reminder' })
      // Evento leggero: la prima provenienza resta solo sul contatto
      expect(properties).not.toHaveProperty('origine_sorgente')
    })

    it('spenta: l’evento parte senza provenienza', async () => {
      newContact()
      await call({ contact: { email: TEST_EMAIL }, event: { event_name: 'submit_openday_form' }, source })
      expect(vi.mocked(trackEvent).mock.calls[0][0].properties).toEqual({})
    })
  })

  it('modulo newsletter: la lista 43 "Studenti - newsletter" è ammessa, la 42 no', async () => {
    newContact()
    await call({ contact: { email: TEST_EMAIL, listIds: [43, 42, 18] } })
    expect(vi.mocked(upsertContact).mock.calls[0][0].listIds).toEqual([43])
  })
})
