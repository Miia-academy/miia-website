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
  // I posti rimasti arrivano dopo il caricamento: si aspetta qualche secondo il pulsante.
  const iscrivitiOnline = page.getByRole('link', { name: /^Iscriviti online/ })
  const visto = await iscrivitiOnline.first().waitFor({ timeout: 8_000 }).then(() => true, () => false)
  testInfo.annotations.push({
    type: 'Pulsante "Iscriviti online"',
    description: visto
      ? `presente (${corso})`
      : `non presente in ${corso}: iscrizione online spenta o nessuna edizione con posti`,
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

test('Risposta a un dubbio cliccato in un’email, dopo l’open day', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/risposta?tipo=domanda&d=pagamenti&fase=post-openday&corso=corso-interior-design-primo-livello')
  await expect(page.getByText('Ecco la risposta alla tua domanda.')).toBeVisible()
  // La risposta viene da Storyblok › Datasources › "Domande open day", voce "pagamenti"
  await expect(page.locator('p').filter({ hasText: /rate/i }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /telefonata di 15 minuti/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Iscriviti online' })).toHaveAttribute('href', '/iscrizione/corso-interior-design-primo-livello')
  await controlliGrafici(page, testInfo, 'Risposta dopo open day', errori)
})

test('I vecchi link di /conferma aprono la pagina delle risposte', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/conferma?type=richiesta&d=simone')
  await expect(page).toHaveURL(/\/risposta\?tipo=richiesta&d=simone/)
  await expect(page.getByText('Grazie, ci pensiamo noi.')).toBeVisible()
  await controlliGrafici(page, testInfo, 'Risposta richiesta', errori)
})

test('Entra nell’open day con un codice sconosciuto', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/open-day/accedi/non-trovato')
  await expect(page.getByRole('heading', { name: 'Open day non trovato' })).toBeVisible()
  await controlliGrafici(page, testInfo, 'Accedi, codice sconosciuto', errori)
})
