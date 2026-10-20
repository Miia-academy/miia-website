// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IUBENDA_COOKIE_POLICY_ID } from '@modules/consent'
import { inviaRiassunto, leggiDettaglio, tracciaModulo, tracciaPagina } from '@modules/tracking'

const CONSENT_COOKIE = `_iub_cs-${IUBENDA_COOKIE_POLICY_ID}`

function giveConsent(purposes: Record<string, boolean>) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify({ purposes }))}; Path=/`
}

function clearCookies() {
  for (const entry of document.cookie.split('; ')) {
    const name = entry.split('=')[0]
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}

const beacon = vi.fn(() => true)

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  clearCookies()
  beacon.mockClear()
  Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  clearCookies()
})

describe('tracciamento nel browser', () => {
  it('senza consenso marketing non salva nulla', () => {
    tracciaPagina('/corsi/interior-design')
    expect(leggiDettaglio()).toBeNull()
    giveConsent({ '4': true, '5': false })
    tracciaPagina('/corsi/interior-design')
    expect(leggiDettaglio()).toBeNull()
  })

  it('se il marketing viene rifiutato cancella il profilo salvato', () => {
    giveConsent({ '5': true })
    tracciaPagina('/corsi/interior-design')
    expect(leggiDettaglio()).not.toBeNull()
    giveConsent({ '5': false })
    tracciaPagina('/')
    expect(leggiDettaglio()).toBeNull()
  })

  it('segna la pagina come letta dopo 40 secondi visibile', () => {
    giveConsent({ '5': true })
    tracciaPagina('/corsi/interior-design')
    vi.advanceTimersByTime(39_000)
    expect(leggiDettaglio()?.pagine['/corsi/interior-design'].lette).toBe(0)
    vi.advanceTimersByTime(3_000)
    expect(leggiDettaglio()?.pagine['/corsi/interior-design'].lette).toBe(1)
  })

  it('manda il riassunto solo se è cambiato', () => {
    giveConsent({ '5': true })
    tracciaPagina('/corsi/interior-design')
    inviaRiassunto()
    inviaRiassunto()
    expect(beacon).toHaveBeenCalledTimes(1)
    tracciaPagina('/corsi/fashion-design')
    inviaRiassunto()
    expect(beacon).toHaveBeenCalledTimes(2)
  })

  it("dopo un modulo invia subito il riassunto con l'open day", () => {
    giveConsent({ '5': true })
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    tracciaModulo('open_day', '2026-11-16T19:00:00.000Z')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({ c: 1, od: '2026-11-16' })
  })
})
