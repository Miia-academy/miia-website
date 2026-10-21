import { describe, expect, it } from 'vitest'
import {
  calendarioDa,
  corrisponde,
  modoSuPagina,
  motivoEsclusione,
  ordineBanner,
  paginaSenzaBanner,
  personaDaDettaglio,
  rapportoBanner,
  riempi,
  scegliBanner,
  scegliPerPosto,
  variabili,
  type BannerDati,
  type BannerStory,
  type Contesto,
  type Persona,
} from '@modules/banner'
import { nuovoDettaglio, registraModulo, registraPagina } from '@modules/profilo'
import { moduloPerBanner } from '@components/banners/bannerForm'

const now = new Date('2026-11-10T09:00:00Z')

const calendario = calendarioDa(
  [
    { date: '2026-11-16T19:30:00.000Z', isOpenday: true, openday: 'interni - primo livello', name: 'openday-interni-novembre', docentiNomi: 'Panizzo e Vorazzo' },
    { date: '2026-10-01T19:30:00.000Z', isOpenday: true, openday: 'interni - primo livello', name: 'openday-interni-ottobre' },
  ],
  [
    { starts: '2026-12-01', page: { cached_url: 'corsi/interior-design/corso-interior-design-primo-livello/' }, posti: 4 },
    { starts: '2026-12-01', page: { cached_url: 'corsi/interior-design/corso-interior-design-primo-livello/' }, posti: 3 },
    { starts: '2027-03-01', page: { cached_url: 'corsi/fashion-design/' }, posti: 10 },
  ]
)

const persona = (p: Partial<Persona> = {}): Persona => ({
  visite: 2,
  contatto: false,
  moduli: [],
  fascia: 'freddo',
  area: 'interni',
  temi: [],
  pagine: {},
  ...p,
})

const ctx = (c: Partial<Contesto> = {}): Contesto => ({
  path: '/accademia',
  now,
  consenso: true,
  persona: persona(),
  calendario,
  memoria: { chiusi: {}, usati: {}, vistiInVisita: [] },
  ...c,
})

const banner = (uuid: string, content: BannerStory['content']): BannerStory => ({
  uuid,
  slug: `banner/${uuid}`,
  content: { nome: uuid, modo: 'pannello', azione: [{ label: 'Vai', link: { cached_url: 'open-day/interior-design/' } }], ...content },
})

describe('banner: pagine', () => {
  it('riconosce home, cartelle e pagine con le sottopagine', () => {
    expect(corrisponde('/', '/')).toBe(true)
    expect(corrisponde('/blog', '/')).toBe(false)
    expect(corrisponde('/blog/interior-design/focus-cucina-2025', '/blog/')).toBe(true)
    expect(corrisponde('/blog/', '/blog/')).toBe(false)
    expect(corrisponde('/lavoro/inserzioni/12', '/lavoro/inserzioni')).toBe(true)
    expect(corrisponde('/lavoro', '/lavoro/inserzioni')).toBe(false)
  })

  it('esclude aree riservate, contatti e le pagine scritte in Storyblok', () => {
    expect(paginaSenzaBanner('/contatti')).toBe(true)
    expect(paginaSenzaBanner('/studenti/profilo')).toBe(true)
    expect(paginaSenzaBanner('/open-day/accedi/openday-interni-novembre')).toBe(true)
    expect(paginaSenzaBanner('/docenti', '/iscrizione, /docenti')).toBe(true)
    expect(paginaSenzaBanner('/corsi/interior-design')).toBe(false)
  })

  it('sulla pagina open day solo avvisi; negli articoli la finestra diventa pannello', () => {
    expect(modoSuPagina({ modo: 'pannello' }, '/open-day/interior-design')).toBeNull()
    expect(modoSuPagina({ modo: 'avviso' }, '/open-day/interior-design')).toBe('avviso')
    expect(modoSuPagina({ modo: 'finestra' }, '/blog/interior-design/focus-cucina-2025')).toBe('pannello')
    expect(modoSuPagina({ modo: 'finestra' }, '/blog')).toBe('finestra')
    expect(modoSuPagina({ modo: 'sezione' }, '/')).toBeNull()
  })
})

