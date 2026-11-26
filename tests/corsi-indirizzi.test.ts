import { describe, expect, it } from 'vitest'
// @ts-expect-error: copia interna di Next, senza tipi
import { compile, match } from 'next/dist/compiled/path-to-regexp'
import { CORSI, redirectCorsi } from '@config/corsi'
import { courseByAreaLevel, courseCode, courseFromEditionSlug, coursePath, courseTitle } from '@modules/enrollment/courses'
import { editionTags, filterFromPageSlug, matchesFilter } from '@modules/aside'
import { courseFromPageSlug } from '@modules/forms-brevo'
import { courseForOpenday } from '@modules/openday-details'

const ARREDO = 'corso-interior-design-primo-livello'

/** Dove porta un vecchio indirizzo, con le regole di next.config.ts. */
function redirectOf(path: string): string | null {
  for (const r of redirectCorsi()) {
    const m = match(r.source, { decode: decodeURIComponent })(path)
    if (m) return compile(r.destination)(m.params)
  }
  return null
}

describe('indirizzi nuovi dei corsi', () => {
  it('il codice interno resta lo stesso, cambia solo l’indirizzo', () => {
    expect(coursePath(ARREDO)).toBe('interior-design-arredo')
    expect(coursePath('corso-interior-design-secondo-livello')).toBe('interior-design-cantiere')
    expect(coursePath('corso-fashion-design-primo-livello')).toBe('fashion-design-modellista')
    expect(courseCode('interior-design-arredo')).toBe(ARREDO)
    expect(courseCode(ARREDO)).toBe(ARREDO)
    // Corso non in tabella: tutto come prima
    expect(coursePath('corso-fashion-design-secondo-livello')).toBe('corso-fashion-design-secondo-livello')
    // Contratti, email e riepilogo: stesso titolo di oggi
    expect(courseTitle('interior-design-arredo')).toBe('Interior design, primo livello')
  })

  it('edizioni: il corso si trova nella cartella nuova e in quella vecchia', () => {
    expect(courseFromEditionSlug('corsi/interior-design-arredo/corsi-interni-primo-livello/72-corso-interni-treviso-sabato')).toBe(ARREDO)
    expect(courseFromEditionSlug('corsi/interior-design/corso-interior-design-primo-livello/corsi-interni-primo-livello/treviso-sabato')).toBe(ARREDO)
    expect(courseFromEditionSlug('corsi/interior-design/storie/una-storia')).toBeNull()
    expect(courseFromEditionSlug('corsi/interior-design-arredo')).toBeNull()
  })

  it('filtro delle edizioni nella barra laterale', () => {
    const slug = 'corsi/interior-design-arredo/corsi-interni-primo-livello/74-corso-interni-bassano-serale'
    expect(editionTags(slug)).toEqual(new Set(['interior-design', 'interni', 'interior', 'primo', 'primo-livello', '74', 'corso', 'bassano', 'serale']))
    expect(matchesFilter(slug, 'interni,primo,bassano')).toBe(true)
    expect(matchesFilter(slug, 'interni,secondo')).toBe(false)
    expect(matchesFilter('corsi/interior-design-cantiere/corsi-interni-secondo-livello/treviso-serale', 'interni,secondo')).toBe(true)
  })

  it('pagine corso e pagine sede', () => {
    expect(filterFromPageSlug('corsi/interior-design-arredo/')).toBe('interni,primo')
    expect(filterFromPageSlug('corsi/interior-design-arredo/padova')).toBe('interni,primo,padova')
    expect(filterFromPageSlug('corsi/fashion-design-modellista')).toBe('moda,primo')
    expect(courseFromPageSlug('corsi/interior-design-arredo/treviso')).toBe(ARREDO)
    expect(courseFromPageSlug('corsi/interior-design-cantiere/')).toBe('corso-interior-design-secondo-livello')
  })

  it('open day e link di conferma trovano il corso', () => {
    expect(courseForOpenday('interni - primo livello')).toBe(ARREDO)
    expect(courseByAreaLevel('interni', 'primo')?.indirizzo).toBe('interior-design-arredo')
    expect(courseByAreaLevel('interior', 'secondo')?.indirizzo).toBe('interior-design-cantiere')
    expect(courseByAreaLevel('moda', 'primo')?.indirizzo).toBe('fashion-design-modellista')
    expect(courseByAreaLevel('moda', 'secondo')).toBeNull()
  })

  it('i vecchi indirizzi portano ai nuovi', () => {
    expect(redirectOf('/corsi/interior-design/corso-interior-design-primo-livello')).toBe('/corsi/interior-design-arredo')
    expect(redirectOf('/corsi/interior-design/corso-interior-design-primo-livello-treviso')).toBe('/corsi/interior-design-arredo/treviso')
    expect(redirectOf('/corsi/interior-design/corso-interior-design-primo-livello/corsi-interni-primo-livello/75-corso-interni-treviso-serale')).toBe(
      '/corsi/interior-design-arredo/corsi-interni-primo-livello/75-corso-interni-treviso-serale'
    )
    expect(redirectOf('/corsi/interior-design/corso-interior-design-secondo-livello')).toBe('/corsi/interior-design-cantiere')
    expect(redirectOf('/corsi/fashion-design/corso-fashion-design-primo-livello')).toBe('/corsi/fashion-design-modellista')
    expect(redirectOf('/iscrizione/corso-interior-design-primo-livello')).toBe('/iscrizione/interior-design-arredo')
    // Pagine che non c'entrano restano dove sono
    expect(redirectOf('/corsi/interior-design')).toBeNull()
    expect(redirectOf('/corsi/fashion-design/corso-fashion-design-secondo-livello')).toBeNull()
    expect(redirectOf('/iscrizione/interior-design-arredo')).toBeNull()
  })

  it('ogni corso ha codice e indirizzo diversi da tutti gli altri', () => {
    const all = CORSI.flatMap((c) => [c.codice, c.indirizzo])
    expect(new Set(all).size).toBe(all.length)
  })
})
