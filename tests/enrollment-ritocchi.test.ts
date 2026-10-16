import { describe, expect, it } from 'vitest'
import { contractEmailHtml, contractEmailSubject, contractEmailText } from '@modules/enrollment/contract-email'
import { contractNumber, withdrawalSentence } from '@modules/enrollment/withdrawal'
import { canEnroll, enrollHref } from '@components/enrollment/enroll-link'

const EMAIL = {
  nome: 'Mirco',
  corso: 'Interior design, primo livello',
  numero: '2026-0A1B2C3D',
  edizione: 'Corso Interior Design - Treviso',
  sede: 'Treviso',
  giorniOrari: 'Sabato, 9:00/12:00',
  inizio: '17 ottobre 2026',
  pagamento: '5 rate da 1.140 €, totale 5.700 €',
  firmataIl: '15 ottobre 2026 alle 12:59',
  fineRecesso: '29 ottobre 2026',
}

describe('email con il contratto', () => {
  it('usa il layout servizio: fascia scura con il logo e footer legale', () => {
    const html = contractEmailHtml(EMAIL)
    expect(html).toContain('email-logo-scuro.png')
    expect(html).toContain('email-fascia-scura.png')
    expect(html).toContain('P. IVA 04182310260')
    expect(html).not.toContain('border-radius:16px')
  })

  it('contiene numero e riepilogo, così due email non sono mai uguali', () => {
    const html = contractEmailHtml(EMAIL)
    expect(html).toContain('2026-0A1B2C3D')
    expect(html).toContain('5 rate da 1.140 €')
    expect(contractEmailSubject(EMAIL)).toBe('Iscrizione firmata: Interior design, primo livello (contratto n. 2026-0A1B2C3D)')
  })

  it('dice come annullare, con la frase da copiare', () => {
    const sentence = 'Annullo la mia iscrizione al corso Interior design, primo livello di Treviso.'
    expect(contractEmailHtml(EMAIL)).toContain(sentence)
    expect(contractEmailText(EMAIL)).toContain(sentence)
    expect(contractEmailText(EMAIL)).toContain('29 ottobre 2026')
  })

  it('protegge i dati inseriti dalla persona', () => {
    expect(contractEmailHtml({ ...EMAIL, nome: '<b>x</b>' })).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})

describe('recesso e numero del contratto', () => {
  it('frase con e senza sede', () => {
    expect(withdrawalSentence('Moda', '')).toBe('Annullo la mia iscrizione al corso Moda.')
  })

  it('numero leggibile dall’id', () => {
    expect(contractNumber('0a1b2c3d-0000-4000-8000-000000000001', new Date('2026-10-15T10:00:00Z'))).toBe('2026-0A1B2C3D')
  })
})

describe('pulsante "Iscriviti online"', () => {
  const SLUG = 'corsi/interior-design/corso-interior-design-primo-livello/edizioni/treviso-sabato'
  it('porta alla pagina del corso con l’edizione già scelta', () => {
    expect(enrollHref(SLUG, 'abc:2026-11-07')).toBe('/iscrizione/corso-interior-design-primo-livello?edizione=abc%3A2026-11-07')
    expect(enrollHref('pagine/chi-siamo', 'abc:2026-11-07')).toBeNull()
  })

  it('si vede solo con l’iscrizione online accesa e posti liberi', () => {
    expect(canEnroll(null, '12')).toBe(false)
    expect(canEnroll({}, 'completo')).toBe(false)
    expect(canEnroll({ k: 3 }, '9')).toBe(true)
  })
})

import { frequency, signedContactAttributes } from '@modules/enrollment/brevo-sync'

describe('dati in Brevo alla firma', () => {
  const row = {
    email: 'a@b.it',
    dati: { data_nascita: '1990-05-12', via: 'Via Roma 1', cap: '31100', comune: 'Treviso', provincia: 'TV', codice_fiscale: 'RSSMRA90E12L407X' },
    profilo: { scopo: 'professione', titolo_studi: 'laurea_magistrale', area_studi: 'artistica', situazione_lavoro: 'impiegato', azienda: 'Studio', ruolo: '' },
    consensi: { voci: { newsletter: { valore: true } } },
  } as any
  const attrs = signedContactAttributes(row, { sede: 'Treviso', giorni: ['Sabato'], orari: ['9:00/12:00'] }, 'Interior design, primo livello', new Date('2026-10-15T10:00:00Z'))

  it('usa i valori delle liste di Brevo', () => {
    expect(attrs).toMatchObject({
      COMPLEANNO: '1990-05-12',
      COMUNE: 'Treviso',
      PROVINCIA: 'TV',
      STUDI: ['laure'],
      FORMAZIONE: ['artistica'],
      OCCUPAZIONE: ['Impiegato'],
      SEDE: ['treviso'],
      FREQUENZA: ['sabato'],
      ISCRIZIONE: '2026-10-15',
      ISCRIZIONE_CORSO: 'Interior design, primo livello',
      ISCRIZIONE_SCOPO: 'Farne una professione',
      NEWSLETTER: true,
    })
  })

  it('non manda codice fiscale né campi vuoti', () => {
    expect(JSON.stringify(attrs)).not.toContain('RSSMRA')
    expect(attrs).not.toHaveProperty('RUOLO')
  })

  it('frequenza serale e diurna', () => {
    expect(frequency(['Lunedì', 'Mercoledì'], ['20:00/23:00'])).toBe('serale')
    expect(frequency(['Lunedì'], ['9:00/13:00'])).toBe('diurno')
  })
})
