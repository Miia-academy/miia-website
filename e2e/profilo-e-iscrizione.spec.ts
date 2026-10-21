/**
 * Riquadro del profilo di interesse (?debug=profilo) e pagina dell'iscrizione online.
 */
import { expect, test } from '@playwright/test'
import { apri, controlliGrafici, raccogliErrori, scatta } from './aiuti'

test('Riquadro ?debug=profilo con il consenso simulato', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  await apri(page, '/?debug=profilo')
  await expect(page.getByText('Cosa sa il sito di questa persona')).toBeVisible()
  await page.getByRole('button', { name: 'Simula il consenso marketing' }).click()
  await expect(page.getByRole('button', { name: 'Smetti di simulare il consenso' })).toBeVisible()
  await scatta(page, testInfo, 'Profilo – consenso simulato')
  await controlliGrafici(page, testInfo, 'Home con riquadro profilo', errori)
})

test('Iscrizione online: pagina del corso', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  const risposta = await apri(page, '/iscrizione/corso-interior-design-primo-livello')
  if (risposta?.status() === 404) {
    // Interruttore ENROLLMENT_ONLINE spento: la pagina non deve esistere.
    testInfo.annotations.push({ type: 'Iscrizione online', description: 'spenta (pagina 404, come previsto)' })
    await scatta(page, testInfo, 'Iscrizione online spenta')
    return
  }
  testInfo.annotations.push({ type: 'Iscrizione online', description: 'accesa' })
  await expect(page.getByRole('heading', { name: 'Chi sei' })).toBeVisible()
  await controlliGrafici(page, testInfo, 'Iscrizione online, passo 1', errori)
})
