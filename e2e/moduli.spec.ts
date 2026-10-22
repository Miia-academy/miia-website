/**
 * Moduli del sito: si compilano come farebbe una persona, ma l'invio viene
 * fermato nel browser. Si controlla cosa sarebbe partito verso Brevo.
 */
import { expect, test, type Page } from '@playwright/test'
import {
  apri,
  annotaErroriModulo,
  aspettaInvio,
  compilaEInvia,
  controlliGrafici,
  EMAIL_PROVA,
  fermaInviiModuli,
  raccogliErrori,
  scatta,
  trovaLink,
} from './aiuti'

/** Apre il primo modulo della pagina il cui pulsante corrisponde al testo. */
async function apriModulo(page: Page, testo: RegExp) {
  const pulsanti = page.locator('button').filter({ hasText: testo })
  for (let i = 0; i < (await pulsanti.count()); i++) {
    const pulsante = pulsanti.nth(i)
    if (!(await pulsante.isVisible())) continue
    await pulsante.click()
    if (await page.getByRole('dialog').isVisible({ timeout: 3_000 }).catch(() => false)) return true
  }
  return false
}

test('Modulo di una pagina corso: provenienza della visita e casella cookie', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  const inviati = await fermaInviiModuli(page)

  // Arrivo da una campagna: gli UTM devono arrivare fino al modulo, anche dopo un cambio pagina.
  await apri(page, '/?utm_source=prova&utm_medium=browser&utm_campaign=prove-automatiche')
  const corso =
    (await trovaLink(page, /corso-interior-design-primo-livello/)) || (await trovaLink(page, /\/corsi\/.+/))
  test.skip(!corso, 'Nessun link a una pagina corso nella home')
  await apri(page, corso!)

  const aperto = await apriModulo(page, /informazion|presentazion|scarica|programma|richied/i)
  test.skip(!aperto, 'Nessun modulo di informazioni o presentazione nella pagina corso')

  // Sull'anteprima Iubenda non ricorda il consenso: la casella facoltativa deve comparire.
  await expect(page.getByRole('dialog').getByText('Accetto anche i cookie facoltativi')).toBeVisible()

  await compilaEInvia(page, testInfo, 'Modulo pagina corso')
  await aspettaInvio(page, inviati)
  annotaErroriModulo(errori, testInfo)
  const invio = inviati[0]
  expect(invio.contact.email).toBe(EMAIL_PROVA)
  expect(invio.source.first).toMatchObject({ source: 'prova', medium: 'browser', campaign: 'prove-automatiche' })
  expect(invio.event.event_name).toMatch(/^submit_[a-z]+_form$/)
  testInfo.annotations.push({ type: 'Evento Brevo', description: invio.event.event_name })

  await scatta(page, testInfo, 'Modulo pagina corso – dopo l’invio')
  await controlliGrafici(page, testInfo, 'Pagina corso dopo il modulo', errori)
})

test('Modulo open day: codice per la pagina "Entra" e pagina accedi', async ({ page }, testInfo) => {
  const errori = raccogliErrori(page)
  const inviati = await fermaInviiModuli(page)

  await apri(page, '/')
  const openday = await trovaLink(page, /open-?day(?!\/accedi)/i)
  test.skip(!openday, 'Nessun link a una pagina open day nella home')
  await apri(page, openday!)

  const aperto = await apriModulo(page, /iscri|partecip|prenot|open day|posto/i)
  test.skip(!aperto, 'Nessun modulo di iscrizione nella pagina open day')
  await compilaEInvia(page, testInfo, 'Modulo open day', /interni|interior/i)

  await aspettaInvio(page, inviati)
  annotaErroriModulo(errori, testInfo)
  const invio = inviati[0]
  expect(invio.event.event_name).toBe('submit_openday_form')
  const codice = invio.event.event_properties.openday_codice
  expect(codice, 'codice dell’open day (slug della storia evento)').toMatch(/^openday-/)
  expect(invio.contact.attributes.OD_CODICE).toBe(codice)
  testInfo.annotations.push(
    { type: 'Open day scelto', description: `${codice} – ${invio.event.event_properties.openday_data || ''}` },
    { type: 'Docenti', description: invio.event.event_properties.openday_docenti || '(nessuno nel campo Docenti)' }
  )
  await scatta(page, testInfo, 'Modulo open day – dopo l’invio')

  // La pagina "Entra nell'open day" di quel codice: data visibile, link della call mai nella pagina.
  await apri(page, `/open-day/accedi/${codice}?email=${encodeURIComponent(EMAIL_PROVA)}`)
  await expect(page.getByRole('button', { name: "Entra nell'open day" })).toBeVisible()
  expect(await page.content()).not.toContain('meet.google.com')
  await controlliGrafici(page, testInfo, 'Entra nell’open day', errori)
})
