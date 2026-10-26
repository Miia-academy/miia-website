import { describe, expect, it } from 'vitest'
import { editionTags, filterFromPageSlug, fillPriceText, filterEditions, matchesFilter, priceSegments, publicPrices } from '@modules/aside'

// Listino in Storyblok il 26/10
const PRICES = { unica: 5490, rata5: 1140, rata10: 594, esame: 366 }

describe('titolo prezzo con variabili', () => {
  it('riempie le variabili con il listino, in formato italiano', () => {
    expect(fillPriceText('A partire da **{rata10}€** per 10 mesi _*iva inclusa_', PRICES)).toBe(
      'A partire da **594€** per 10 mesi _*iva inclusa_'
    )
    expect(fillPriceText('Soluzione unica **{unica}€**', PRICES)).toBe('Soluzione unica **5.490€**')
  })

  it('niente titolo se manca il listino o la variabile non esiste: resta il prezzo di prima', () => {
    expect(fillPriceText('**{rata10}€**', null)).toBeNull()
    expect(fillPriceText('**{rata12}€**', PRICES)).toBeNull()
    expect(fillPriceText('   ', PRICES)).toBeNull()
  })

  it('il prezzo open day non arriva nelle pagine', () => {
    const prices = publicPrices({ ...PRICES, offerta: 4990 })
    expect(prices).toEqual(PRICES)
    expect(fillPriceText('**{offerta}€**', prices)).toBeNull()
  })

  it('divide il testo in cifra grande, nota e testo', () => {
    expect(priceSegments('A partire da **594€** per 10 mesi _*iva inclusa_')).toEqual([
      { kind: 'text', value: 'A partire da ' },
      { kind: 'figure', value: '594€' },
      { kind: 'text', value: ' per 10 mesi ' },
      { kind: 'note', value: '*iva inclusa' },
    ])
  })
})

const BASSANO = 'corsi/interior-design/corso-interior-design-primo-livello/corsi-interni-primo-livello/bassano-sabato'
const PADOVA = 'corsi/interior-design/corso-interior-design-primo-livello/corsi-interni-primo-livello/padova-serale'
const TREVISO_2 =
  'corsi/interior-design/corso-interior-design-secondo-livello/corsi-interni-secondo-livello/corso-interni-treviso-serale-secondo-livello'
const MODA = 'corsi/fashion-design/corso-fashion-design-primo-livello/edizioni/treviso-sabato'

describe('filtro edizioni', () => {
  it('ricava area, livello, città e frequenza dalla cartella', () => {
    expect([...editionTags(BASSANO)]).toEqual(
      expect.arrayContaining(['interni', 'interior', 'primo', 'primo-livello', 'bassano', 'sabato'])
    )
    expect(editionTags('moduli/brochure').size).toBe(0)
  })

  it('tutte le parole devono corrispondere', () => {
    expect(matchesFilter(BASSANO, 'interni,primo_livello,bassano')).toBe(true)
    expect(matchesFilter(BASSANO, 'interni, primo, Padova')).toBe(false)
    expect(matchesFilter(TREVISO_2, 'interni,secondo')).toBe(true)
    expect(matchesFilter(TREVISO_2, 'interni,primo')).toBe(false)
    expect(matchesFilter(MODA, 'moda,primo')).toBe(true)
    expect(matchesFilter(BASSANO, '')).toBe(false)
  })

  it('edizioni filtrate, la prima che parte per prima', () => {
    const editions = [
      { fullSlug: PADOVA, starts: '2027-02-01' },
      { fullSlug: MODA, starts: '2026-11-01' },
      { fullSlug: BASSANO, starts: undefined },
      { fullSlug: BASSANO.replace('sabato', 'serale'), starts: '2026-11-10' },
    ]
    expect(filterEditions(editions, 'interni,primo').map((e) => e.fullSlug.split('/').pop())).toEqual([
      'bassano-serale',
      'padova-serale',
      'bassano-sabato',
    ])
  })
})

describe('filtro per le pagine di oggi', () => {
  it('dalla pagina corso alla stessa scelta di edizioni', () => {
    expect(filterFromPageSlug('corsi/interior-design/corso-interior-design-primo-livello-padova')).toBe('interni,primo,padova')
    expect(filterFromPageSlug('corsi/interior-design/corso-interior-design-secondo-livello/')).toBe('interni,secondo')
    expect(filterFromPageSlug('corsi/fashion-design/corso-fashion-design-primo-livello/')).toBe('moda,primo')
    expect(filterFromPageSlug('corsi/interior-design/')).toBeNull()
  })
})
