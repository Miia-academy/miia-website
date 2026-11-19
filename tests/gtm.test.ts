import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGtmId } from '@config/gtm'

// Tag Manager only on miia.it: previews and local development must not send data.
describe('getGtmId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns the container id in production', () => {
    vi.stubEnv('GTM_ENABLED', 'on')
    vi.stubEnv('NEXT_PUBLIC_GTM', 'GTM-TEST')
    expect(getGtmId()).toBe('GTM-TEST')
  })

  it('returns nothing on previews and in development', () => {
    vi.stubEnv('GTM_ENABLED', 'off')
    vi.stubEnv('NEXT_PUBLIC_GTM', 'GTM-TEST')
    expect(getGtmId()).toBeUndefined()
  })

  it('returns nothing without a container id', () => {
    vi.stubEnv('GTM_ENABLED', 'on')
    vi.stubEnv('NEXT_PUBLIC_GTM', '')
    expect(getGtmId()).toBeUndefined()
  })
})
