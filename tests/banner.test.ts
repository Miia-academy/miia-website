import { describe, expect, it } from 'vitest'
import {
  calendarFrom,
  matchesPath,
  normalizeBanner,
  normalizeSiteBanners,
  modeOnPage,
  exclusionReason,
  bannerOrder,
  isPageWithoutBanners,
  visitorFromDetail,
  bannerReport,
  fillText,
  pickBanner,
  pickForSlot,
  textVariables,
  type BannerData,
  type BannerStory,
  type BannerContext,
  type Visitor,
} from '@modules/banner'
import { nuovoDettaglio, registraModulo, registraPagina } from '@modules/profilo'
import { formForBanner } from '@components/banners/bannerForm'

const now = new Date('2026-11-10T09:00:00Z')

const calendar = calendarFrom(
  [
    { date: '2026-11-16T19:30:00.000Z', isOpenday: true, openday: 'interni - primo livello', name: 'openday-interni-novembre', teacherNames: 'Panizzo e Vorazzo' },
    { date: '2026-10-01T19:30:00.000Z', isOpenday: true, openday: 'interni - primo livello', name: 'openday-interni-ottobre' },
  ],
  [
    { starts: '2026-12-01', page: { cached_url: 'corsi/interior-design/corso-interior-design-primo-livello/' }, seats: 4 },
    { starts: '2026-12-01', page: { cached_url: 'corsi/interior-design/corso-interior-design-primo-livello/' }, seats: 3 },
    { starts: '2027-03-01', page: { cached_url: 'corsi/fashion-design/' }, seats: 10 },
  ]
)

const visitor = (p: Partial<Visitor> = {}): Visitor => ({
  visits: 2,
  contact: false,
  forms: [],
  band: 'freddo',
  area: 'interni',
  topics: [],
  pages: {},
  ...p,
})

const ctx = (c: Partial<BannerContext> = {}): BannerContext => ({
  path: '/accademia',
  now,
  consent: true,
  visitor: visitor(),
  calendar,
  memory: { closed: {}, used: {}, seenThisVisit: [] },
  ...c,
})

const banner = (uuid: string, content: BannerStory['content']): BannerStory => ({
  uuid,
  slug: `banner/${uuid}`,
  content: { name: uuid, mode: 'pannello', action: [{ label: 'Vai', link: { cached_url: 'open-day/interior-design/' } }], ...content },
})

describe('banner: pages', () => {
  it('matches the home, folders and pages with their subpages', () => {
    expect(matchesPath('/', '/')).toBe(true)
    expect(matchesPath('/blog', '/')).toBe(false)
    expect(matchesPath('/blog/interior-design/focus-cucina-2025', '/blog/')).toBe(true)
    expect(matchesPath('/blog/', '/blog/')).toBe(false)
    expect(matchesPath('/lavoro/inserzioni/12', '/lavoro/inserzioni')).toBe(true)
    expect(matchesPath('/lavoro', '/lavoro/inserzioni')).toBe(false)
  })

  it('excludes private areas, contacts and the pages written in Storyblok', () => {
    expect(isPageWithoutBanners('/contatti')).toBe(true)
    expect(isPageWithoutBanners('/studenti/profilo')).toBe(true)
    expect(isPageWithoutBanners('/open-day/accedi/openday-interni-novembre')).toBe(true)
    expect(isPageWithoutBanners('/docenti', '/iscrizione, /docenti')).toBe(true)
    expect(isPageWithoutBanners('/corsi/interior-design')).toBe(false)
  })

  it('only notices on the open day page; in articles the window becomes a panel', () => {
    expect(modeOnPage({ mode: 'pannello' }, '/open-day/interior-design')).toBeNull()
    expect(modeOnPage({ mode: 'avviso' }, '/open-day/interior-design')).toBe('avviso')
    expect(modeOnPage({ mode: 'finestra' }, '/blog/interior-design/focus-cucina-2025')).toBe('pannello')
    expect(modeOnPage({ mode: 'finestra' }, '/blog')).toBe('finestra')
    expect(modeOnPage({ mode: 'sezione' }, '/')).toBeNull()
  })
})

