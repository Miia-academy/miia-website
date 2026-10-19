import { describe, expect, it } from 'vitest'
import { findOpendayByDate, getDocentiNames, getDocentiStories, joinNames } from '@modules/events'

const docente = (title: string) => ({ uuid: title, content: { title, component: 'person', _uid: title } })

describe('getDocentiNames', () => {
  it('legge i titoli delle schede risolte', () => {
    expect(getDocentiNames({ docenti: [docente('Alice Campagnaro'), docente(' Elena De Benetti ')] as any })).toEqual([
      'Alice Campagnaro',
      'Elena De Benetti',
    ])
  })

  it('ignora UUID non risolti e campi vuoti', () => {
    expect(getDocentiNames({ docenti: ['uuid-non-risolto', docente('')] as any })).toEqual([])
    expect(getDocentiNames({})).toEqual([])
    expect(getDocentiNames(undefined)).toEqual([])
  })
})

describe('getDocentiStories', () => {
  it("restituisce le schede risolte nell'ordine di Storyblok", () => {
    const a = docente('Serena Turri')
    const b = docente('Valentina Pavan')
    expect(getDocentiStories({ docenti: [a, 'uuid-non-risolto', b] as any })).toEqual([a, b])
  })

  it("ricostruisce dall'elenco delle persone le schede non risolte", () => {
    const persons = [{ uuid: 'u-1', title: 'Giuliano Panizzo', role: 'cad', image: { filename: 'g.jpg' } }]
    const [scheda] = getDocentiStories({ docenti: ['u-1', 'u-sconosciuto'] as any }, persons)
    expect(scheda.uuid).toBe('u-1')
    expect(scheda.content).toMatchObject({ component: 'person', title: 'Giuliano Panizzo', role: 'cad' })
    expect(getDocentiStories({ docenti: ['u-1', 'u-sconosciuto'] as any }, persons)).toHaveLength(1)
  })

  it('restituisce un elenco vuoto senza docenti', () => {
    expect(getDocentiStories({})).toEqual([])
    expect(getDocentiStories(null)).toEqual([])
  })
})

describe('joinNames', () => {
  it.each([
    [[], ''],
    [['A'], 'A'],
    [['A', 'B'], 'A e B'],
    [['A', 'B', 'C'], 'A, B e C'],
  ])('%j → %s', (names, expected) => {
    expect(joinNames(names)).toBe(expected)
  })
})

describe('findOpendayByDate', () => {
  const events = [
    { date: '2026-11-16 20:00', isOpenday: true, docenti: [docente('A')] },
    { date: '2026-11-16 20:00', isOpenday: false },
    { date: '2026-12-14 20:00', isOpenday: true },
  ] as any[]

  it("trova l'open day con la stessa data e ora", () => {
    const iso = new Date('2026-11-16 20:00').toISOString()
    expect(findOpendayByDate(events, iso)).toBe(events[0])
  })

  it('non trova nulla con una data diversa o non valida', () => {
    expect(findOpendayByDate(events, new Date('2026-11-17 20:00').toISOString())).toBeUndefined()
    expect(findOpendayByDate(events, 'non-una-data')).toBeUndefined()
  })
})
