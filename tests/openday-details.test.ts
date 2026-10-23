import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOpendayDetails,
  hasReservedPrice,
  calendarText,
  courseForOpenday,
  euro,
  loadOpendayDetails,
} from '@modules/openday-details'
import { sanitizeAttributes } from '@modules/crm-form'
import type { Edition } from '@modules/enrollment/catalog'

// Open day fields on the contact (OD_*, PREZZO_*, PROSSIMO_OD_TESTO): read from
// Storyblok when someone signs up, so the open day emails stop using fallback texts.

const LIST = { unica: 5490, rata5: 1150, rata10: 594, offerta: 4990, esame: 300 }

const edition = (over: Partial<Edition>): Edition => ({
  chiave: 'k',
  titolo: '',
  sede: 'Treviso',
  giorni: ['Sabato'],
  orari: ['9:00/12:00', '13:00/16:00'],
  inizio: '2027-03-06',
  fine: null,
  posti: 12,
  ...over,
})

const ev = (codice: string, area: string, iso: string) => ({ codice, titolo: '', area, inizio: new Date(iso), link: '' })

describe('helpers', () => {
  it('maps the open day to its course folder', () => {
    expect(courseForOpenday('interni - primo livello')).toBe('corso-interior-design-primo-livello')
    expect(courseForOpenday('moda - secondo livello')).toBe('corso-fashion-design-secondo-livello')
    expect(courseForOpenday('')).toBeNull()
    expect(courseForOpenday('interni')).toBeNull()
  })

  it('writes amounts like the emails', () => {
    expect(euro(4990)).toBe('4.990 €')
    expect(euro(499)).toBe('499 €')
    expect(euro(4990 / 10)).toBe('499 €')
    expect(euro(998.5)).toBe('998,50 €')
  })

  it('lists the editions starting in the first month', () => {
    const text = calendarText([
      edition({}),
      edition({ sede: 'Padova', giorni: ['Martedì', 'Giovedì'], orari: ['19:00/22:00'], inizio: '2027-03-09' }),
      edition({ sede: 'Bassano', inizio: '2027-10-02' }),
    ])
    expect(text).toBe('Treviso: sabato, 9:00-12:00 e 13:00-16:00; Padova: martedì e giovedì, 19:00-22:00')
  })
})

describe('buildOpendayDetails', () => {
  const event = ev('openday-interni-novembre', 'interni', '2026-11-16T20:00:00Z')
  const events = [
    ev('openday-moda-novembre', 'moda', '2026-11-17T20:00:00Z'),
    event,
    ev('openday-interni-dicembre', 'interni', '2026-12-14T20:00:00Z'),
  ].sort((a, b) => a.inizio.getTime() - b.inizio.getTime())

  it('fills every field when Storyblok has all the data', () => {
    const details = buildOpendayDetails({
      event,
      events,
      teachers: ['Anna Rossi', 'Luca Bianchi'],
      editions: [edition({})],
      priceList: LIST,
    })
    expect(details).toEqual({
      OD_DATA_TESTO: 'lunedì 16 novembre alle 21:00',
      OD_VALIDO: true,
      OD_DOCENTI: 'Anna Rossi e Luca Bianchi',
      OD_PARTENZA: 'marzo 2027',
      OD_CALENDARIO: 'Treviso: sabato, 9:00-12:00 e 13:00-16:00',
      PREZZO_OD: '4.990 €',
      PREZZO_OD_RATA5: '998 €',
      PREZZO_OD_RATA10: '499 €',
      PREZZO_UNICA: '5.490 €',
      PREZZO_RATA5: '1.150 €',
      PREZZO_RATA10: '594 €',
      PREZZO_ESAME: '300 €',
      PROSSIMO_OD_TESTO: 'lunedì 14 dicembre',
    })
  })

  it('no reserved price without a future edition or a price list', () => {
    expect(buildOpendayDetails({ event, events, teachers: [], editions: [], priceList: LIST }).OD_VALIDO).toBe(false)
    // "Prezzo agevolato" box unticked in the event: no reserved price
    const off = buildOpendayDetails({ event, events, teachers: [], editions: [edition({})], priceList: LIST, reservedPrice: false })
    expect(off.OD_VALIDO).toBe(false)
    expect(hasReservedPrice({ prezzo_agevolato: false })).toBe(false)
    // Events created before the box existed keep the reserved price
    expect(hasReservedPrice({})).toBe(true)
    expect(hasReservedPrice({ prezzo_agevolato: true })).toBe(true)
    const noList = buildOpendayDetails({ event, events, teachers: [], editions: [edition({})], priceList: null })
    expect(noList.OD_VALIDO).toBe(false)
    expect(noList.PREZZO_OD).toBeUndefined()
  })

  it('no next open day text after the last one of the area', () => {
    const last = events[events.length - 1]
    expect(buildOpendayDetails({ event: last, events, teachers: [], editions: [], priceList: null }).PROSSIMO_OD_TESTO).toBeUndefined()
  })
})

