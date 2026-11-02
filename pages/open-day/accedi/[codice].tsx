import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Checkbox, CheckboxGroup, Input, Link as HeroLink, Radio, RadioGroup } from '@heroui/react'
import { pillCheckbox, pillRadio } from '@components/ui/fields'
import { Button } from '@components/ui/button'
import { tv } from 'tailwind-variants'
import { Logo } from '@public/logo'
import { normalizeEmail } from '@modules/crm-form'
import { sendGTMEvent } from '@next/third-parties/google'
import { EVENTS } from '@modules/brevo-events'
import {
  APRE_PRIMA_MINUTI,
  fase,
  loadOpenday,
  normalizeCodice,
  prossimo,
  quandoTesto,
  type Fase,
} from '@modules/openday-accesso'
import {
  accessoPer,
  attributiContatto,
  debugAmmesso,
  loadModuloAccesso,
  type Accesso,
  type Risposte,
} from '@modules/openday-domande'

const styles = tv({
  slots: {
    wrapper: 'flex flex-col gap-6 max-w-xl',
    title: 'text-3xl sm:text-5xl font-bold tracking-tight',
    description: 'text-lg text-default-600',
  },
})
const { wrapper, title, description } = styles()

interface Evento {
  codice: string
  titolo: string
  inizio: string
  quando: string
}

interface Props {
  evento: Evento | null
  prossimo: (Evento & { iscrizione: string }) | null
  email: string
  /** Domande prima di entrare, già calcolate quando l'email è nel link. */
  accesso: Accesso | null
  /** ?debug=1 in locale o nell'anteprima: open day trattato come aperto, si salvano solo le risposte. */
  debug: boolean
}

/** Domande da fare a chi ha l'email nel link; null se non si possono leggere (si entra lo stesso). */
async function accessoIniziale(modulo: string, email: string): Promise<Accesso | null> {
  try {
    const [m, attributi] = await Promise.all([loadModuloAccesso(modulo), attributiContatto(email)])
    return accessoPer(m, attributi)
  } catch (error) {
    console.error('[Open day] Domande di accesso non disponibili:', error)
    return null
  }
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, query, res }) => {
  res.setHeader('Cache-Control', 'no-store')
  const codice = normalizeCodice(params?.codice)
  const email = normalizeEmail(query.email) || ''
  const eventi = await loadOpenday().catch((error) => {
    console.error('[Open day] Lettura degli eventi da Storyblok non riuscita:', error)
    return []
  })
  const trovato = eventi.find((e) => e.codice === codice)
  const evento = trovato
    ? {
        codice: trovato.codice,
        titolo: trovato.titolo,
        inizio: trovato.inizio.toISOString(),
        quando: quandoTesto(trovato.inizio),
      }
    : null

  let next: Props['prossimo'] = null
  if (trovato && fase(trovato.inizio) === 'finito') {
    const p = prossimo(eventi, trovato.area)
    if (p) {
      const iscrizione = email
        ? `/api/openday/registrazione?email=${encodeURIComponent(email)}&area=${encodeURIComponent(p.area)}`
        : '/'
      next = {
        codice: p.codice,
        titolo: p.titolo,
        inizio: p.inizio.toISOString(),
        quando: quandoTesto(p.inizio),
        iscrizione,
      }
    }
  }
  const debug = query.debug === '1' && debugAmmesso()
  const accesso =
    trovato && email && (debug || fase(trovato.inizio) !== 'finito')
      ? await accessoIniziale(trovato.modulo, email)
      : null
  return { props: { evento, prossimo: next, email, accesso, debug } }
}

