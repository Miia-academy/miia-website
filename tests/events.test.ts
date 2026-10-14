import { describe, expect, it } from 'vitest'
import { findOpendayByDate, getDocentiNames, joinNames } from '@modules/events'

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