describe('banner: condizioni', () => {
  const invito = banner('invito', {
    pubblico: ['non-contatto', 'interni', 'non-iscritto-open-day'],
    momento: ['open-day-7'],
    titolo: 'Il {data_open_day} apriamo le porte',
  })

  it('compare se Pubblico e Momento sono veri', () => {
    expect(motivoEsclusione(invito, ctx())).toBeNull()
  })

  it('senza consenso marketing non compare un banner con Pubblico', () => {
    expect(motivoEsclusione(invito, ctx({ consenso: false, persona: null }))).toMatch(/consenso/)
  })

  it('senza Pubblico compare anche senza consenso', () => {
    const libero = banner('libero', { momento: ['open-day-30'] })
    expect(motivoEsclusione(libero, ctx({ consenso: false, persona: null }))).toBeNull()
  })

  it('non compare sulla pagina a cui porta, né in home che ha già la sezione open day', () => {
    expect(motivoEsclusione(invito, ctx({ path: '/open-day/interior-design' }))).not.toBeNull()
    expect(motivoEsclusione(banner('x', { modo: 'avviso' }), ctx({ path: '/open-day/interior-design/' }))).toMatch(/questa pagina/)
    expect(motivoEsclusione(invito, ctx({ path: '/' }))).toMatch(/open day/)
  })

  it('Momento falso se l\'open day è oltre i giorni previsti', () => {
    expect(motivoEsclusione(invito, ctx({ now: new Date('2026-11-01T09:00:00Z') }))).toMatch(/Momento/)
  })

  it('chi è iscritto all\'open day o è un contatto non lo vede', () => {
    expect(motivoEsclusione(invito, ctx({ persona: persona({ openDay: '2026-11-16' }) }))).toMatch(/non-iscritto-open-day/)
    expect(motivoEsclusione(invito, ctx({ persona: persona({ contatto: true, moduli: ['b'] }) }))).toMatch(/non-contatto/)
  })

  it('le voci che arrivano da Brevo restano false', () => {
    const prezzo = banner('prezzo', { pubblico: ['contatto', 'partecipato-open-day'] })
    expect(motivoEsclusione(prezzo, ctx({ persona: persona({ contatto: true }) }))).toMatch(/partecipato-open-day/)
  })

  it('frequenza: chiuso, usato, già visto in questa visita', () => {
    const b = banner('f', { pausa_giorni: '7' })
    expect(motivoEsclusione(b, ctx({ memoria: { chiusi: { f: '2026-11-08T09:00:00Z' }, usati: {}, vistiInVisita: [] } }))).toMatch(/chiuso/)
    expect(motivoEsclusione(b, ctx({ memoria: { chiusi: { f: '2026-11-01T09:00:00Z' }, usati: {}, vistiInVisita: [] } }))).toBeNull()
    expect(motivoEsclusione(b, ctx({ memoria: { chiusi: {}, usati: { f: '2026-10-01' }, vistiInVisita: [] } }))).toMatch(/cliccato/)
    expect(motivoEsclusione(b, ctx({ memoria: { chiusi: {}, usati: {}, vistiInVisita: ['f'] } }))).toMatch(/visita/)
  })

  it('"Non ha ancora visto queste pagine"', () => {
    const lavoro = banner('lavoro', { modo: 'avviso', non_visitato: '/lavoro', azione: [{ link: { cached_url: 'lavoro/' } }] })
    expect(motivoEsclusione(lavoro, ctx())).toBeNull()
    expect(motivoEsclusione(lavoro, ctx({ persona: persona({ pagine: { '/lavoro': 1 } }) }))).toMatch(/già visto/)
  })

  it('mostra dal / fino al', () => {
    expect(motivoEsclusione(banner('d', { pubblica_dal: '2026-11-11 00:00' }), ctx())).toMatch(/Mostra dal/)
    expect(motivoEsclusione(banner('d', { pubblica_al: '2026-11-09 00:00' }), ctx())).toMatch(/fino al/)
  })
})

describe('banner: variabili', () => {
  it('date, giorni, docenti, inizio corsi e posti', () => {
    const v = variabili({ pubblico: ['interni'] }, ctx())
    expect(v.data_open_day).toBe('16 novembre')
    expect(v.giorni_open_day).toBe('6')
    expect(v.docenti_open_day).toBe('Panizzo e Vorazzo')
    expect(v.inizio_corsi).toBe('1 dicembre')
    expect(v.settimane_inizio_corsi).toBe('3')
    expect(v.posti_rimasti).toBe('7')
  })

  it('un testo con una variabile sconosciuta non si mostra', () => {
    expect(riempi('Mancano {giorni_open_day} giorni', { giorni_open_day: '6' })).toBe('Mancano 6 giorni')
    expect(riempi('Scade il {chiusura_prezzo_agevolato}', {})).toBeNull()
    const b = banner('v', { titolo: 'Scade il {chiusura_prezzo_agevolato}' })
    expect(motivoEsclusione(b, ctx())).toMatch(/variabile/)
  })
})

