import { describe, expect, it, vi } from 'vitest'
import { codiceFiscaleError, birthFromCodiceFiscale } from '@modules/enrollment/codice-fiscale'
import { addDays, romeDate, withdrawalEnd } from '@modules/enrollment/dates'
import { editionAvailability, editionKey, parseCapacity } from '@modules/enrollment/editions'
import { isOfferValid, isPriceListValid, quote } from '@modules/enrollment/pricing'
import { isEnrollmentEnabled } from '@modules/enrollment/config'
import {
  canSaveSection,
  completeAfterSave,
  nextSection,
  validateChiSei,
  validateConsensi,
  validateCorso,
  validateDati,
  validateProfilo,
} from '@modules/enrollment/validation'
import type { PriceList } from '@modules/enrollment/types'

// Prezzi del modulo revisionato 2026 (interior design primo livello)
const LISTINO: PriceList = { unica: 5490, rata5: 1140, rata10: 594, offerta: 4990, esame: 366 }

describe('prezzi', () => {
  it('senza offerta: prezzi pieni del modulo', () => {
    expect(quote(LISTINO, 'unica', false)).toMatchObject({ rate: 1, rata: 5490, totale: 5490 })
    expect(quote(LISTINO, '5_rate', false)).toMatchObject({ rate: 5, rata: 1140, totale: 5700 })
    expect(quote(LISTINO, '10_rate', false)).toMatchObject({ rate: 10, rata: 594, totale: 5940 })
  })

  it('con offerta open day: stesso totale in tutte le modalità, come nel prototipo', () => {
    expect(quote(LISTINO, 'unica', true)).toMatchObject({ rata: 4990, totale: 4990, totale_pieno: 5490 })
    expect(quote(LISTINO, '5_rate', true)).toMatchObject({ rata: 998, totale: 4990, totale_pieno: 5700 })
    expect(quote(LISTINO, '10_rate', true)).toMatchObject({ rata: 499, totale: 4990, totale_pieno: 5940 })
  })

  it('i centesimi che avanzano vanno sulla prima rata', () => {
    const q = quote({ ...LISTINO, offerta: 4999.99 }, '10_rate', true)
    expect(q.rata).toBe(499.99)
    expect(q.prima_rata).toBe(500.08)
    expect(Math.round((q.prima_rata + q.rata * 9) * 100)).toBe(499999)
  })

  it('controlla il listino letto da Storyblok', () => {
    expect(isPriceListValid(LISTINO)).toBe(true)
    expect(isPriceListValid({ ...LISTINO, offerta: undefined })).toBe(false)
    expect(isPriceListValid({ ...LISTINO, unica: 0 })).toBe(false)
    expect(isPriceListValid(null)).toBe(false)
  })
})

describe('offerta open day', () => {
  const now = new Date('2026-11-30T23:30:00Z') // in Italia è già il 1° dicembre (UTC+1)

  it("vale fino al giorno di scadenza compreso, contando l'ora italiana", () => {
    expect(isOfferValid('2026-12-01', now)).toBe(true)
    expect(isOfferValid('2026-11-30', now)).toBe(false)
  })

  it('accetta date con ora e rifiuta valori vuoti o sbagliati', () => {
    expect(isOfferValid('2026-12-05T00:00:00Z', now)).toBe(true)
    expect(isOfferValid('', now)).toBe(false)
    expect(isOfferValid(null, now)).toBe(false)
    expect(isOfferValid('30/11/2026', now)).toBe(false)
  })
})

describe('date', () => {
  it('fine del recesso: 14 giorni dalla firma, calendario italiano', () => {
    expect(withdrawalEnd(new Date('2026-10-13T09:00:00Z'))).toBe('2026-10-27')
    // Firma alle 00:30 in Italia del 14 ottobre (ancora 13 in UTC)
    expect(withdrawalEnd(new Date('2026-10-13T22:30:00Z'))).toBe('2026-10-28')
  })

  it("attraversa il cambio dell'ora legale senza perdere giorni", () => {
    expect(addDays('2026-10-20', 14)).toBe('2026-11-03')
    expect(romeDate(new Date('2026-03-29T01:30:00Z'))).toBe('2026-03-29')
  })
})

