import { describe, expect, it, vi } from 'vitest'
import { categoryId, interestCourse } from '@modules/brevo-attributes'
import { isFormWritableAttribute, sanitizeAttributes } from '@modules/crm-form'

vi.mock('@modules/brevo', async (original) => ({ ...(await original<object>()), getContact: vi.fn() }))
import { getContact } from '@modules/brevo'
import { offerDeadline } from '@modules/enrollment/contact'

// Nomi del dizionario attributi Brevo (Automazioni, 26/10)

describe('attributi a categoria', () => {
  it('INTERESSE_CORSO dal codice, dalle etichette di prima o da area e livello', () => {
    expect(interestCourse('interior_primo')).toBe('interior_primo')
    expect(interestCourse('interni - primo livello')).toBe('interior_primo')
    expect(interestCourse(['moda'], 'secondo')).toBe('fashion_secondo')
    expect(interestCourse('interior')).toBeNull()
    expect(categoryId('INTERESSE_CORSO', 'fashion_primo')).toBe(3)
    expect(categoryId('INTERESSE_CORSO', ['interior_secondo'])).toBe(2)
    expect(categoryId('ISCRIZIONE_PAGAMENTO_MODALITA', '10_rate')).toBe(3)
    expect(categoryId('ISCRIZIONE_SCOPO', 'altro')).toBeNull()
  })

  it('il modulo manda il codice del corso, Brevo riceve il numero', () => {
    expect(sanitizeAttributes({ INTERESSE_CORSO: ['interior_primo'], INTERESSE_AREA: ['interior'] })).toEqual({
      INTERESSE_CORSO: 1,
      INTERESSE_AREA: ['interior'],
    })
    // Un valore sconosciuto non parte: Brevo rifiuterebbe tutto il contatto
    expect(sanitizeAttributes({ INTERESSE_CORSO: 'boh', NOME: 'Anna' })).toEqual({ NOME: 'Anna' })
  })
})

describe('attributi che un modulo pubblico non può scrivere', () => {
  it('fatti di iscrizione, offerta, presenza e automazioni', () => {
    for (const name of [
      'ISCRIZIONE_STATO',
      'ISCRIZIONE_DATA',
      'OFFERTA_SCADENZA_DATA',
      'OPENDAY_PRESENTE',
      'OPENDAY_VALIDO',
      'OPENDAY_DOMANDA',
      'COLLOQUIO_ESITO',
      'AUTOMAZIONE_IN_SEQUENZA',
      'ORIGINE_DICHIARATA',
    ]) {
      expect(isFormWritableAttribute(name), name).toBe(false)
    }
  })

  it('i dati di interesse e la data dell’open day restano scrivibili', () => {
    for (const name of ['INTERESSE_SCOPO', 'INTERESSE_INIZIO', 'INTERESSE_SEDE', 'OPENDAY_DATA', 'OPENDAY_CODICE', 'NEWSLETTER']) {
      expect(isFormWritableAttribute(name), name).toBe(true)
    }
  })
})

describe('scadenza dell’offerta open day', () => {
  it('legge OFFERTA_SCADENZA_DATA e, per i contatti di prima, SCADENZA_OFFERTA', async () => {
    vi.mocked(getContact).mockResolvedValueOnce({ attributes: { OFFERTA_SCADENZA_DATA: '2026-11-30' } } as never)
    expect(await offerDeadline('a@b.it')).toBe('2026-11-30')
    vi.mocked(getContact).mockResolvedValueOnce({ attributes: { SCADENZA_OFFERTA: '2026-11-29' } } as never)
    expect(await offerDeadline('a@b.it')).toBe('2026-11-29')
    vi.mocked(getContact).mockResolvedValueOnce({ attributes: {} } as never)
    expect(await offerDeadline('a@b.it')).toBeNull()
  })
})
