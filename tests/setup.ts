import { vi } from 'vitest'

// I test non devono mai parlare con servizi veri (Brevo, Storyblok, ecc.).
// Se un test dimentica di simulare una chiamata, fallisce invece di inviare dati.
vi.stubGlobal('fetch', async (input: unknown) => {
  throw new Error(`Chiamata di rete non simulata nei test: ${String(input)}`)
})

// Gli interruttori del sito partono sempre spenti, come in locale: su Vercel la
// build di develop esegue i test con le variabili del progetto (per esempio
// CRM_SOURCE_ATTRIBUTES=on) e i test che verificano il valore predefinito
// fallirebbero. I test che li vogliono accesi usano vi.stubEnv.
for (const name of ['CRM_SOURCE_ATTRIBUTES', 'CRM_ALLOWED_LISTS', 'ENROLLMENT_ONLINE']) {
  delete process.env[name]
}