describe('loadOpendayDetails', () => {
  afterEach(() => vi.unstubAllGlobals())

  function storyblok(routes: Record<string, unknown>) {
    vi.stubEnv('NEXT_PUBLIC_STORYBLOK_PREVIEW', 'token')
    const fetch = vi.fn(async (url: string) => {
      const u = new URL(url)
      const key = u.pathname.endsWith('datasource_entries')
        ? 'listino'
        : u.searchParams.get('by_uuids')
          ? 'persone'
          : u.searchParams.get('content_type') || ''
      return { ok: key in routes, status: key in routes ? 200 : 404, json: async () => routes[key] }
    })
    vi.stubGlobal('fetch', fetch)
    return fetch
  }

  const EVENT = {
    name: 'openday-interni-novembre',
    slug: 'openday-interni-novembre',
    content: { date: '2026-11-16 21:00', openday: 'interni - primo livello', docenti: ['u1', 'u2'] },
  }

  it('reads event, teachers, editions and price list from Storyblok', async () => {
    storyblok({
      event: { stories: [EVENT] },
      persone: { stories: [{ uuid: 'u2', content: { title: 'Luca Bianchi' } }, { uuid: 'u1', content: { title: 'Anna Rossi' } }] },
      course: {
        stories: [
          {
            uuid: 'e1',
            full_slug: 'corsi/interior-design/corso-interior-design-primo-livello/x/treviso-sabato',
            content: { starts: '2027-03-06 00:00', days: ['Sabato'], hours: ['9:00/12:00'], location: 'l1', seats: '12' },
          },
        ],
      },
      location: { stories: [{ uuid: 'l1', content: { title: 'Treviso' } }] },
      listino: {
        datasource_entries: [
          { name: 'prezzo_unica', value: '5490' },
          { name: 'rata_5', value: '1150' },
          { name: 'rata_10', value: '594' },
          { name: 'prezzo_open_day', value: '4990' },
          { name: 'quota_esame', value: '300' },
        ],
      },
    })
    const details = await loadOpendayDetails('openday-interni-novembre')
    expect(details).toMatchObject({
      OD_DATA_TESTO: 'lunedì 16 novembre alle 21:00',
      OD_VALIDO: true,
      OD_DOCENTI: 'Anna Rossi e Luca Bianchi',
      OD_PARTENZA: 'marzo 2027',
      OD_CALENDARIO: 'Treviso: sabato, 9:00-12:00',
      PREZZO_OD: '4.990 €',
    })
  })

  it('returns nothing for an unknown code or when Storyblok fails', async () => {
    storyblok({ event: { stories: [EVENT] } })
    expect(await loadOpendayDetails('openday-che-non-esiste')).toEqual({})
    expect(await loadOpendayDetails('../x')).toEqual({})
    storyblok({})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await loadOpendayDetails('openday-interni-novembre')).toEqual({})
  })
})

describe('form attributes', () => {
  it('a public form cannot write the reserved price or the open day texts', () => {
    const attrs = sanitizeAttributes({
      NOME: 'Anna',
      OD_VALIDO: true,
      SCADENZA_OFFERTA: '2027-12-31',
      OD_RITARDO: false,
      PREZZO_OD: '1 €',
      OD_PARTENZA: 'domani',
    })
    expect(attrs).toEqual({ NOME: 'Anna' })
  })
})
