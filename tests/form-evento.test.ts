import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Dati che i moduli del sito mandano a /api/crm (PR #66, #72): l'evento Brevo porta
// la data dell'open day, il codice per la pagina accedi e i docenti per le email.
import { buildContact, buildEvent, type FormData } from '@components/form'
import type { ProcessedEvent } from '@modules/cache'

const docente = (title: string) => ({ uuid: title, content: { component: 'person', title } })

const evento = (over: Partial<ProcessedEvent>): ProcessedEvent =>
  ({
    uuid: 'u',
    slug: 'openday-interni-novembre',
    name: 'openday-interni-novembre',
    isOpenday: true,
    date: '2026-11-16T20:00:00.000Z',
    openday: 'interni - primo livello',
    ...over,
  }) as ProcessedEvent

const EVENTI = [
  evento({ docenti: [docente('Anna Rossi'), docente('Marco Bianchi')] as any }),
  evento({ slug: 'openday-moda-novembre', name: 'openday-moda-novembre', openday: 'moda - primo livello', date: '2026-11-17T20:00:00.000Z' }),
  evento({ slug: 'openday-interni-ottobre', name: 'openday-interni-ottobre', date: '2026-10-12T19:00:00.000Z' }),
]

const campo = (value: unknown) => ({ id: 'x', value, error: null }) as any

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('evento del modulo open day', () => {
  it('con l’area sceglie il prossimo open day e aggiunge codice e docenti', () => {
    const data: FormData = { email: campo('test@miia.it'), area: campo(['Interni']) }
    const event = buildEvent(data, EVENTI, 'open_day')
    expect(event.event_name).toBe('submit_open_day')
    expect(event.event_properties).toMatchObject({
      openday: '2026-11-16T20:00:00.000Z',
      openday_codice: 'openday-interni-novembre',
      openday_docenti: 'Anna Rossi e Marco Bianchi',
    })
    // L'email non finisce tra le proprietà dell'evento
    expect(event.event_properties.email).toBeUndefined()
  })

  it('con la data scelta nel modulo trova l’open day esatto', () => {
    const data: FormData = { email: campo('test@miia.it'), openday: campo('2026-11-17T20:00:00.000Z') }
    const event = buildEvent(data, EVENTI, 'open_day')
    expect(event.event_properties.openday_codice).toBe('openday-moda-novembre')
    expect(event.event_properties.openday_docenti).toBeUndefined()
  })

  it('un modulo senza open day non inventa codici', () => {
    const data: FormData = { email: campo('test@miia.it'), nome: campo('Anna'), scopo: campo('lavoro') }
    const event = buildEvent(data, EVENTI, 'download')
    expect(event.event_name).toBe('submit_download')
    expect(event.event_properties).toEqual({ scopo: 'lavoro' })
  })
})

describe('contatto del modulo', () => {
  it('nomi degli attributi in maiuscolo, liste del modulo, email a parte', () => {
    const contact = buildContact({ email: campo('test@miia.it'), nome: campo('Anna') }, [16, 25])
    expect(contact).toEqual({ email: 'test@miia.it', listIds: [16, 25], attributes: { NOME: 'Anna' } })
  })
})
