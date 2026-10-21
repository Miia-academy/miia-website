import { useEffect, useState } from 'react'
import { MODULI, TRACKING } from '@config/tracking'
import { hasConsent, PURPOSE } from '@modules/consent'
import { pulisciRiassunto, riassumi, type Riassunto } from '@modules/profilo'
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
import { leggiRapportoBanner } from '@components/banners/bannerSito'
import { azzeraMemoria, bannerForzato, forzaBanner } from '@modules/bannerMemoria'

const NOMI_MODULI: Record<string, string> = Object.fromEntries(
  Object.values(MODULI).map(({ codice, etichetta }) => [codice, etichetta])
)

const data = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : '–')
const maiuscola = (testo?: string) => (testo ? testo[0].toUpperCase() + testo.slice(1) : '–')

function moduliInviati(m: string): string {
  if (!m) return 'nessuno'
  return m
    .split(',')
    .map((voce) => {
      const [codice, giorno] = voce.split(':')
      return `${NOMI_MODULI[codice] || 'Altro modulo'} (${data(giorno)})`
    })
    .join(', ')
}

/** Le voci del riassunto, con nomi leggibili. */
function voci(r: Riassunto): Array<[string, string]> {
  return [
    ['È un contatto', r.c ? 'sì, ha inviato almeno un modulo' : 'no'],
    ['Moduli inviati', moduliInviati(r.m)],
    ['Open day a cui è iscritto', data(r.od)],
    ['Punteggio di interesse', String(r.p)],
    ['Fascia', `${maiuscola(r.fx)} (tiepido da ${TRACKING.fasce.tiepido}, caldo da ${TRACKING.fasce.caldo} punti)`],
    ['Area che interessa di più', maiuscola(r.a)],
    ['Temi preferiti', r.t ? r.t.split(',').join(', ') : 'arrivano con i blocchi Testo'],
    ['Visite al sito', String(r.v)],
    ['Ultima visita', data(r.u)],
  ]
}

function Voci({ r }: { r: Riassunto }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {voci(r).map(([nome, valore]) => (
        <div key={nome} className="contents">
          <dt className="text-default-500">{nome}</dt>
          <dd className="font-medium">{valore}</dd>
        </div>
      ))}
    </dl>
  )
}

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
  // Stesso controllo del server, così l'ordine delle voci è identico.
  const cookieAggiornato = !!cookie && !!calcolato && JSON.stringify(cookie) === JSON.stringify(pulisciRiassunto(calcolato))
  const pagine = dettaglio ? Object.entries(dettaglio.pagine).reverse() : []

  return (
    <div className="fixed bottom-4 left-4 z-[9999] max-h-[70vh] w-[min(440px,calc(100vw-32px))] overflow-auto rounded-lg border border-default-300 bg-white p-4 font-sans text-xs text-foreground shadow-xl">
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        Profilo di questo browser
        <button
          type="button"
          className="px-2"
          onClick={() => {
            chiudiDebugProfilo()
            setChiuso(true)
          }}
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>
      <p>
        Consenso marketing:{' '}
        <strong>{marketing ? 'sì' : simulato ? 'simulato (solo anteprima)' : 'no, non si salva nulla'}</strong>
      </p>
      {inAnteprima() && !marketing && (
        <button
          type="button"
          className="mt-1 rounded border border-default-300 px-2 py-1"
          onClick={() => {
            simulaConsenso(!simulato)
            if (!simulato) tracciaPagina()
            setTick((t) => t + 1)
          }}
        >
          {simulato ? 'Smetti di simulare il consenso' : 'Simula il consenso marketing'}
        </button>
      )}

      <p className="mt-3 font-semibold">Cosa sa il sito di questa persona</p>
      {calcolato ? <Voci r={calcolato} /> : <p>Nessun dato ancora.</p>}

      <p className="mt-3 font-semibold">Cookie letto dai banner</p>
      <p>
        {!cookie
          ? 'Non ancora scritto: arriva quando cambi scheda o chiudi la pagina.'
          : cookieAggiornato
            ? 'Aggiornato, uguale ai dati qui sopra.'
            : 'Da aggiornare: si allinea quando cambi scheda o chiudi la pagina.'}
      </p>

      {pagine.length > 0 && (
        <>
          <p className="mt-3 font-semibold">Pagine visitate (dalla più recente)</p>
          <table className="w-full">
            <thead>
              <tr className="text-left text-default-500">
                <th className="font-normal">Pagina</th>
                <th className="w-12 text-right font-normal">Viste</th>
                <th className="w-12 text-right font-normal">Lette</th>
              </tr>
            </thead>
            <tbody>
              {pagine.map(([path, p]) => (
                <tr key={path}>
                  <td className="break-all pr-2">{path}</td>
                  <td className="text-right">{p.viste}</td>
                  <td className="text-right">{p.lette}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-default-500">
            Una pagina è letta se resta sullo schermo almeno {TRACKING.sogliaLetturaPaginaSecondi} secondi.
          </p>
        </>
      )}

      <BannerDebug aggiorna={() => setTick((t) => t + 1)} />

      <button
        type="button"
        className="mt-3 rounded border border-default-300 px-2 py-1"
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


/** Banner di questa pagina, in ordine di priorità, con il motivo per cui non compaiono. */
function BannerDebug({ aggiorna }: { aggiorna: () => void }) {
  const rapporto = leggiRapportoBanner()
  const forzato = bannerForzato()
  const anteprima = inAnteprima()
  return (
    <>
      <p className="mt-3 font-semibold">Banner su questa pagina</p>
      {rapporto.length === 0 ? (
        <p>Nessun banner letto: interruttore spento o lista non pubblicata.</p>
      ) : (
        <ol className="list-decimal pl-5">
          {rapporto.map((r) => (
            <li key={r.uuid} className={r.motivo ? 'text-default-500' : 'font-semibold text-primary'}>
              {r.nome}: {r.motivo || 'compare'}
              {anteprima && (
                <button type="button" className="ml-1 underline" onClick={() => forzaBanner(r.uuid)}>
                  mostra
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-1 flex flex-wrap gap-2">
        {forzato && (
          <button type="button" className="rounded border border-default-300 px-2 py-1" onClick={() => forzaBanner(null)}>
            Torna alle regole normali
          </button>
        )}
        <button
          type="button"
          className="rounded border border-default-300 px-2 py-1"
          onClick={() => {
            azzeraMemoria()
            aggiorna()
          }}
        >
          Dimentica banner chiusi e visti
        </button>
      </div>
    </>
  )
}
