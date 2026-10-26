import { describe, expect, it } from 'vitest'
import {
  checkForm,
  checkForms,
  courseFromPageSlug,
  mergeAlias,
  migrateSchemas,
  migrateStory,
  optionValues,
  type BrevoAttribute,
  type FormBlok,
} from '@modules/forms-brevo'

// Attributi Brevo come li restituisce /contacts/attributes (estratto del 22/10)
const ATTRIBUTES: BrevoAttribute[] = [
  { name: 'NOME', category: 'normal', type: 'text' },
  { name: 'COGNOME', category: 'normal', type: 'text' },
  { name: 'SMS', category: 'normal', type: 'text' },
  { name: 'NEWSLETTER', category: 'normal', type: 'boolean' },
  { name: 'FINALITA', category: 'normal', type: 'multiple-choice', multiCategoryOptions: ['lavoro', 'aggiornamento', 'interesse', 'studio', 'altro'] },
  { name: 'STUDI', category: 'normal', type: 'multiple-choice', multiCategoryOptions: ['media', 'superiore', 'laurea'] },
  { name: 'AREA', category: 'normal', type: 'multiple-choice', multiCategoryOptions: ['interior', 'fashion'] },
  { name: 'PROGRAMMA', category: 'normal', type: 'multiple-choice', multiCategoryOptions: ['primo', 'secondo'] },
  {
    name: 'OCCUPAZIONE',
    category: 'normal',
    type: 'multiple-choice',
    multiCategoryOptions: ['Studente', 'Disoccupato', 'Impiegato', 'Altro'],
  },
  { name: 'INTERESSE_CORSO', category: 'category', enumeration: [{ value: 1, label: 'interni - primo livello' }] },
]

const field = (id: string, extra: Record<string, unknown> = {}) => ({ id, _uid: id, component: 'field', input: 'text', label: id, ...extra })

const BROCHURE: FormBlok = {
  component: 'form',
  tracking: 'download',
  list: ['25', '15'],
  fields: [
    field('email', { input: 'email' }),
    field('nome'),
    field('sms', { input: 'tel' }),
    field('finalita', { input: 'select', options: 'Cambiare la mia professione:lavoro\nAltro motivo:altro' }),
    field('newsletter', { input: 'checkbox' }),
    field('validation', { input: 'hidden' }),
  ],
}

const ENROLL: FormBlok = {
  component: 'form',
  tracking: 'enroll',
  list: [17, 25],
  fields: [
    field('email', { input: 'email' }),
    field('studi', { input: 'select', options: 'Scuola media:media\nLaurea universitaria:laurea' }),
    field('occupazione', { input: 'text', options: 'Studente/tirocinante:studente\nImpiegato d’ufficio:impiegato\nAltro ruolo:altro' }),
  ],
}

const ALIASES = { 'uuid-brochure': BROCHURE, 'uuid-enroll': ENROLL }

// Pagina sede come in Storyblok il 22/10 (Padova): richiesta iscrizione + brochure con i vecchi campi
const sedePage = () => ({
  component: 'page',
  body: [
    {
      component: 'aside',
      courses: ['edizione-uuid'],
      forms: [
        { component: 'form', alias: 'uuid-enroll', fields: [field('iscrizione_modulo', { input: 'hidden', placeholder: 'x.pdf' })] },
        {
          component: 'form',
          alias: 'uuid-brochure',
          fields: [
            field('interesse_area', { input: 'hidden', placeholder: 'interior-design' }),
            field('interesse_corso', { input: 'hidden', placeholder: 'interni - primo livello' }),
            field('collegamento_materiale', { input: 'hidden', placeholder: 'corso-interni-primo-livello.pdf' }),
          ],
        },
      ],
    },
  ],
})

describe('controllo moduli Storyblok contro attributi Brevo', () => {
  it('legge i valori delle opzioni "Etichetta:valore"', () => {
    expect(optionValues('Scuola media:media\nLaurea: laurea\n\nsolo')).toEqual(['media', 'laurea', 'solo'])
  })

  it('il modulo brochure di oggi: tracciamento da cambiare e niente area/programma', () => {
    const findings = checkForm(BROCHURE, ATTRIBUTES, 'moduli/scarica-la-presentazione', [15, 25])
    expect(findings.map((f) => f.message)).toEqual([
      'tracciamento "download" da cambiare in "brochure" al passaggio a main',
      'modulo brochure senza area e programma: l’automazione non sa quale presentazione mandare',
    ])
    expect(findings.every((f) => f.level === 'avviso')).toBe(true)
  })

  it('occupazione a testo libero e valori minuscoli: errori, Brevo rifiuterebbe il contatto', () => {
    const messages = checkForm(ENROLL, ATTRIBUTES, 'moduli/iscrizione-corso').map((f) => `${f.level}: ${f.message}`)
    expect(messages).toContain('errore: campo "occupazione": OCCUPAZIONE in Brevo è a scelta multipla, il campo è "text" (testo libero)')
    expect(messages).toContain('errore: campo "occupazione": valore "studente" non previsto in OCCUPAZIONE (in Brevo è "Studente"); Brevo rifiuta il contatto')
    // "laurea" ora è un'opzione di Brevo (corretta da Miia il 22/10)
    expect(messages.some((m) => m.includes('"studi"'))).toBe(false)
  })

  it('pagine sede: vecchi campi nascosti mai inviati e attributo di tipo categoria', () => {
    const findings = checkForms([{ full_slug: 'corsi/interior-design/corso-padova', content: sedePage() }], ALIASES, ATTRIBUTES)
    const text = findings.map((f) => f.message).join('\n')
    expect(text).toContain('campo "interesse_corso": tipo "hidden" senza la casella Nascosto, il valore non parte mai')
    expect(text).toContain('INTERESSE_CORSO in Brevo è di tipo categoria')
    expect(text).toContain('attributo COLLEGAMENTO_MATERIALE assente in Brevo')
  })

  it('il modulo della pagina eredita campi e tracciamento dal modulo collegato', () => {
    const merged = mergeAlias({ component: 'form', alias: 'uuid-brochure', fields: [field('area')] }, ALIASES)
    expect(merged.tracking).toBe('download')
    expect(merged.fields?.map((f) => f.id)).toEqual(['email', 'nome', 'sms', 'finalita', 'newsletter', 'validation', 'area'])
  })
})

