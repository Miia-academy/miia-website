/**
 * Pagine principali: si aprono, non escono dallo schermo, niente immagini rotte
 * né errori, screenshot nel report. Su computer e su telefono.
 */
import { expect, test } from '@playwright/test'
import { apri, controlliGrafici, raccogliErrori, trovaLink } from './aiuti'

test('Home', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  const risposta = await apri(page, '/')
  expect(risposta?.status()).toBeLessThan(400)
  await expect(page.locator('main, body').first()).toBeVisible()
  await controlliGrafici(page, testInfo, 'Home', errori)
})

test('Pagina corso (interior design primo livello)', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/')
  const corso =
    (await trovaLink(page, /corso-interior-design-primo-livello/)) || (await trovaLink(page, /\/corsi\/.+/))
  test.skip(!corso, 'Nessun link a una pagina corso nella home')
  await apri(page, corso!)
  await controlliGrafici(page, testInfo, 'Pagina corso', errori)

  // Con l'iscrizione online accesa il pulsante "Iscriviti online" sostituisce il modulo
  // di richiesta iscrizione (PR #74); spenta, resta il modulo.
  const iscrivitiOnline = page.getByRole('link', { name: /^Iscriviti online/ })
  testInfo.annotations.push({
    type: 'Iscrizione online',
    description: (await iscrivitiOnline.count()) ? 'accesa: pulsante "Iscriviti online" presente' : 'spenta: resta il modulo di sempre',
  })
})

test('Pagina open day', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/')
  const openday = await trovaLink(page, /open-?day(?!\/accedi)/i)
  test.skip(!openday, 'Nessun link a una pagina open day nella home')
  await apri(page, openday!)
  await controlliGrafici(page, testInfo, 'Pagina open day', errori)
})

test('Ringraziamento dopo la domanda nell’email "Cosa vedrai"', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/conferma?type=domanda&d=costi')
  await expect(page.getByText("all'open day partiamo dalla tua domanda")).toBeVisible()
  // La frase viene da Storyblok › Datasources › "Domande open day", voce "costi"
  await expect(page.locator('p').filter({ hasText: /cost/i }).first()).toBeVisible()
  await controlliGrafici(page, testInfo, 'Conferma domanda', errori)
})

test('Ringraziamento dopo la richiesta del giorno dopo', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/conferma?type=richiesta&d=simone')
  await expect(page.getByText('ci pensiamo noi.')).toBeVisible()
  await expect(page.getByText(/Simone/)).toBeVisible()
  await controlliGrafici(page, testInfo, 'Conferma richiesta', errori)
})

test('Entra nell’open day con un codice sconosciuto', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/open-day/accedi/non-trovato')
  await expect(page.getByRole('heading', { name: 'Open day non trovato' })).toBeVisible()
  await controlliGrafici(page, testInfo, 'Accedi, codice sconosciuto', errori)
})
