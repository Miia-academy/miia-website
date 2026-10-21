import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { Button } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BANNER } from '@config/tracking'
import { useDataContext } from '@modules/context'
import { getDocentiNames, joinNames } from '@modules/events'
import { editionKey, useSignedCounts } from '@components/enrollment/use-seats'
import { editionAvailability } from '@modules/enrollment/editions'
import {
  calendarioDa,
  linkBanner,
  personaDaDettaglio,
  personaDaRiassunto,
  prossimoOpenDay,
  rapportoBanner,
  riempi,
  scegliBanner,
  variabili,
  type BannerStory,
  type Calendario,
  type Contesto,
  type ModoBanner,
} from '@modules/banner'
import { hasConsent, PURPOSE } from '@modules/consent'
import { consensoSimulato, inAnteprima, leggiDettaglio, leggiProfilo } from '@modules/tracking'
import {
  bannerForzato,
  EVENTO_FORZA,
  leggiMemoria,
  segnaChiuso,
  segnaUsato,
  segnaVisto,
} from '@modules/bannerMemoria'
import BannerForm from './bannerForm'

/** Ultima valutazione dei banner, letta dal riquadro ?debug=profilo. */
let ultimoRapporto: ReturnType<typeof rapportoBanner> = []
export const leggiRapportoBanner = () => ultimoRapporto

interface Scelta {
  story: BannerStory
  modo: ModoBanner
  titolo: string
  testo: string
  dataOpenDay?: string
}

const colori = {
  chiaro: 'bg-white text-neutral-900',
  scuro: 'bg-neutral-900 text-white',
  verde: 'bg-primary text-white',
}

