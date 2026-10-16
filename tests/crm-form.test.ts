import { describe, expect, it, vi } from 'vitest'
import {
  getAllowedLists,
  isBotSubmission,
  isSourceTrackingEnabled,
  normalizeEmail,
  normalizePhone,
  sanitizeAttribution,
  sanitizeAttributes,
  sanitizeEventName,
  sanitizeEventProperties,
  sanitizeLists,
} from '@modules/crm-form'

describe('normalizeEmail', () => {
  it('pulisce spazi e maiuscole', () => {
    expect(normalizeEmail('  Test+GTM@Miia.IT ')).toBe('test+gtm@miia.it')
  })

  it('rifiuta valori non validi', () => {
    expect(normalizeEmail('non-una-email')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(250)}@miia.it`)).toBeNull()
  })
})

describe('normalizePhone', () => {
  it.each([
    ['333 123 4567', '+393331234567'],
    ['+39 333-123-4567', '+393331234567'],
    ['0039 333 1234567', '+393331234567'],
    ['+39+393331234567', '+393331234567'],
    ['(333) 123.4567', '+393331234567'],
    ['+41 79 123 45 67', '+41791234567'],
    // Come lo restituisce Brevo: internazionale senza "+"
    ['393494519729', '+393494519729'],
    ['39333123456', '+39333123456'],
    ['3921234567', '+393921234567'],
    [393494519729, '+393494519729'],
  ])('%s diventa %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it('rifiuta numeri non plausibili', () => {
    expect(normalizePhone('123')).toBeNull()
    // Prefisso aggiunto due volte: troppe cifre per un numero italiano
    expect(normalizePhone('+39393494519729')).toBeNull()
    expect(normalizePhone('abc')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe('sanitizeAttributes', () => {
  it('tiene gli attributi del modulo', () => {
    expect(
      sanitizeAttributes({ nome: ' Anna ', COGNOME: 'Rossi', PRIVACY: true, ETA: 25 })
    ).toEqual({ NOME: 'Anna', COGNOME: 'Rossi', PRIVACY: true, ETA: 25 })
  })

  it('non scrive mai gli attributi protetti', () => {
    const result = sanitizeAttributes({
      NOME: 'Anna',
      TIPO_UTENTE: 'Admin',
      magic_token: 'x',
      EMAIL: 'altro@miia.it',
      ISCRIZIONE: true,
      'DOUBLE_OPT-IN': true,
      BLACKLIST: false,
    })
    expect(result).toEqual({ NOME: 'Anna' })
  })

  it('non accetta dal browser gli attributi di provenienza', () => {
    const result = sanitizeAttributes({
      NOME: 'Anna',
      ORIGINE_SORGENTE: 'google',
      ultima_campagna: 'finta',
    })
    expect(result).toEqual({ NOME: 'Anna' })
  })

  it('scarta nomi non validi e valori vuoti o complessi', () => {
    const result = sanitizeAttributes({
      '1NOME': 'x',
      'NOME COMPLETO': 'x',
      VUOTO: '   ',
      OGGETTO: { a: 1 },
      NUMERO: Number.NaN,
      NOTE: 'ok',
    })
    expect(result).toEqual({ NOTE: 'ok' })
  })

  it('accorcia i testi troppo lunghi', () => {
    const result = sanitizeAttributes({ NOTE: 'a'.repeat(5000) })
    expect((result.NOTE as string).length).toBe(2000)
  })

  it('normalizza il telefono e scarta quelli non validi', () => {
    expect(sanitizeAttributes({ SMS: '333 1234567' })).toEqual({ SMS: '+393331234567' })
    expect(sanitizeAttributes({ SMS: '12' })).toEqual({})
  })

  it('unisce le scelte multiple a quelle già presenti in Brevo', () => {
    const result = sanitizeAttributes(
      { CORSI: ['Interior', 'Moda'] },
      { CORSI: ['Moda', 'Arredatore'] }
    )
    expect(result.CORSI).toEqual(['Moda', 'Arredatore', 'Interior'])
  })

  it('ignora input che non sono oggetti', () => {
    expect(sanitizeAttributes(null)).toEqual({})
    expect(sanitizeAttributes('NOME')).toEqual({})
    expect(sanitizeAttributes(['NOME'])).toEqual({})
  })
})

describe('sanitizeLists', () => {
  it('tiene solo le liste ammesse, senza doppioni', () => {
    expect(sanitizeLists([15, '16', 16, 42, 18, 999, 'x'])).toEqual([15, 16])
  })

  it('non permette mai le liste che danno accessi', () => {
    expect(sanitizeLists([42, 18])).toEqual([])
  })

  it('usa CRM_ALLOWED_LISTS se impostata', () => {
    vi.stubEnv('CRM_ALLOWED_LISTS', '7, 8,abc')
    expect(getAllowedLists()).toEqual([7, 8])
    expect(sanitizeLists([7, 15])).toEqual([7])
  })

  it('ignora input che non sono liste', () => {
    expect(sanitizeLists('15')).toEqual([])
    expect(sanitizeLists(undefined)).toEqual([])
  })
})

describe('eventi', () => {
  it('accetta solo nomi submit_*', () => {
    expect(sanitizeEventName('submit_openday_form')).toBe('submit_openday_form')
    expect(sanitizeEventName('delete_contact')).toBeNull()
    expect(sanitizeEventName('submit_FORM')).toBeNull()
    expect(sanitizeEventName(123)).toBeNull()
  })

  it('tiene solo proprietà semplici', () => {
    expect(
      sanitizeEventProperties({
        corso: ' Interior ',
        anno: 2026,
        primo: true,
        vuoto: '',
        oggetto: { a: 1 },
        'chiave non valida': 'x',
      })
    ).toEqual({ corso: 'Interior', anno: 2026, primo: true })
  })

  it('limita il numero di proprietà', () => {
    const many = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`p${i}`, i]))
    expect(Object.keys(sanitizeEventProperties(many))).toHaveLength(50)
  })
})

describe('isBotSubmission', () => {
  it('riconosce il campo nascosto compilato', () => {
    expect(isBotSubmission({ validation: 'spam' }, {})).toBe(true)
    expect(isBotSubmission({}, { VALIDATION: true })).toBe(true)
  })

  it('lascia passare gli invii normali', () => {
    expect(isBotSubmission({ validation: '' }, { VALIDATION: false })).toBe(false)
    expect(isBotSubmission(undefined, undefined)).toBe(false)
  })
})

describe('provenienza (ORIGINE / ULTIMA)', () => {
  const first = {
    source: 'google',
    medium: 'cpc',
    campaign: 'openday_ottobre',
    click_id: 'gclid:abc',
    landing: '/corsi/interior',
    date: '2026-10-01T09:30:00.000Z',
  }
  const last = {
    source: 'newsletter',
    medium: 'email',
    campaign: 'reminder',
    landing: '/openday',
    date: '2026-10-10T18:00:00.000Z',
  }

  it('si attiva solo con CRM_SOURCE_ATTRIBUTES=on', () => {
    expect(isSourceTrackingEnabled()).toBe(false)
    vi.stubEnv('CRM_SOURCE_ATTRIBUTES', 'on')
    expect(isSourceTrackingEnabled()).toBe(true)
  })

  it('primo invio: scrive sia ORIGINE sia ULTIMA', () => {
    expect(sanitizeAttribution({ first, last })).toEqual({
      ORIGINE_SORGENTE: 'google',
      ORIGINE_MEZZO: 'cpc',
      ORIGINE_CAMPAGNA: 'openday_ottobre',
      ORIGINE_CLICK_ID: 'gclid:abc',
      ORIGINE_PAGINA: '/corsi/interior',
      ORIGINE_DATA: '2026-10-01',
      ULTIMA_SORGENTE: 'newsletter',
      ULTIMA_MEZZO: 'email',
      ULTIMA_CAMPAGNA: 'reminder',
      ULTIMA_PAGINA: '/openday',
      ULTIMA_DATA: '2026-10-10',
    })
  })

  it('contatto già noto: ORIGINE non viene sovrascritta, ULTIMA sì', () => {
    const result = sanitizeAttribution({ first, last }, { ORIGINE_SORGENTE: 'facebook' })
    expect(Object.keys(result).some((k) => k.startsWith('ORIGINE_'))).toBe(false)
    expect(result.ULTIMA_SORGENTE).toBe('newsletter')
  })

  it('ORIGINE vuota in Brevo conta come non ancora scritta', () => {
    const result = sanitizeAttribution({ first }, { ORIGINE_SORGENTE: '' })
    expect(result.ORIGINE_SORGENTE).toBe('google')
    expect(result.ULTIMA_SORGENTE).toBe('google')
  })

  it('con un solo punto di contatto lo usa per entrambi', () => {
    const result = sanitizeAttribution({ last })
    expect(result.ORIGINE_CAMPAGNA).toBe('reminder')
    expect(result.ULTIMA_CAMPAGNA).toBe('reminder')
  })

  it('ignora campi sconosciuti, date non valide e testi troppo lunghi', () => {
    const result = sanitizeAttribution({
      first: { source: 'x'.repeat(300), date: 'non una data', password: 'segreta' },
    })
    expect(result.ORIGINE_SORGENTE).toHaveLength(150)
    expect(result).not.toHaveProperty('ORIGINE_DATA')
    expect(Object.values(result)).not.toContain('segreta')
  })

  it('ignora input non validi', () => {
    expect(sanitizeAttribution(null)).toEqual({})
    expect(sanitizeAttribution('google')).toEqual({})
    expect(sanitizeAttribution([first])).toEqual({})
  })
})
