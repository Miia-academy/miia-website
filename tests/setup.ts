import { vi } from 'vitest'

// I test non devono mai parlare con servizi veri (Brevo, Storyblok, ecc.).
// Se un test dimentica di simulare una chiamata, fallisce invece di inviare dati.
vi.stubGlobal('fetch', async (input: unknown) => {
  throw new Error(`Chiamata di rete non simulata nei test: ${String(input)}`)
})