export default function Accedi({
  evento,
  prossimo: next,
  email: emailIniziale,
  accesso: accessoIniziale,
  debug,
}: Props) {
  const [now, setNow] = useState<Date | null>(null)
  const [email, setEmail] = useState(emailIniziale)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Domande prima di entrare: dal server se l'email è nel link, altrimenti chieste dopo l'email
  const [accesso, setAccesso] = useState<Accesso | null>(accessoIniziale)
  const [accessoPer, setAccessoPer] = useState(accessoIniziale ? emailIniziale : '')
  const [risposte, setRisposte] = useState<Risposte>({})
  const domande = accesso?.domande || []

  // L'orario si controlla nel browser e si aggiorna da solo: chi apre la pagina in
  // anticipo vede il pulsante attivarsi senza ricaricare.
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])

  const [prova, setProva] = useState('')
  const stato: Fase | null = evento && now ? (debug ? 'aperto' : fase(new Date(evento.inizio), now)) : null

  const scegli = (id: string, valori: string[]) => setRisposte((prev) => ({ ...prev, [id]: valori }))

  /** Con l'email scritta a mano: prima le domande (se ce ne sono), poi si entra. true = domande da mostrare. */
  const caricaDomande = async (indirizzo: string): Promise<boolean> => {
    if (!evento || accessoPer === indirizzo) return false
    try {
      const res = await fetch('/api/openday/domande', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codice: evento.codice, email: indirizzo, ...(debug ? { debug: true } : {}) }),
      })
      const data = (await res.json().catch(() => null)) as Accesso | null
      setAccesso(data && Array.isArray(data.domande) ? data : null)
      setAccessoPer(indirizzo)
      setRisposte({})
      return !!data?.domande?.length
    } catch {
      setAccessoPer(indirizzo)
      return false
    }
  }

  const entra = async (conRisposte = true) => {
    if (!evento) return
    const indirizzo = normalizeEmail(email)
    if (!indirizzo) {
      setError("Scrivi l'email con cui ti sei iscritto.")
      return
    }
    setLoading(true)
    setError('')
    if (await caricaDomande(indirizzo)) {
      setLoading(false)
      return
    }
    try {
      const res = await fetch('/api/openday/accedi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codice: evento.codice,
          email,
          ...(conRisposte ? { risposte } : {}),
          ...(debug ? { debug: true } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.debug) {
        setProva(data.message || `Salvato sul contatto: ${JSON.stringify(data.salvato)}`)
        setLoading(false)
        return
      }
      if (res.ok && data.link) {
        sendGTMEvent({ event: EVENTS.presence })
        window.location.href = data.link
        return
      }
      if (data.fase) setNow(new Date())
      setError(data.message || 'Non siamo riusciti a farti entrare: riprova tra un momento.')
    } catch {
      setError('Connessione non riuscita: riprova tra un momento.')
    }
    setLoading(false)
  }

  return (
    <main>
      <Head>
        <title>Entra nell&apos;open day</title>
        <meta name="robots" content="noindex" />
      </Head>
      <section className="relative mx-auto flex min-h-screen max-w-[1280px] flex-col justify-center px-6 py-28">
        <Link href="/" className="absolute top-8 left-8">
          <Logo classes="" primary="#262C2A" secondary="#262C2A" />
        </Link>
        <div className={wrapper()}>
          {!evento && (
            <>
              <h1 className={title()}>Open day non trovato</h1>
              <p className={description()}>
                Il link che hai aperto non corrisponde a nessun open day. Usa il link dell&apos;ultima email che ti
                abbiamo mandato, oppure scrivici a info@miia.it.
              </p>
              <Button href="/" color="primary" as={HeroLink} className="self-start">
                Torna al sito
              </Button>
            </>
          )}

          {evento && stato === 'finito' && (
            <>
              <h1 className={title()}>L&apos;open day è finito</h1>
              {next ? (
                <>
                  <p className={description()}>
                    Il prossimo è <strong>{next.quando}</strong>, online.
                  </p>
                  <Button href={next.iscrizione} color="primary" as={HeroLink} className="self-start">
                    Iscriviti al prossimo open day
                  </Button>
                </>
              ) : (
                <>
                  <p className={description()}>Presto pubblicheremo la data del prossimo.</p>
                  <Button href="/" color="primary" as={HeroLink} className="self-start">
                    Torna al sito
                  </Button>
                </>
              )}
            </>
          )}

          {evento && (stato === 'presto' || stato === 'aperto') && (
            <>
              <h1 className={title()}>{evento.titolo || 'Open day'}</h1>
              <p className={description()}>
                {stato === 'presto' ? (
                  <>
                    L&apos;open day inizia <strong>{evento.quando}</strong>. Il pulsante si attiva {APRE_PRIMA_MINUTI}{' '}
                    minuti prima: puoi lasciare aperta questa pagina.
                  </>
                ) : (
                  <>Ti aspettiamo. Entrando, scrivi nome e cognome e spegni il microfono.</>
                )}
              </p>
              {domande.length > 0 && (
                <div className="flex flex-col gap-5 border-t border-default-200 pt-6">
                  {(accesso?.titolo || accesso?.testo) && (
                    <div className="flex flex-col gap-1">
                      {accesso?.titolo && <h2 className="text-xl font-semibold">{accesso.titolo}</h2>}
                      {accesso?.testo && <p className="text-default-600">{accesso.testo}</p>}
                    </div>
                  )}
                  {domande.map((domanda) =>
                    domanda.multipla ? (
                      <CheckboxGroup
                        key={domanda.id}
                        label={domanda.label}
                        value={risposte[domanda.id] || []}
                        onValueChange={(valori) => scegli(domanda.id, valori)}
                        orientation="horizontal"
                        classNames={{ label: 'font-medium text-foreground', wrapper: 'gap-2' }}
                      >
                        {domanda.opzioni.map((opzione) => (
                          <Checkbox key={opzione.value} value={opzione.value} classNames={pillCheckbox}>
                            {opzione.label}
                          </Checkbox>
                        ))}
                      </CheckboxGroup>
                    ) : (
                      <RadioGroup
                        key={domanda.id}
                        label={domanda.label}
                        value={risposte[domanda.id]?.[0] || ''}
                        onValueChange={(valore) => scegli(domanda.id, valore ? [valore] : [])}
                        orientation="horizontal"
                        classNames={{ label: 'font-medium text-foreground', wrapper: 'gap-2' }}
                      >
                        {domanda.opzioni.map((opzione) => (
                          <Radio key={opzione.value} value={opzione.value} classNames={pillRadio}>
                            {opzione.label}
                          </Radio>
                        ))}
                      </RadioGroup>
                    ),
                  )}
                </div>
              )}
              <div className="flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-center">
                {!emailIniziale && (
                  <Input
                    type="email"
                    size="lg"
                    label="L'email con cui ti sei iscritto"
                    value={email}
                    onValueChange={setEmail}
                    className="sm:flex-1"
                  />
                )}
                <Button
                  color="primary"
                  size="lg"
                  className="h-16 shrink-0 self-start sm:self-auto"
                  isDisabled={stato !== 'aperto'}
                  isLoading={loading}
                  onPress={() => entra()}
                >
                  Entra nell&apos;open day
                </Button>
                {domande.length > 0 && (
                  <Button
                    variant="light"
                    size="lg"
                    className="h-16 shrink-0 self-start sm:self-auto"
                    isDisabled={stato !== 'aperto' || loading}
                    onPress={() => entra(false)}
                  >
                    Salta ed entra
                  </Button>
                )}
              </div>
              {error && <p className="text-danger-500">{error}</p>}
              {debug && (
                <p className="text-sm text-default-500">
                  Modalità prova: nessuna presenza, nessun evento, nessuna call. {prova}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