describe('banner: conditions', () => {
  const invito = banner('invito', {
    audience: ['non-contatto', 'interni', 'non-iscritto-open-day'],
    timing: ['open-day-7'],
    title: 'Il {data_open_day} apriamo le porte',
  })

  it('appears when audience and timing are true', () => {
    expect(exclusionReason(invito, ctx())).toBeNull()
  })

  it('without marketing consent a banner with an audience does not appear', () => {
    expect(exclusionReason(invito, ctx({ consent: false, visitor: null }))).toMatch(/consenso/)
  })

  it('without an audience it appears without consent too', () => {
    const libero = banner('libero', { timing: ['open-day-30'] })
    expect(exclusionReason(libero, ctx({ consent: false, visitor: null }))).toBeNull()
  })

  it('does not appear on the page it leads to, nor in the home that already has the open day section', () => {
    expect(exclusionReason(invito, ctx({ path: '/open-day/interior-design' }))).not.toBeNull()
    expect(exclusionReason(banner('x', { mode: 'avviso' }), ctx({ path: '/open-day/interior-design/' }))).toMatch(/questa pagina/)
    expect(exclusionReason(invito, ctx({ path: '/' }))).toMatch(/open day/)
  })

  it('timing false when the open day is further than the set days', () => {
    expect(exclusionReason(invito, ctx({ now: new Date('2026-11-01T09:00:00Z') }))).toMatch(/Momento/)
  })

  it('hidden from open day sign-ups and contacts', () => {
    expect(exclusionReason(invito, ctx({ visitor: visitor({ openDay: '2026-11-16' }) }))).toMatch(/non-iscritto-open-day/)
    expect(exclusionReason(invito, ctx({ visitor: visitor({ contact: true, forms: ['b'] }) }))).toMatch(/non-contatto/)
  })

  it('items coming from Brevo stay false', () => {
    const prezzo = banner('prezzo', { audience: ['contatto', 'partecipato-open-day'] })
    expect(exclusionReason(prezzo, ctx({ visitor: visitor({ contact: true }) }))).toMatch(/partecipato-open-day/)
  })

  it('frequency: closed, used, already seen in this visit', () => {
    const b = banner('f', { pause_days: '7' })
    expect(exclusionReason(b, ctx({ memory: { closed: { f: '2026-11-08T09:00:00Z' }, used: {}, seenThisVisit: [] } }))).toMatch(/chiuso/)
    expect(exclusionReason(b, ctx({ memory: { closed: { f: '2026-11-01T09:00:00Z' }, used: {}, seenThisVisit: [] } }))).toBeNull()
    expect(exclusionReason(b, ctx({ memory: { closed: {}, used: { f: '2026-10-01' }, seenThisVisit: [] } }))).toMatch(/cliccato/)
    expect(exclusionReason(b, ctx({ memory: { closed: {}, used: {}, seenThisVisit: ['f'] } }))).toMatch(/visita/)
  })

  it('"has not seen these pages yet"', () => {
    const lavoro = banner('lavoro', { mode: 'avviso', not_visited: '/lavoro', action: [{ link: { cached_url: 'lavoro/' } }] })
    expect(exclusionReason(lavoro, ctx())).toBeNull()
    expect(exclusionReason(lavoro, ctx({ visitor: visitor({ pages: { '/lavoro': 1 } }) }))).toMatch(/già visto/)
  })

  it('publish from / until', () => {
    expect(exclusionReason(banner('d', { publish_from: '2026-11-11 00:00' }), ctx())).toMatch(/Mostra dal/)
    expect(exclusionReason(banner('d', { publish_until: '2026-11-09 00:00' }), ctx())).toMatch(/fino al/)
  })
})

describe('banner: text variables', () => {
  it('dates, days, teachers, course start and seats', () => {
    const v = textVariables({ audience: ['interni'] }, ctx())
    expect(v.data_open_day).toBe('16 novembre')
    expect(v.giorni_open_day).toBe('6')
    expect(v.docenti_open_day).toBe('Panizzo e Vorazzo')
    expect(v.inizio_corsi).toBe('1 dicembre')
    expect(v.settimane_inizio_corsi).toBe('3')
    expect(v.posti_rimasti).toBe('7')
  })

  it('a text with an unknown variable is not shown', () => {
    expect(fillText('Mancano {giorni_open_day} giorni', { giorni_open_day: '6' })).toBe('Mancano 6 giorni')
    expect(fillText('Scade il {chiusura_prezzo_agevolato}', {})).toBeNull()
    const b = banner('v', { title: 'Scade il {chiusura_prezzo_agevolato}' })
    expect(exclusionReason(b, ctx())).toMatch(/variabile/)
  })
})

describe('banner: priority', () => {
  const a = banner('a', { audience: ['contatto'] })
  const b = banner('b', {})
  const c = banner('c', { mode: 'avviso', action: [{ link: { cached_url: 'blog/' } }] })
  const data: BannerData = { all: [a, b, c], order: ['a', 'b', 'c'], exclude: '' }

  it('page banners first, then the whole site list, without duplicates', () => {
    expect(bannerOrder(data, ['c', 'zzz']).map((s) => s.uuid)).toEqual(['c', 'a', 'b'])
  })

  it('picks the first valid one', () => {
    expect(pickBanner(data, ctx())?.story.uuid).toBe('b')
    expect(pickBanner(data, ctx({ visitor: visitor({ contact: true }) }))?.story.uuid).toBe('a')
    expect(pickBanner(data, ctx({ path: '/contatti' }))).toBeNull()
  })

  it('the ?debug=profilo report explains every banner', () => {
    const r = bannerReport(data, ctx())
    expect(r.map((x) => x.reason)).toEqual(['Pubblico non vero: contatto', null, 'ne compare già uno con priorità più alta'])
  })
})