describe('codice fiscale', () => {
  it('accetta un codice corretto e coerente con la data di nascita', () => {
    expect(codiceFiscaleError('RSSMRA85T10A562S', '1985-12-10')).toBeNull()
    expect(codiceFiscaleError(' rssmra85t10a562s ')).toBeNull()
  })

  it('riconosce donne (giorno + 40) e codici omocodici', () => {
    expect(birthFromCodiceFiscale('BNCGLI95A41L407A')).toEqual({ yy: 95, month: 1, day: 1, sex: 'F' })
    expect(codiceFiscaleError('BNCGLI95A41L407A', '1995-01-01')).toBeNull()
    expect(codiceFiscaleError('RSSMRA85T10A56NH', '1985-12-10')).toBeNull()
  })

  it('segnala formato, carattere di controllo e data diversa', () => {
    expect(codiceFiscaleError('')).toBe('Il codice fiscale è obbligatorio')
    expect(codiceFiscaleError('RSSMRA85T10A562')).toMatch(/formato/)
    expect(codiceFiscaleError('RSSMRA85T10A562X')).toMatch(/non è corretto/)
    expect(codiceFiscaleError('RSSMRA85T10A562S', '1985-12-11')).toMatch(/data di nascita/)
  })
})

describe('edizioni e posti', () => {
  it('la chiave unisce storia e data di inizio', () => {
    expect(editionKey('abc', '2027-03-02 00:00')).toBe('abc:2027-03-02')
    expect(editionKey('abc', '')).toBeNull()
    expect(editionKey('', '2027-03-02')).toBeNull()
  })

  it('posti liberi = capienza meno firmate', () => {
    expect(editionAvailability(12, 4)).toEqual({ stato: 'disponibile', posti_liberi: 8 })
    expect(editionAvailability(12, 10)).toEqual({ stato: 'ultimi_posti', posti_liberi: 2 })
    expect(editionAvailability(12, 12)).toEqual({ stato: 'completa', posti_liberi: 0 })
    expect(editionAvailability(12, 15)).toEqual({ stato: 'completa', posti_liberi: 0 })
    expect(editionAvailability(null, 3)).toEqual({ stato: 'disponibile', posti_liberi: null })
  })

  it('legge la capienza anche dal campo testo attuale', () => {
    expect(parseCapacity('8')).toBe(8)
    expect(parseCapacity(' 10 ')).toBe(10)
    expect(parseCapacity('ultimi posti')).toBeNull()
    expect(parseCapacity(6)).toBe(6)
  })
})

describe('sezione 1, chi sei', () => {
  it('pulisce email e telefono', () => {
    const r = validateChiSei({ email: ' Giulia@Example.com ', nome: 'Giulia', cognome: 'Bianchi', telefono: '333 123 4567' })
    expect(r).toEqual({
      ok: true,
      value: { email: 'giulia@example.com', nome: 'Giulia', cognome: 'Bianchi', telefono: '+393331234567' },
    })
  })

  it('segnala i campi mancanti', () => {
    const r = validateChiSei({ email: 'x', nome: 'G', cognome: 'B1', telefono: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['cognome', 'email', 'nome', 'telefono'])
  })
})

describe('sezione 2, corso e pagamento', () => {
  it("accetta solo edizioni disponibili e modalità previste", () => {
    expect(validateCorso({ edizione: 'a:2027-03-02', scopo: 'professione', modalita: '10_rate' }, ['a:2027-03-02']).ok).toBe(true)
    const r = validateCorso({ edizione: 'b:2027-03-06', scopo: 'altro', modalita: '3_rate' }, ['a:2027-03-02'])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['edizione', 'modalita', 'scopo'])
  })
})

