import { useEffect, useState } from 'react'
import { hasConsent, PURPOSE } from '@modules/consent'
import { riassumi } from '@modules/profilo'
import {
  cancellaProfilo,
  chiudiDebugProfilo,
  consensoSimulato,
  inAnteprima,
  leggiDettaglio,
  leggiProfilo,
  simulaConsenso,
  tracciaPagina,
} from '@modules/tracking'

/**
 * Riquadro di controllo del profilo, visibile aggiungendo ?debug=profilo
 * all'indirizzo. Mostra solo i dati di questo browser, a chi li sta guardando.
 */
export default function DebugProfilo() {
  const [, setTick] = useState(0)
  const [chiuso, setChiuso] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 2000)
    return () => window.clearInterval(timer)
  }, [])

  if (chiuso) return null

  const marketing = hasConsent(PURPOSE.marketing)
  const simulato = consensoSimulato()
  const dettaglio = leggiDettaglio()
  const calcolato = dettaglio ? riassumi(dettaglio) : null
  const cookie = leggiProfilo()
  const pagine = dettaglio ? Object.entries(dettaglio.pagine).reverse() : []

  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-h-[70vh] w-[min(420px,calc(100vw-32px))] overflow-auto rounded-lg border border-default-300 bg-white p-4 font-mono text-xs text-foreground shadow-xl">
      <div className="mb-2 flex items-center justify-between font-sans text-sm font-semibold">
        Profilo di questo browser
        <button type="button" className="px-2" onClick={() => {
            chiudiDebugProfilo()
            setChiuso(true)
          }} aria-label="Chiudi">
          ✕
        </button>
      </div>
      <p>
        Consenso marketing:{' '}
        {marketing ? 'sì' : simulato ? 'simulato (solo anteprima)' : 'no (non si salva nulla)'}
      </p>
      {inAnteprima() && !marketing && (
        <button
          type="button"
          className="mt-1 rounded border border-default-300 px-2 py-1 font-sans"
          onClick={() => {
            simulaConsenso(!simulato)
            if (!simulato) tracciaPagina()
            setTick((t) => t + 1)
          }}
        >
          {simulato ? 'Smetti di simulare il consenso' : 'Simula il consenso marketing'}
        </button>
      )}
      <p className="mt-2 font-semibold">Calcolato ora nel browser</p>
      <pre className="whitespace-pre-wrap">{calcolato ? JSON.stringify(calcolato, null, 1) : 'nessun dato'}</pre>
      <p className="mt-2 font-semibold">Cookie miia_profilo (usato dai banner)</p>
      <pre className="whitespace-pre-wrap">
        {cookie ? JSON.stringify(cookie, null, 1) : 'non ancora scritto: arriva quando cambi scheda o chiudi la pagina'}
      </pre>
      {pagine.length > 0 && (
        <>
          <p className="mt-2 font-semibold">Pagine (viste / lette)</p>
          <ul>
            {pagine.map(([path, p]) => (
              <li key={path}>
                {path} · {p.viste} / {p.lette}
              </li>
            ))}
          </ul>
        </>
      )}
      <button
        type="button"
        className="mt-3 rounded border border-default-300 px-2 py-1 font-sans"
        onClick={() => {
          cancellaProfilo()
          setTick((t) => t + 1)
        }}
      >
        Cancella il mio profilo
      </button>
    </div>
  )
}
