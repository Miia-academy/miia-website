/**
 * Strumenti comuni alle prove nel browser: apertura delle pagine, controlli
 * grafici con screenshot nel report, moduli compilati senza scrivere in Brevo.
 */
import { expect, type Page, type TestInfo } from '@playwright/test'

/** Email usata nei moduli di prova: non arriva mai a Brevo (gli invii sono fermati). */
export const EMAIL_PROVA = 'prova+browser@miia.it'

/** Errori JavaScript della pagina, raccolti dall'apertura in poi. */
export function raccogliErrori(page: Page): string[] {
  const errori: string[] = []
  page.on('pageerror', (error) => errori.push(error.message))
  return errori
}

/**
 * Gli errori JavaScript nati mentre il robot compila un modulo (apertura e chiusura
 * degli elenchi, Tab) non fanno fallire la prova: finiscono nelle note del report,
 * da guardare. Gli errori delle pagine aperte dopo restano controllati.
 */
export function annotaErroriModulo(errori: string[], testInfo: TestInfo) {
  if (!errori.length) return
  const diversi = [...new Set(errori)]
  testInfo.annotations.push({
    type: 'Errori JavaScript durante la compilazione del modulo',
    description: diversi.join(' | '),
  })
  errori.length = 0
}

/** Apre una pagina del sito e aspetta che sia ferma. */
export async function apri(page: Page, path: string) {
  const risposta = await page.goto(path, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
  // Il banner dei cookie di Iubenda (caricato da GTM) copre i pulsanti in basso:
  // nelle prove lo nascondiamo senza dare né negare il consenso.
  await page.addStyleTag({ content: '#iubenda-cs-banner { display: none !important; }' }).catch(() => {})
  if (risposta?.status() === 401 || risposta?.status() === 403) {
    throw new Error(
      `L'anteprima è protetta (${risposta.status()}): serve VERCEL_AUTOMATION_BYPASS_SECRET nei segreti di GitHub.`
    )
  }
  return risposta
}

/** Scorre la pagina fino in fondo, così si caricano le immagini "pigre", poi torna su. */
async function scorriTutta(page: Page) {
  await page.evaluate(async () => {
    const passo = Math.max(300, Math.floor(window.innerHeight * 0.8))
    for (let y = 0; y < document.body.scrollHeight; y += passo) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
}

/**
 * Controlli grafici di una pagina, uguali su computer e telefono:
 * - niente contenuto che esce di lato (scorrimento orizzontale);
 * - nessuna immagine rotta;
 * - nessun errore JavaScript.
 * Mette nel report lo screenshot dell'intera pagina, anche quando va tutto bene.
 * I problemi non fermano la prova: vengono elencati tutti.
 */
export async function controlliGrafici(page: Page, testInfo: TestInfo, nome: string, errori: string[] = []) {
  await scorriTutta(page)

  const fuori = await page.evaluate(() => {
    const larghezza = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= larghezza + 1) return []
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.right > larghezza + 1 && getComputedStyle(el).position !== 'fixed'
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}`)
  })
  expect.soft(fuori, `${nome}: elementi che escono dallo schermo a destra`).toEqual([])

  const rotte = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0 && !!img.currentSrc)
      .map((img) => img.currentSrc)
      .slice(0, 5)
  )
  expect.soft(rotte, `${nome}: immagini che non si caricano`).toEqual([])
  expect.soft(errori, `${nome}: errori JavaScript nella pagina`).toEqual([])

  // JPEG per tenere leggero il report (le pagine intere in PNG pesano diversi MB)
  await testInfo.attach(`${nome} – pagina intera`, {
    body: await page.screenshot({ fullPage: true, type: 'jpeg', quality: 70 }),
    contentType: 'image/jpeg',
  })
}

/** Screenshot di quello che si vede ora (per i passaggi dei moduli). */
export async function scatta(page: Page, testInfo: TestInfo, nome: string) {
  await testInfo.attach(nome, { body: await page.screenshot(), contentType: 'image/png' })
}

/**
 * Ferma nel browser gli invii dei moduli a /api/crm: niente arriva a Brevo.
 * Restituisce l'elenco di quello che sarebbe partito, da controllare nella prova.
 */
export async function fermaInviiModuli(page: Page) {
  const inviati: any[] = []
  await page.route('**/api/crm', async (route) => {
    inviati.push(route.request().postDataJSON())
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"returning":false}' })
  })
  return inviati
}

/** Link della pagina che contiene il testo indicato (es. "corso-interior-design-primo-livello"). */
export async function trovaLink(page: Page, contiene: RegExp): Promise<string | null> {
  const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href') || ''))
  // Solo link interni: relativi, o verso miia.it / l'anteprima stessa
  const interno = (h: string) => h.startsWith('/') || /^https?:\/\/([^/]*\.)?(miia\.it|vercel\.app)\//.test(h)
  const trovato = hrefs.find((h) => interno(h) && contiene.test(h))
  if (!trovato) return null
  return trovato.startsWith('http') ? new URL(trovato).pathname : trovato
}

/**
 * Compila il modulo aperto (pannello laterale) con dati di prova:
 * email, nome, cognome, telefono, prima voce delle scelte obbligatorie,
 * casella della privacy. Poi preme "Invia".
 */
export async function compilaEInvia(page: Page, testInfo: TestInfo, nome: string, area?: RegExp) {
  const modulo = page.getByRole('dialog')
  await expect(modulo).toBeVisible()

  const testi: Array<[string, string]> = [
    ['#email', EMAIL_PROVA],
    ['#nome', 'Prova'],
    ['#cognome', 'Browser'],
    ['#sms', '3331234567'],
  ]
  for (const [selettore, valore] of testi) {
    const campo = modulo.locator(selettore)
    if (await campo.isVisible().catch(() => false)) await campo.fill(valore)
  }
  // Altri campi di testo obbligatori rimasti vuoti (città, messaggio…): un testo di prova.
  const altri = modulo.locator('input[required]:not([type=checkbox]):not([type=hidden]):not([type=file]), textarea[required]')
  for (let i = 0; i < (await altri.count()); i++) {
    const campo = altri.nth(i)
    if (!(await campo.isVisible().catch(() => false)) || (await campo.inputValue())) continue
    const tipo = await campo.getAttribute('type')
    await campo.fill(tipo === 'number' ? '1' : tipo === 'tel' ? '3331234567' : 'Prova automatica')
  }

  // Scelte (area, scopo, corso…): apre ciascun elenco vuoto e sceglie una voce.
  const elenchi = modulo.locator('button[aria-haspopup="listbox"]')
  // Si aspetta che l'elenco precedente sia chiuso, altrimenti si sceglie una voce di quello.
  const elencoAperto = page.getByRole('listbox')
  // Contati una volta sola: con un elenco aperto il resto del modulo è nascosto ai lettori di schermo.
  const quanti = await elenchi.count()
  for (let i = 0; i < quanti; i++) {
    await expect(elencoAperto).toHaveCount(0)
    await elenchi.nth(i).click()
    const voci = elencoAperto.getByRole('option')
    await expect(voci.first()).toBeVisible()
    // L'elenco si apre con un'animazione: a metà le voci si spostano e il clic va a vuoto.
    await page.waitForTimeout(400)
    const preferita = area ? voci.filter({ hasText: area }) : voci
    await ((await preferita.count()) ? preferita.first() : voci.first()).click()
    // Scelta multipla: l'elenco resta aperto e si chiude con Tab, che passa al campo
    // successivo tenendo la scelta (Esc invece la cancella). Provato su HeroUI Select.
    const chiuso = await elencoAperto.waitFor({ state: 'detached', timeout: 1_000 }).then(() => true, () => false)
    if (!chiuso) await page.keyboard.press('Tab')
  }
  await expect(elencoAperto).toHaveCount(0)

  // Caselle (privacy e scelte del modulo): tutte spuntate tranne quella dei cookie,
  // che deve restare facoltativa. Le caselle nascoste (antispam) non si toccano.
  const caselle = modulo.locator('label:has(input[type="checkbox"])')
  for (let i = 0; i < (await caselle.count()); i++) {
    const casella = caselle.nth(i)
    if (!(await casella.isVisible())) continue
    const input = casella.locator('input')
    const etichetta = `${await casella.innerText()} ${(await input.getAttribute('aria-label')) || ''}`
    if (/cookie/i.test(etichetta)) continue
    if (!(await input.isChecked())) await casella.click()
  }

  await scatta(page, testInfo, `${nome} – modulo compilato`)
  await modulo.getByRole('button', { name: 'Invia', exact: true }).click()
}

/**
 * Aspetta che il modulo parta. Se non parte, il messaggio d'errore della prova
 * riporta gli avvisi mostrati nel modulo (campo obbligatorio, privacy…).
 */
export async function aspettaInvio(page: Page, inviati: unknown[]) {
  const partito = await expect
    .poll(() => inviati.length, { timeout: 10_000 })
    .toBe(1)
    .then(() => true, () => false)
  if (partito) return
  const modulo = page.getByRole('dialog')
  const avvisi = await modulo
    .locator('[data-slot="error-message"], [role="alert"], .text-danger')
    .allTextContents()
    .catch(() => [] as string[])
  const testo = ((await modulo.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 600)
  throw new Error(
    `Il modulo non è partito. Avvisi nel modulo: ${avvisi.map((t) => String(t ?? '').trim()).filter(Boolean).join(' | ') || 'nessuno'}. ` +
      `Testo del modulo: ${testo}`
  )
}
