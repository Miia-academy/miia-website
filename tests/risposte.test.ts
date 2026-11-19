import { describe, expect, it } from 'vitest'
import { ctaFor, paragraphs, parseCorso, parseFase } from '@modules/risposte'

// Pagina /risposta: la fase sceglie solo il pulsante finale
describe('pagina risposte: pulsante per fase', () => {
  const interni = 'corso-interior-design-primo-livello'

  it('accetta solo le tre fasi e corsi nel formato del sito', () => {
    expect(parseFase('post-openday')).toBe('post-openday')
    expect(parseFase('dopo')).toBeNull()
    expect(parseCorso(interni)).toBe(interni)
    expect(parseCorso('interni-primo')).toBeNull()
    expect(parseCorso('corso-x/../y')).toBeNull()
  })

  it('brochure: vieni all’open day, se c’è la pagina dell’area', () => {
    expect(ctaFor('brochure', interni)).toEqual({ label: 'Vieni al prossimo open day', href: '/open-day/interior-design' })
    expect(ctaFor('brochure', 'corso-fashion-design-primo-livello')).toBeNull()
    expect(ctaFor('brochure', null)).toBeNull()
  })

  it('dopo l’open day: iscriviti online al corso del link', () => {
    expect(ctaFor('post-openday', interni)).toEqual({ label: 'Iscriviti online', href: `/iscrizione/${interni}` })
    expect(ctaFor('post-openday', null)).toBeNull()
  })

  it('prima dell’open day o senza fase: nessun pulsante, restano i contatti', () => {
    expect(ctaFor('pre-openday', interni)).toBeNull()
    expect(ctaFor(null, interni)).toBeNull()
  })

  it('un a capo nel testo di Storyblok separa i paragrafi', () => {
    expect(paragraphs('Primo.\n\n Secondo. \nTerzo.')).toEqual(['Primo.', 'Secondo.', 'Terzo.'])
  })
})