function useTelefono(): boolean {
  const [telefono, setTelefono] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BANNER.larghezzaTelefono - 1}px)`)
    const aggiorna = () => setTelefono(mq.matches)
    aggiorna()
    mq.addEventListener('change', aggiorna)
    return () => mq.removeEventListener('change', aggiorna)
  }, [])
  return telefono
}

/** Il calendario del sito: open day con i docenti e prossime edizioni con i posti rimasti. */
function useCalendario(): Calendario {
  const { events, courses } = useDataContext()
  const oggi = new Date().toISOString().slice(0, 10)
  const future = useMemo(() => courses.filter((c) => c.starts && c.starts.slice(0, 10) >= oggi), [courses, oggi])
  const chiavi = useMemo(() => future.map((c) => editionKey(c.uuid, c.starts)), [future])
  const iscritti = useSignedCounts(chiavi)
  return useMemo(() => {
    const corsi = future.map((c, i) => {
      const capienza = Number(String(c.seats ?? '').trim())
      if (!c.seats || !Number.isFinite(capienza)) return { ...c, posti: undefined }
      const firmati = iscritti?.[chiavi[i] || ''] ?? 0
      return { ...c, posti: editionAvailability(capienza, firmati).posti_liberi ?? undefined }
    })
    const eventi = events.map((e) => ({ ...e, docentiNomi: joinNames(getDocentiNames(e)) }))
    return calendarioDa(eventi, corsi)
  }, [events, future, iscritti, chiavi])
}

function contesto(path: string, calendario: Calendario, diPagina: string[]): Contesto {
  const consenso = hasConsent(PURPOSE.marketing) || consensoSimulato()
  const dettaglio = consenso ? leggiDettaglio() : null
  const riassunto = consenso && !dettaglio ? leggiProfilo() : null
  return {
    path,
    now: new Date(),
    consenso,
    persona: dettaglio ? personaDaDettaglio(dettaglio) : riassunto ? personaDaRiassunto(riassunto) : null,
    calendario,
    memoria: leggiMemoria(),
    diPagina,
  }
}

/**
 * Banner a comparsa (finestra, pannello, avviso) su tutto il sito.
 * Sceglie il primo banner valido per la persona e la pagina, lo mostra al momento
 * previsto (subito, dopo N secondi o dopo aver scorso N% della pagina), uno per pagina.
 */
export default function BannerSito({ diPagina = [] }: { diPagina?: string[] }) {
  const router = useRouter()
  const { banner: dati } = useDataContext()
  const calendario = useCalendario()
  const [scelta, setScelta] = useState<Scelta | null>(null)
  const [visibile, setVisibile] = useState(false)
  const [forzato, setForzato] = useState(0)
  const paginaKey = diPagina.join(',')
  const path = router.asPath.split(/[?#]/)[0]

  // Scelta del banner a ogni pagina: dopo il tracciamento della pagina (effetto di _app).
  useEffect(() => {
    setVisibile(false)
    setScelta(null)
    if (!dati) return
    let attivo = true
    const timer = window.setTimeout(() => {
      if (!attivo) return
      const ctx = contesto(path, calendario, paginaKey ? paginaKey.split(',') : [])
      ultimoRapporto = rapportoBanner(dati, ctx)
      const forza = inAnteprima() ? bannerForzato() || new URLSearchParams(window.location.search).get('banner') : null
      const forzata = forza ? dati.tutti.find((s) => s.uuid === forza || s.slug.endsWith('/' + forza)) : null
      const trovato = forzata
        ? { story: forzata, modo: (forzata.content.modo === 'sezione' ? 'pannello' : forzata.content.modo || 'pannello') as ModoBanner }
        : scegliBanner(dati, ctx)
      if (!trovato) return
      const valori = variabili(trovato.story.content, ctx)
      const titolo = riempi(trovato.story.content.titolo, valori)
      const testo = riempi(trovato.story.content.testo, valori)
      const usaOpenDay = /\{(data_open_day|giorni_open_day)\}/.test(`${trovato.story.content.titolo} ${trovato.story.content.testo}`)
      const od = usaOpenDay ? prossimoOpenDay(ctx.calendario, ctx.now, ctx.persona?.area) || prossimoOpenDay(ctx.calendario, ctx.now) : undefined
      setScelta({
        ...trovato,
        titolo: titolo ?? trovato.story.content.titolo ?? '',
        testo: testo ?? trovato.story.content.testo ?? '',
        dataOpenDay: od?.data,
      })
    }, 50)
    return () => {
      attivo = false
      window.clearTimeout(timer)
    }
    // Il calendario cambia solo quando arrivano i posti: non serve rifare la scelta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dati, path, paginaKey, forzato])

  // Pulsante "Mostra" del riquadro ?debug=profilo.
  useEffect(() => {
    const ricarica = () => setForzato((n) => n + 1)
    window.addEventListener(EVENTO_FORZA, ricarica)
    return () => window.removeEventListener(EVENTO_FORZA, ricarica)
  }, [])

  // Momento della comparsa.
  useEffect(() => {
    if (!scelta) return
    const b = scelta.story.content
    const n = Number(b.comparsa_valore) || 0
    const mostra = () => {
      segnaVisto(scelta.story.uuid)
      setVisibile(true)
    }
    if (bannerForzato() || b.comparsa === 'subito' || !b.comparsa) {
      mostra()
      return
    }
    if (b.comparsa === 'secondi') {
      const t = window.setTimeout(mostra, n * 1000)
      return () => window.clearTimeout(t)
    }
    const controlla = () => {
      const altezza = document.documentElement.scrollHeight - window.innerHeight
      if (altezza <= 0 || (window.scrollY / altezza) * 100 >= n) {
        window.removeEventListener('scroll', controlla)
        mostra()
      }
    }
    window.addEventListener('scroll', controlla, { passive: true })
    controlla()
    return () => window.removeEventListener('scroll', controlla)
  }, [scelta])

  const chiudi = useCallback(() => {
    if (scelta) segnaChiuso(scelta.story.uuid)
    setVisibile(false)
  }, [scelta])

  const usato = useCallback(() => {
    if (scelta) segnaUsato(scelta.story.uuid)
  }, [scelta])

  if (!scelta || !visibile) return null

  return (
    <Vista
      key={scelta.story.uuid}
      scelta={scelta}
      onChiudi={chiudi}
      onUsato={usato}
      onFine={() => setVisibile(false)}
    />
  )
}

interface VistaProps {
  scelta: Scelta
  onChiudi: () => void
  onUsato: () => void
  onFine: () => void
}

function Vista({ scelta, onChiudi, onUsato, onFine }: VistaProps) {
  const telefono = useTelefono()
  const b = scelta.story.content
  const modulo = b.modulo && typeof b.modulo === 'object' && b.modulo.content ? b.modulo.content : null
  const [compila, setCompila] = useState(false)
  const pannelloRef = useRef<HTMLDivElement>(null)
  const area = (b.pubblico || []).find((v) => v === 'interni' || v === 'moda')
  const link = linkBanner(b)
  const modo = scelta.modo

  // Esc chiude; la finestra blocca lo scorrimento della pagina dietro.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onChiudi()
    window.addEventListener('keydown', esc)
    const blocca = modo === 'finestra' || (telefono && compila)
    const prima = document.body.style.overflow
    if (blocca) document.body.style.overflow = 'hidden'
    pannelloRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = prima
    }
  }, [modo, telefono, compila, onChiudi])

  if (modo === 'avviso') {
    return <Avviso scelta={scelta} link={link} modulo={!!modulo} onChiudi={onChiudi} onUsato={onUsato} onFine={onFine} />
  }

  const colore = colori[b.colore || 'chiaro']
  const scuro = b.colore === 'scuro' || b.colore === 'verde'
  const immagine = b.immagine?.filename ? b.immagine : null

  const azioni = (
    <div className="flex flex-wrap items-center gap-2">
      {modulo ? (
        <Button color={b.colore === 'verde' ? 'default' : 'primary'} onPress={() => setCompila(true)}>
          {modulo.label || 'Compila il modulo'}
        </Button>
      ) : link ? (
        <Button
          as={NextLink}
          href={link}
          color={b.colore === 'verde' ? 'default' : 'primary'}
          onPress={onUsato}
        >
          {b.azione?.[0]?.label || 'Scopri di più'}
        </Button>
      ) : null}
      {b.chiudi_testo && (
        <Button variant="light" className={scuro ? 'text-white' : undefined} onPress={onChiudi}>
          {b.chiudi_testo}
        </Button>
      )}
    </div>
  )

  const x = (
    <button
      type="button"
      onClick={onChiudi}
      aria-label="Chiudi"
      className={`absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full text-sm ${
        immagine && !compila && modo === 'finestra' && telefono ? 'bg-white/85 text-neutral-700' : scuro ? 'bg-white/15' : 'bg-black/5'
      }`}
    >
      ✕
    </button>
  )

  const corpo = compila && modulo ? (
    <div className="grid gap-3">
      <p className="pr-8 font-serif text-lg font-bold leading-tight">{scelta.titolo}</p>
      <BannerForm form={modulo} area={area} scuro={scuro} onInviato={onUsato} onChiudi={onFine} />
    </div>
  ) : (
    <div className="grid gap-2">
      <p className="pr-8 font-serif text-xl font-bold leading-tight">{scelta.titolo}</p>
      {scelta.testo && <p className="text-sm opacity-85">{scelta.testo}</p>}
      <div className="mt-1">{azioni}</div>
    </div>
  )

  // Telefono: finestra e pannello diventano una scheda dal basso (la finestra scurisce la pagina).
  if (telefono) {
    return (
      <>
        {modo === 'finestra' && <div className="fixed inset-0 z-[60] bg-black/45" onClick={onChiudi} aria-hidden="true" />}
        <div
          ref={pannelloRef}
          tabIndex={-1}
          role="dialog"
          aria-modal={modo === 'finestra'}
          aria-label={scelta.titolo}
          className={`fixed inset-x-0 bottom-0 z-[61] max-h-[88vh] overflow-y-auto rounded-t-2xl pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.18)] outline-none ${colore}`}
        >
          {modo === 'finestra' && immagine && !compila && (
            <img src={`${immagine.filename}/m/800x260/smart`} alt={immagine.alt || ''} className="h-32 w-full object-cover" />
          )}
          <span className="mx-auto mt-2 block h-1 w-8 rounded bg-default-300" aria-hidden="true" />
          {x}
          <div className="px-5 pb-5 pt-3">{corpo}</div>
        </div>
      </>
    )
  }

  if (modo === 'finestra') {
    return (
      <>
        <div className="fixed inset-0 z-[60] bg-black/45" onClick={onChiudi} aria-hidden="true" />
        <div
          ref={pannelloRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={scelta.titolo}
          className={`fixed left-1/2 top-1/2 z-[61] grid max-h-[90vh] w-[min(760px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl shadow-2xl outline-none ${colore} ${
            immagine && !compila ? 'grid-cols-[38%_1fr]' : 'grid-cols-1'
          }`}
        >
          {immagine && !compila && (
            <img src={`${immagine.filename}/m/600x800/smart`} alt={immagine.alt || ''} className="h-full w-full object-cover" />
          )}
          <div className="relative overflow-y-auto p-7">
            {x}
            {corpo}
          </div>
        </div>
      </>
    )
  }

  // Pannello su computer: fascia a tutta larghezza in basso, alta quanto il contenuto.
  const data = scelta.dataOpenDay ? new Date(scelta.dataOpenDay) : null
  return (
    <div
      ref={pannelloRef}
      tabIndex={-1}
      role="dialog"
      aria-label={scelta.titolo}
      className={`fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto border-t-[3px] border-primary shadow-[0_-10px_30px_rgba(0,0,0,0.12)] outline-none ${colore}`}
    >
      <div className="relative mx-auto flex max-w-screen-xl items-center gap-5 px-6 py-4">
        {x}
        {compila ? (
          <div className="w-full max-w-2xl">{corpo}</div>
        ) : (
          <>
            {data ? (
              <div className="w-16 shrink-0 rounded-lg border border-default-200 py-2 text-center">
                <b className="block font-serif text-2xl leading-none text-primary">{data.getDate()}</b>
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  {data.toLocaleDateString('it-IT', { month: 'short' })}
                </span>
              </div>
            ) : immagine ? (
              <img src={`${immagine.filename}/m/160x120/smart`} alt="" className="h-16 w-20 shrink-0 rounded-md object-cover" />
            ) : null}
            <div className="grid min-w-0 flex-1 gap-1 pr-10">
              <p className="font-serif text-lg font-bold leading-tight">{scelta.titolo}</p>
              {scelta.testo && <p className="text-sm opacity-85">{scelta.testo}</p>}
            </div>
            <div className="shrink-0 pr-10">{azioni}</div>
          </>
        )}
      </div>
    </div>
  )
}

interface AvvisoProps {
  scelta: Scelta
  link: string | null
  modulo: boolean
  onChiudi: () => void
  onUsato: () => void
  onFine: () => void
}

/** Avviso scuro nell'angolo: un solo link, sparisce da solo (si ferma col mouse sopra). */
function Avviso({ scelta, link, modulo, onChiudi, onUsato, onFine }: AvvisoProps) {
  const durata = BANNER.avvisoSecondi * 1000
  const [resta, setResta] = useState(durata)
  const [fermo, setFermo] = useState(false)
  const href = link && modulo ? `${link}${link.includes('?') ? '&' : '?'}modulo=apri` : link

  useEffect(() => {
    if (fermo) return
    const passo = 100
    const t = window.setInterval(() => setResta((r) => r - passo), passo)
    return () => window.clearInterval(t)
  }, [fermo])

  useEffect(() => {
    if (resta <= 0) onFine()
  }, [resta, onFine])

  return (
    <div
      role="status"
      onMouseEnter={() => setFermo(true)}
      onMouseLeave={() => setFermo(false)}
      onFocus={() => setFermo(true)}
      className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-4 right-4 z-[61] grid gap-1.5 rounded-xl bg-neutral-900 p-4 pr-11 text-white shadow-xl sm:left-auto sm:right-6 sm:w-[340px]"
    >
      <button
        type="button"
        onClick={onChiudi}
        aria-label="Chiudi"
        className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-white/15 text-xs"
      >
        ✕
      </button>
      <p className="font-serif text-base font-bold leading-tight">{scelta.titolo}</p>
      {scelta.testo && <p className="hidden text-sm opacity-85 sm:block">{scelta.testo}</p>}
      {href && (
        <NextLink href={href} onClick={onUsato} className="text-sm font-semibold text-[#7fd7a8]">
          {scelta.story.content.azione?.[0]?.label || 'Scopri di più'} →
        </NextLink>
      )}
      <span className="mt-1 h-0.5 overflow-hidden rounded bg-white/20" aria-hidden="true">
        <span className="block h-full bg-[#7fd7a8]" style={{ width: `${Math.max(0, (resta / durata) * 100)}%` }} />
      </span>
    </div>
  )
}
