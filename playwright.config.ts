/**
 * Prove nel browser (Playwright) su un sito già pubblicato, di solito l'anteprima
 * Vercel di develop. Ogni prova gira due volte: computer e telefono.
 *
 * Indirizzo da provare: variabile BASE_URL (es. https://…vercel.app).
 * Se le anteprime Vercel sono protette, VERCEL_AUTOMATION_BYPASS_SECRET apre l'accesso.
 *
 * Le prove non scrivono mai in Brevo: gli invii dei moduli vengono fermati nel
 * browser e si controlla solo cosa sarebbe partito (vedi e2e/aiuti.ts).
 */
import { defineConfig, devices } from '@playwright/test'

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  outputDir: './e2e-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ['json', { outputFile: 'e2e-report/risultati.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    extraHTTPHeaders: bypass
      ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' }
      : undefined,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'computer',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'telefono',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