describe('sezione 3, dati e documenti', () => {
  const now = new Date('2026-10-13T10:00:00Z')
  const base = {
    data_nascita: '1985-12-10',
    luogo_nascita: 'Bagno a Ripoli',
    codice_fiscale: 'rssmra85t10a562s',
    via: 'Via Roma 1',
    comune: 'Treviso',
    provincia: 'tv',
    cap: '31100',
    documento_tipo: 'carta_identita',
    documento_numero: 'ca 12345 ab',
  }

  it('dati completi con documenti caricati', () => {
    const r = validateDati(base, { documentiCaricati: true, now })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toMatchObject({ codice_fiscale: 'RSSMRA85T10A562S', provincia: 'TV', documento_numero: 'CA12345AB', documenti: 'caricati', azienda: null })
  })

  it('"li carico dopo" completa la sezione senza foto', () => {
    expect(validateDati(base, { documentiCaricati: false, now }).ok).toBe(false)
    const r = validateDati({ ...base, documenti_dopo: true }, { documentiCaricati: false, now })
    expect(r.ok && r.value.documenti).toBe('dopo')
  })

  it('non taglia i valori troppo lunghi: li segnala', () => {
    const r = validateDati({ ...base, provincia: 'Treviso', cap: '311000' }, { documentiCaricati: true, now })
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['cap', 'provincia'])
  })

  it('solo maggiorenni', () => {
    const r = validateDati({ ...base, data_nascita: '2008-10-14' }, { documentiCaricati: true, now })
    expect(!r.ok && r.errors.data_nascita).toMatch(/maggiorenni/)
  })

  it('fatturazione azienda: partita IVA e PEC o SDI', () => {
    const r = validateDati(
      { ...base, fatturazione_azienda: true, azienda: { ragione_sociale: 'Studio Srl', via: 'Via Po 2', cap: '31100', partita_iva: '123' } },
      { documentiCaricati: true, now }
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(['azienda.partita_iva', 'azienda.pec'])
  })
})

describe('sezioni 4 e 5', () => {
  it('profilo tutto facoltativo, scarta valori non previsti', () => {
    const r = validateProfilo({ come_ci_hai_conosciuto: ['instagram', 'tiktok'], saltato: false })
    expect(r.ok && r.value.come_ci_hai_conosciuto).toEqual(['instagram'])
    expect(validateProfilo({ anno_studi: '14' }).ok).toBe(false)
  })

  it('consensi obbligatori e foto senza risposta preimpostata', () => {
    const now = new Date('2026-10-13T10:00:00Z')
    const r = validateConsensi({ contratto: true, clausole: true, recesso: true, privacy: true, foto: 'no' }, '2026-11', now)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.versione).toBe('2026-11')
      expect(r.value.foto).toEqual({ valore: 'no', ora: '2026-10-13T10:00:00.000Z' })
      expect(r.value.newsletter.valore).toBe(false)
    }
    const missing = validateConsensi({ contratto: true, clausole: 'true' }, '2026-11', now)
    expect(!missing.ok && Object.keys(missing.errors).sort()).toEqual(['clausole', 'foto', 'privacy', 'recesso'])
  })
})

describe('avanzamento tra le sezioni', () => {
  it('si apre la prima sezione non completata', () => {
    expect(nextSection([])).toBe('chi_sei')
    expect(nextSection(['chi_sei', 'corso'])).toBe('dati')
    expect(nextSection(['chi_sei', 'corso', 'dati', 'profilo', 'consensi', 'firma'])).toBeNull()
  })

  it('non si salta avanti', () => {
    expect(canSaveSection('corso', ['chi_sei'])).toBe(true)
    expect(canSaveSection('dati', ['chi_sei'])).toBe(false)
  })

  it('modificare ciò che si firma annulla la firma, il profilo no', () => {
    const all = ['chi_sei', 'corso', 'dati', 'profilo', 'consensi', 'firma'] as const
    expect(completeAfterSave('corso', [...all])).not.toContain('firma')
    expect(completeAfterSave('profilo', [...all])).toContain('firma')
  })
})

describe('interruttore', () => {
  it('spento se ENROLLMENT_ONLINE non è "on"', () => {
    expect(isEnrollmentEnabled()).toBe(false)
    vi.stubEnv('ENROLLMENT_ONLINE', 'on')
    expect(isEnrollmentEnabled()).toBe(true)
  })
})
