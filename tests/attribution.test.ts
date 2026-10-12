// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { captureAttribution, getAttribution, refreshAttributionStorage } from '@modules/attribution'
import { IUBENDA_COOKIE_POLICY_ID } from '@modules/consent'

const CONSENT_COOKIE = `_iub_cs-${IUBENDA_COOKIE_POLICY_ID}`

function visit(path: string, referrer = '') {
  window.history.replaceState(null, '', path)
  Object.defineProperty(document, 'referrer', { value: referrer, configurable: true })
  captureAttribution()
}

function giveConsent(purposes: Record<string, boolean>) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ purposes }))}; Path=/`
}

function clearCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0]
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

const hasSourceCookie = () => document.cookie.includes('miia_src=')

beforeEach(() => {
  window.sessionStorage.clear()
  clearCookies()
})

afterEach(() => {
  clearCookies()
})

describe('provenienza della visita', () => {
  it('salva gli UTM della pagina di arrivo e li tiene dopo un cambio pagina', () => {
    visit('/corsi/interior?utm_source=google&utm_medium=cpc&utm_campaign=openday')
    visit('/contatti')

    const { first, last } = getAttribution()
    expect(first).toMatchObject({
      source: 'google',
      medium: 'cpc',
      campaign: 'openday',
      landing: '/corsi/interior',
    })
    expect(last).toMatchObject({ campaign: 'openday' })
  })

  it('gclid senza UTM: google / cpc', () => {
    visit('/?gclid=abc123')
    expect(getAttribution().first).toMatchObject({
      source: 'google',
      medium: 'cpc',
      click_id: 'gclid:abc123',
    })
  })

  it('fbclid senza UTM: meta / paid_social', () => {
    visit('/?fbclid=xyz')
    expect(getAttribution().first).toMatchObject({ source: 'meta', medium: 'paid_social' })
  })

  it('arrivo da un motore di ricerca: organic, senza indirizzo completo', () => {
    visit('/', 'https://www.google.com/search?q=corso+interior')
    const { first } = getAttribution()
    expect(first).toMatchObject({ source: 'google.com', medium: 'organic' })
    expect(JSON.stringify(first)).not.toContain('corso+interior')
  })

  it('arrivo da un social: social', () => {
    visit('/', 'https://www.instagram.com/')
    expect(getAttribution().first).toMatchObject({ source: 'instagram.com', medium: 'social' })
  })

  it('arrivo da un altro sito: referral', () => {
    visit('/', 'https://www.portale-corsi.it/articolo')
    expect(getAttribution().first).toMatchObject({ source: 'portale-corsi.it', medium: 'referral' })
  })

  it('senza referrer né UTM: (direct) / (none)', () => {
    visit('/')
    expect(getAttribution().first).toMatchObject({ source: '(direct)', medium: '(none)' })
  })

  it('una nuova campagna aggiorna ULTIMA ma non la prima provenienza', () => {
    visit('/?utm_source=google&utm_campaign=primo')
    visit('/openday?utm_source=newsletter&utm_campaign=reminder')
    const { first, last } = getAttribution()
    expect(first?.campaign).toBe('primo')
    expect(last?.campaign).toBe('reminder')
  })
})

describe('cookie da 90 giorni e consenso', () => {
  it('senza consenso alla misurazione non scrive il cookie', () => {
    visit('/?utm_source=google&utm_campaign=openday')
    expect(hasSourceCookie()).toBe(false)
    expect(getAttribution().first?.campaign).toBe('openday')
  })

  it('con il consenso alla misurazione (finalità 4) scrive il cookie', () => {
    giveConsent({ '4': true })
    visit('/?utm_source=google&utm_campaign=openday')
    expect(hasSourceCookie()).toBe(true)
  })

  it('consenso dato durante la visita: copia la sessione nel cookie', () => {
    visit('/?utm_source=google&utm_campaign=openday')
    giveConsent({ '4': true })
    refreshAttributionStorage()
    expect(hasSourceCookie()).toBe(true)
  })

  it('consenso revocato: il cookie viene cancellato', () => {
    giveConsent({ '4': true })
    visit('/?utm_source=google&utm_campaign=openday')
    giveConsent({ '4': false })
    refreshAttributionStorage()
    expect(hasSourceCookie()).toBe(false)
  })

  it('chi torna più tardi ritrova la prima provenienza dal cookie', () => {
    giveConsent({ '4': true })
    visit('/?utm_source=google&utm_campaign=openday')
    window.sessionStorage.clear() // nuova visita
    visit('/', '')
    const { first } = getAttribution()
    expect(first?.campaign).toBe('openday')
  })
})
