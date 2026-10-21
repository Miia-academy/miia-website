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

  // Scelte (area, scopo, corso…): apre ciascun elenco vuoto e sceglie una voce.
  const elenchi = modulo.locator('button[aria-haspopup="listbox"]')
  for (let i = 0; i < (await elenchi.count()); i++) {
    await elenchi.nth(i).click()
    const voci = page.getByRole('option')
    await expect(voci.first()).toBeVisible()
    const preferita = area ? voci.filter({ hasText: area }) : voci
    await ((await preferita.count()) ? preferita.first() : voci.first()).click()
    await page.keyboard.press('Escape').catch(() => {})
  }

  // Caselle obbligatorie (privacy e simili). La casella dei cookie resta vuota.
  const obbligatorie = modulo.locator('label:has(input[type="checkbox"][required])')
  for (let i = 0; i < (await obbligatorie.count()); i++) {
    const casella = obbligatorie.nth(i).locator('input')
    if (!(await casella.isChecked())) await obbligatorie.nth(i).click()
  }

  await scatta(page, testInfo, `${nome} – modulo compilato`)
  await modulo.getByRole('button', { name: 'Invia', exact: true }).click()
}
