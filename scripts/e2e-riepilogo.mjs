/**
 * Riepilogo in italiano delle prove nel browser, dal file JSON di Playwright.
 * Scrive una tabella (prova × computer/telefono) nel riepilogo dell'esecuzione
 * su GitHub e in e2e-report/riepilogo.md.
 *
 * Uso: node scripts/e2e-riepilogo.mjs [indirizzo provato]
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

const FILE = 'e2e-report/risultati.json'
const ESITO = { expected: '✅ ok', unexpected: '❌ problema', flaky: '⚠️ ok al secondo tentativo', skipped: '⏭️ saltata' }

const righe = []
const scrivi = (testo = '') => righe.push(testo)
const indirizzo = process.argv[2] || process.env.BASE_URL || ''

scrivi('## Prove nel browser')
scrivi()
if (indirizzo) scrivi(`Sito provato: ${indirizzo}`)
scrivi()

if (!existsSync(FILE)) {
  scrivi('❌ Le prove non sono partite: nessun risultato. Guarda il registro del passo "Prove".')
} else {
  const dati = JSON.parse(readFileSync(FILE, 'utf8'))
  const prove = new Map()

  const visita = (suite) => {
    for (const spec of suite.specs || []) {
      const voce = prove.get(spec.title) || { file: spec.file, esiti: {}, note: new Map(), errori: [] }
      for (const t of spec.tests || []) {
        voce.esiti[t.projectName] = t.status
        const annotazioni = [...(t.annotations || []), ...(t.results || []).flatMap((r) => r.annotations || [])]
        for (const a of annotazioni) voce.note.set(a.type, a.description || '')
        if (t.status === 'unexpected') {
          const ultimo = (t.results || []).at(-1)
          for (const e of ultimo?.errors || []) {
            const messaggio = String(e.message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0]
            voce.errori.push(`${t.projectName}: ${messaggio.slice(0, 200)}`)
          }
        }
      }
      prove.set(spec.title, voce)
    }
    for (const figlia of suite.suites || []) visita(figlia)
  }
  for (const suite of dati.suites || []) visita(suite)

  const tutti = [...prove.values()].flatMap((v) => Object.values(v.esiti))
  const conta = (s) => tutti.filter((x) => x === s).length
  scrivi(
    `**${conta('expected')} ok**, ${conta('unexpected')} con problemi, ${conta('flaky')} ok al secondo tentativo, ${conta('skipped')} saltate.`
  )
  scrivi()
  scrivi('| Prova | Computer | Telefono | Note |')
  scrivi('| :-- | :-- | :-- | :-- |')
  for (const [titolo, v] of prove) {
    const note = [...v.note].map(([k, d]) => `${k}: ${d}`).join('; ')
    scrivi(`| ${titolo} | ${ESITO[v.esiti.computer] || '–'} | ${ESITO[v.esiti.telefono] || '–'} | ${note.replace(/\|/g, '/')} |`)
  }

  const problemi = [...prove].filter(([, v]) => v.errori.length)
  if (problemi.length) {
    scrivi()
    scrivi('### Problemi trovati')
    for (const [titolo, v] of problemi) {
      scrivi(`- **${titolo}**`)
      for (const e of v.errori) scrivi(`  - ${e}`)
    }
  }
}

scrivi()
scrivi('Non ancora nel sito, quindi non provati: banner (passo 6 del tracciamento).')
scrivi(
  'Screenshot di ogni pagina, su computer e telefono: scarica "report-prove-browser" in fondo a questa pagina, apri la cartella e poi il file index.html.'
)

const testo = righe.join('\n') + '\n'
writeFileSync('e2e-report/riepilogo.md', testo)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, testo)
console.log(testo)