describe('modifiche Storyblok al passaggio a main', () => {
  it('pagina sede: pulsante di iscrizione al posto del modulo, area e programma nascosti', () => {
    const content = sedePage()
    const changes = migrateStory(
      content,
      ALIASES,
      ATTRIBUTES,
      'corso-interior-design-primo-livello',
      'corsi/interior-design/corso-interior-design-primo-livello-padova'
    )
    const [button, brochure] = content.body[0].forms as any[]
    expect(button).toMatchObject({
      component: 'action',
      label: 'Iscriviti online',
      button: true,
      link: { url: '/iscrizione/corso-interior-design-primo-livello' },
    })
    expect(brochure.fields).toEqual([
      expect.objectContaining({ id: 'area', input: 'multiple', hidden: true, placeholder: 'interior' }),
      expect.objectContaining({ id: 'programma', input: 'multiple', hidden: true, placeholder: 'primo' }),
    ])
    expect(changes).toEqual([
      'sidebar: modulo di richiesta iscrizione → pulsante /iscrizione/corso-interior-design-primo-livello',
      'sidebar: filtro edizioni "interni,primo,padova"',
      'sidebar: titolo prezzo dal listino',
      'sidebar: tolti i campi vecchi courses',
      'campi interesse_area/interesse_corso/collegamento_materiale → area "interior" e programma "primo" nascosti',
    ])
    expect(content.body[0]).toMatchObject({ filter: 'interni,primo,padova', price_text: 'A partire da **{rata10}€** per 10 mesi _*iva inclusa_' })
    // Dopo la modifica il controllo non trova più errori nella pagina
    const after = checkForms([{ full_slug: 'p', content }], ALIASES, ATTRIBUTES).filter((f) => f.level === 'errore')
    expect(after).toEqual([])
  })

  it('moduli: tracciamento nuovo e occupazione a scelta con i valori di Brevo', () => {
    const brochure = structuredClone(BROCHURE)
    expect(migrateStory(brochure, {}, ATTRIBUTES, null)).toEqual(['tracciamento download → brochure'])
    expect(brochure.tracking).toBe('brochure')

    const enroll = structuredClone(ENROLL)
    migrateStory(enroll, {}, ATTRIBUTES, null)
    const occupazione = enroll.fields!.find((f) => f.id === 'occupazione')!
    expect(occupazione.input).toBe('select')
    expect(optionValues(occupazione.options)).toEqual(['Studente', 'Impiegato', 'Altro'])
    expect(checkForm(enroll, ATTRIBUTES, 'x').filter((f) => f.level === 'errore')).toEqual([])
  })

  it('pagina corso senza pulsante di iscrizione (secondo livello): lo aggiunge in cima', () => {
    const content = {
      component: 'aside',
      forms: [{ component: 'form', alias: 'uuid-brochure', fields: [] }],
    }
    const changes = migrateStory(content, ALIASES, ATTRIBUTES, 'corso-interior-design-secondo-livello', 'corsi/interior-design/corso-interior-design-secondo-livello/')
    expect(changes).toContain('sidebar: aggiunto il pulsante /iscrizione/corso-interior-design-secondo-livello')
    expect(changes).toContain('sidebar: filtro edizioni "interni,secondo"')
    expect((content.forms as any[]).map((f) => f.component)).toEqual(['action', 'form'])
  })

  it('una seconda esecuzione non cambia più nulla', () => {
    const content = sedePage()
    migrateStory(content, ALIASES, ATTRIBUTES, 'corso-interior-design-primo-livello')
    expect(migrateStory(content, ALIASES, ATTRIBUTES, 'corso-interior-design-primo-livello')).toEqual([])
  })

  it('cartella del corso dalla pagina', () => {
    expect(courseFromPageSlug('corsi/interior-design/corso-interior-design-primo-livello-padova')).toBe('corso-interior-design-primo-livello')
    expect(courseFromPageSlug('corsi/fashion-design/corso-fashion-design-primo-livello/')).toBe('corso-fashion-design-primo-livello')
    expect(courseFromPageSlug('corsi/fashion-design/')).toBeNull()
  })

  it('schemi: valori di tracciamento nuovi e action ammesse nella sidebar', () => {
    const form = { schema: { tracking: { options: [{ value: 'news', name: 'Newsletter' }, { value: 'download', name: 'Scarica' }] } } }
    const aside = { schema: { forms: { component_whitelist: ['form'] } } }
    migrateSchemas(form, aside)
    expect(form.schema.tracking.options.map((o: { value: string }) => o.value)).toEqual([
      'brochure',
      'news',
      'info',
      'openday',
      'project',
      'recruit',
      'partnership',
    ])
    expect(aside.schema.forms.component_whitelist).toEqual(['form', 'action'])
    expect(migrateSchemas(form, aside)).toEqual([])
  })
})