describe('banner: priorità', () => {
  const a = banner('a', { pubblico: ['contatto'] })
  const b = banner('b', {})
  const c = banner('c', { modo: 'avviso', azione: [{ link: { cached_url: 'blog/' } }] })
  const dati: BannerDati = { tutti: [a, b, c], ordine: ['a', 'b', 'c'], escludi: '' }

  it('prima i banner della pagina, poi la lista di tutto il sito, senza doppioni', () => {
    expect(ordineBanner(dati, ['c', 'zzz']).map((s) => s.uuid)).toEqual(['c', 'a', 'b'])
  })

  it('sceglie il primo valido', () => {
    expect(scegliBanner(dati, ctx())?.story.uuid).toBe('b')
    expect(scegliBanner(dati, ctx({ persona: persona({ contatto: true }) }))?.story.uuid).toBe('a')
    expect(scegliBanner(dati, ctx({ path: '/contatti' }))).toBeNull()
  })

  it('il rapporto per ?debug=profilo spiega ogni banner', () => {
    const r = rapportoBanner(dati, ctx())
    expect(r.map((x) => x.motivo)).toEqual(['Pubblico non vero: contatto', null, 'ne compare già uno con priorità più alta'])
  })
})

describe('banner: persona e modulo', () => {
  it('ricava la persona dal profilo nel browser', () => {
    const d = nuovoDettaglio(new Date('2026-11-10T08:00:00Z'))
    registraPagina(d, '/corsi/interior-design', new Date('2026-11-10T08:00:00Z'))
    registraPagina(d, '/corsi/interior-design', new Date('2026-11-10T08:01:00Z'))
    registraModulo(d, 'download', undefined, new Date('2026-11-10T08:02:00Z'))
    const p = personaDaDettaglio(d)
    expect(p).toMatchObject({ visite: 1, contatto: true, moduli: ['b'], area: 'interni' })
    expect(p.pagine['/corsi/interior-design']).toBe(2)
  })

  it('la presentazione nel banner tiene solo i campi decisi e passa area e livello nascosti', () => {
    const campo = (id: string, input = 'text') => ({ id, _uid: id, component: 'field', input, label: id }) as any
    const form = moduloPerBanner(
      {
        _uid: 'f',
        component: 'form',
        tracking: 'download',
        fields: ['email', 'nome', 'cognome', 'sms', 'finalita', 'design', 'sede', 'newsletter'].map((id) => campo(id)),
      } as any,
      'interni'
    )
    expect(form.fields?.map((f) => f.id)).toEqual(['email', 'nome', 'cognome', 'sms', 'finalita', 'area', 'programma'])
    expect(form.fields?.find((f) => f.id === 'area')).toMatchObject({ hidden: true, placeholder: 'interior' })
  })

  it('gli altri moduli restano come in Storyblok', () => {
    const form = moduloPerBanner({ _uid: 'n', component: 'form', tracking: 'news', fields: [{ id: 'email' }, { id: 'area' }] } as any)
    expect(form.fields?.map((f) => f.id)).toEqual(['email', 'area'])
  })
})

describe('banner: posti fissi nelle pagine', () => {
  const contatti = banner('contatti', { pubblico: ['contatto'], modo: 'finestra' })
  const tutti = banner('tutti', { modo: 'avviso', pausa_giorni: '7', azione: [{ link: { cached_url: 'blog/' } }] })
  const dati: BannerDati = { tutti: [contatti, tutti], ordine: [], escludi: '', posti: { articoli: ['contatti', 'tutti'] } }

  it('compare il primo valido, qualunque sia il suo Modo', () => {
    expect(scegliPerPosto(dati, 'articoli', ctx({ path: '/blog/interior-design/focus' }))?.uuid).toBe('tutti')
    expect(scegliPerPosto(dati, 'articoli', ctx({ persona: persona({ contatto: true }) }))?.uuid).toBe('contatti')
  })

  it('la sezione non si chiude: conta solo clic o modulo inviato', () => {
    const memoria = { chiusi: { tutti: '2026-11-09T09:00:00Z' }, usati: {}, vistiInVisita: ['tutti'] }
    expect(scegliPerPosto(dati, 'articoli', ctx({ memoria }))?.uuid).toBe('tutti')
    expect(scegliPerPosto(dati, 'articoli', ctx({ memoria: { ...memoria, usati: { tutti: '2026-11-09' } } }))).toBeNull()
  })

  it('senza lista per quel posto non c\'è niente', () => {
    expect(scegliPerPosto(dati, 'home', ctx())).toBeNull()
  })
})
