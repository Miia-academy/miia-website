// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Pagina /conferma (PR #70): le frasi dopo un clic nelle email dell'open day vengono
// dalla datasource Storyblok "Domande open day", con testi di riserva.
const get = vi.fn()
vi.mock('@storyblok/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@storyblok/react')>()),
  getStoryblokApi: () => ({ get }),
}))

import { getStaticProps } from '@pages/conferma'
import {
  acceptAllCookies,
  getConsentPurposes,
  hasConsent,
  IUBENDA_COOKIE_POLICY_ID,
  needsCookieConsent,
  PURPOSE,
} from '@modules/consent'

describe('/conferma: frasi delle domande open day', () => {
  beforeEach(() => {
    get.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('legge le frasi da Storyblok e tiene quelle di riserva per le voci mancanti', async () => {
    get.mockResolvedValue({
      data: {
        datasource_entries: [
          { name: 'sbocchi', value: 'Frase scritta in Storyblok.' },
          { name: 'vuota', value: '' },
        ],
      },
    })
    const result = (await getStaticProps({} as any)) as { props: { domande: Record<string, string> }; revalidate: number }
    expect(get).toHaveBeenCalledWith('cdn/datasource_entries', { datasource: 'domande-open-day', per_page: 100 })
    expect(result.props.domande.sbocchi).toBe('Frase scritta in Storyblok.')
    expect(result.props.domande.vuota).toBeUndefined()
    // Tutte le voci usate dalle email ci sono sempre
    for (const voce of ['sbocchi', 'programma', 'attestato', 'costi', 'orari', 'dubbi', 'approfondire', 'simone']) {
      expect(result.props.domande[voce]).toBeTruthy()
    }
    expect(result.revalidate).toBe(300)
  })

  it('se Storyblok non risponde la pagina usa le frasi di riserva e riprova dopo un minuto', async () => {
    get.mockRejectedValue(new Error('offline'))
    const result = (await getStaticProps({} as any)) as { props: { domande: Record<string, string> }; revalidate: number }
    expect(result.props.domande.simone).toBe('Simone ti chiamerà entro due giorni lavorativi.')
    expect(result.revalidate).toBe(60)
  })
})

// Casella dei cookie nei moduli (PR #59): compare solo se misurazione o marketing
// non sono già accettati, e la scelta passa a Iubenda come dal banner.
describe('consenso cookie (Iubenda)', () => {
  const COOKIE = `_iub_cs-${IUBENDA_COOKIE_POLICY_ID}`
  const setConsent = (value: unknown) => {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/`
  }

  afterEach(() => {
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/`
    delete (window as any)._iub
  })

  it('senza scelta: nessuna finalità e casella visibile', () => {
    expect(getConsentPurposes()).toEqual({})
    expect(needsCookieConsent()).toBe(true)
  })

  it('"Accetta tutto" del banner vale per tutte le finalità', () => {
    setConsent({ consent: true })
    expect(hasConsent(PURPOSE.marketing)).toBe(true)
    expect(needsCookieConsent()).toBe(false)
  })

  it('solo misurazione: la casella serve ancora per il marketing', () => {
    setConsent({ purposes: { '4': true, '5': false } })
    expect(hasConsent(PURPOSE.measurement)).toBe(true)
    expect(needsCookieConsent()).toBe(true)
  })

  it('un cookie rovinato conta come nessuna scelta', () => {
    document.cookie = `${COOKIE}=%7Bnon-json; Path=/`
    expect(getConsentPurposes()).toEqual({})
  })

  it('la casella spuntata registra il consenso in Iubenda, se è caricato', () => {
    expect(acceptAllCookies()).toBe(false)
    const acceptAll = vi.fn()
    ;(window as any)._iub = { cs: { api: { acceptAll } } }
    expect(acceptAllCookies()).toBe(true)
    expect(acceptAll).toHaveBeenCalledOnce()
  })
})