describe('banner: visitor and form', () => {
  it('builds the visitor from the browser profile', () => {
    const d = nuovoDettaglio(new Date('2026-11-10T08:00:00Z'))
    registraPagina(d, '/corsi/interior-design', new Date('2026-11-10T08:00:00Z'))
    registraPagina(d, '/corsi/interior-design', new Date('2026-11-10T08:01:00Z'))
    registraModulo(d, 'download', undefined, new Date('2026-11-10T08:02:00Z'))
    const p = visitorFromDetail(d)
    expect(p).toMatchObject({ visits: 1, contact: true, forms: ['b'], area: 'interni' })
    expect(p.pages['/corsi/interior-design']).toBe(2)
  })

  it('the presentation form keeps only the chosen fields and sends hidden area and level', () => {
    const field = (id: string, input = 'text') => ({ id, _uid: id, component: 'field', input, label: id }) as any
    const form = formForBanner(
      {
        _uid: 'f',
        component: 'form',
        tracking: 'download',
        fields: ['email', 'nome', 'cognome', 'sms', 'finalita', 'design', 'sede', 'newsletter'].map((id) => field(id)),
      } as any,
      'interni'
    )
    expect(form.fields?.map((f) => f.id)).toEqual(['email', 'nome', 'cognome', 'sms', 'finalita', 'area', 'programma'])
    expect(form.fields?.find((f) => f.id === 'area')).toMatchObject({ hidden: true, placeholder: 'interior' })
  })

  it('other forms stay as in Storyblok', () => {
    const form = formForBanner({ _uid: 'n', component: 'form', tracking: 'news', fields: [{ id: 'email' }, { id: 'area' }] } as any)
    expect(form.fields?.map((f) => f.id)).toEqual(['email', 'area'])
  })
})

describe('banner: fixed places in the pages', () => {
  const contatti = banner('contatti', { audience: ['contatto'], mode: 'finestra' })
  const tutti = banner('tutti', { mode: 'avviso', pause_days: '7', action: [{ link: { cached_url: 'blog/' } }] })
  const data: BannerData = { all: [contatti, tutti], order: [], exclude: '', slots: { articles: ['contatti', 'tutti'] } }

  it('the first valid one appears, whatever its mode', () => {
    expect(pickForSlot(data, 'articles', ctx({ path: '/blog/interior-design/focus' }))?.uuid).toBe('tutti')
    expect(pickForSlot(data, 'articles', ctx({ visitor: visitor({ contact: true }) }))?.uuid).toBe('contatti')
  })

  it('the section cannot be closed: only a click or a sent form counts', () => {
    const memory = { closed: { tutti: '2026-11-09T09:00:00Z' }, used: {}, seenThisVisit: ['tutti'] }
    expect(pickForSlot(data, 'articles', ctx({ memory }))?.uuid).toBe('tutti')
    expect(pickForSlot(data, 'articles', ctx({ memory: { ...memory, used: { tutti: '2026-11-09' } } }))).toBeNull()
  })

  it('nothing without a list for that place', () => {
    expect(pickForSlot(data, 'home', ctx())).toBeNull()
  })
})

describe('banner: Storyblok keys before and after the move to English', () => {
  it('reads the old Italian keys when the new ones are missing', () => {
    expect(normalizeBanner({ titolo: 'Vecchio', modo: 'avviso', pubblico: ['moda'], modulo: 'uuid-form' })).toEqual({
      title: 'Vecchio',
      mode: 'avviso',
      audience: ['moda'],
      form: 'uuid-form',
    })
  })

  it('the new key wins, even when empty', () => {
    expect(normalizeBanner({ title: 'Nuovo', titolo: 'Vecchio', text: '', testo: 'Vecchio' })).toEqual({ title: 'Nuovo', text: '' })
  })

  it('site list, exclusions and fixed places', () => {
    expect(normalizeSiteBanners({ banner: ['a'], escludi: '/x', posto_home: ['h'], slot_articles: ['n'], posto_articoli: ['o'] })).toEqual({
      order: ['a'],
      exclude: '/x',
      slots: { home: ['h'], articles: ['n'], projects: [] },
    })
    expect(normalizeSiteBanners(undefined)).toEqual({ order: [], exclude: '', slots: { home: [], articles: [], projects: [] } })
  })
})
