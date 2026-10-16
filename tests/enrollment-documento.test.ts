import { describe, expect, it } from 'vitest'
import { documentFormat, documentNumberError, normalizeDocumentNumber, partialPattern } from '@modules/enrollment/document-number'
import { validateDati } from '@modules/enrollment/validation'
import { documentLabel } from '@modules/enrollment/labels'

const partial = (tipo: string) => new RegExp(partialPattern(documentFormat(tipo, false)!))

describe('numero del documento', () => {
  it('carta elettronica italiana: 2 lettere, 5 cifre, 2 lettere', () => {
    expect(documentNumberError('carta_identita_elettronica', 'CA12345AB', false)).toBeNull()
    expect(documentNumberError('carta_identita_elettronica', 'AA1234567', false)).toMatch(/2 lettere, 5 cifre, 2 lettere/)
    expect(documentNumberError('carta_identita_elettronica', 'CA12345A', false)).not.toBeNull()
  })

  it('carta cartacea e passaporto italiani: 2 lettere e 7 cifre', () => {
    expect(documentNumberError('carta_identita', 'AA1234567', false)).toBeNull()
    expect(documentNumberError('passaporto', 'YA1234567', false)).toBeNull()
    expect(documentNumberError('passaporto', 'CA12345AB', false)).toMatch(/per esempio YA1234567/)
  })

  it('documenti esteri: solo lettere e cifre, da 5 a 12', () => {
    expect(documentNumberError('passaporto', 'X1234567Z', true)).toBeNull()
    expect(documentNumberError('carta_identita_elettronica', '12AB34', true)).toBeNull()
    expect(documentNumberError('passaporto', 'X12', true)).not.toBeNull()
    // La carta cartacea è solo italiana: il formato resta quello italiano.
    expect(documentNumberError('carta_identita', 'X1234567Z', true)).not.toBeNull()
  })

  it('le caselle accettano solo il carattere giusto al posto giusto', () => {
    const cie = partial('carta_identita_elettronica')
    expect(['', 'c', 'CA', 'CA123', 'CA12345', 'CA12345A', 'CA12345AB'].every((v) => cie.test(v))).toBe(true)
    expect(['1', 'C1A', 'CA12A', 'CA123456', 'CA12345AB1'].some((v) => cie.test(v))).toBe(false)
    const paper = partial('carta_identita')
    expect(paper.test('AA1234567')).toBe(true)
    expect(paper.test('AA12345A')).toBe(false)
  })

  it('toglie spazi, punti e trattini e scrive in maiuscolo', () => {
    expect(normalizeDocumentNumber('ca 12345-ab')).toBe('CA12345AB')
  })
})

describe('documento nel passo 3', () => {
  const base = {
    data_nascita: '1985-12-10',
    luogo_nascita: 'Treviso',
    codice_fiscale: 'RSSMRA85T10A562S',
    via: 'Via Roma 1',
    comune: 'Treviso',
    provincia: 'TV',
    cap: '31100',
  }
  const now = new Date('2026-10-15T08:00:00Z')

  it('la patente non è più accettata', () => {
    const r = validateDati({ ...base, documento_tipo: 'patente', documento_numero: 'U1234567A' }, { documentiCaricati: true, now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.documento_tipo).toBeDefined()
  })

  it('un passaporto estero chiede il paese', () => {
    const input = { ...base, documento_tipo: 'passaporto', documento_numero: 'X1234567Z', documento_estero: true }
    const r = validateDati(input, { documentiCaricati: true, now })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(['documento_paese'])
    const ok = validateDati({ ...input, documento_paese: 'Francia' }, { documentiCaricati: true, now })
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.value).toMatchObject({ documento_estero: true, documento_paese: 'Francia' })
      expect(documentLabel(ok.value as unknown as Record<string, unknown>)).toBe('Passaporto n. X1234567Z (Francia)')
    }
  })

  it('"estero" non vale per la carta cartacea', () => {
    const r = validateDati(
      { ...base, documento_tipo: 'carta_identita', documento_numero: 'AA1234567', documento_estero: true, documento_paese: 'Francia' },
      { documentiCaricati: true, now }
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ documento_estero: false, documento_paese: '' })
  })
})
