import { Logo } from '@public/logo'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Fragment, useEffect, useState } from 'react'
import { tv } from 'tailwind-variants'
import { Link as HeroLink } from '@heroui/react'
import { Button } from '@components/ui/button'
import Link from 'next/link'
import type { GetStaticProps } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import { sendGTMEvent } from '@next/third-parties/google'
import { EVENTS } from '@modules/brevo-events'

// Testi della pagina dopo il clic su una scelta nelle email dell'open day: le domande di
// "Cosa vedrai" (OPENDAY_DOMANDA: sbocchi, programma, attestato, costi, orari) e le richieste
// del giorno dopo (OPENDAY_RICHIESTA: dubbi, approfondire, simone).
// Si cambiano in Storyblok › Datasources › "Domande open day": il nome della voce è il
// valore salvato in Brevo e non va rinominato; il valore è la frase mostrata.
// Questi testi servono solo se Storyblok non risponde.
const DOMANDE_OPENDAY: Record<string, string> = {
  sbocchi: 'Ti racconteremo dove lavorano oggi i nostri diplomati e come si arriva al primo incarico.',
  programma: 'Ti mostreremo il programma del corso, materia per materia, con esempi di progetti.',
  attestato: 'Ti spiegheremo che attestato ottieni alla fine del corso e come si usa nel lavoro.',
  costi: 'Ti spiegheremo quanto costa il corso e come si può pagare, anche a rate.',
  orari: 'Ti diremo giorni e orari delle lezioni e come si frequenta mentre si lavora o si studia.',
  dubbi: 'Tra qualche giorno ti mandiamo le risposte alle domande che ci fanno tutti dopo l’open day.',
  approfondire: 'Tra qualche giorno ti mandiamo il programma completo e alcuni progetti d’esame dei nostri studenti.',
  simone: 'Simone ti chiamerà entro due giorni lavorativi.',
}

interface Props {
  domande: Record<string, string>
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const domande = { ...DOMANDE_OPENDAY }
  try {
    const { data } = await getStoryblokApi().get('cdn/datasource_entries', {
      datasource: 'domande-open-day',
      per_page: 100,
    })
    for (const e of (data.datasource_entries || []) as Array<{ name?: string; value?: string }>) {
      const name = String(e.name || '').trim()
      const value = String(e.value || '').trim()
      if (name && value) domande[name] = value
    }
  } catch (error) {
    console.error('[Conferma] Lettura "Domande open day" da Storyblok non riuscita:', error)
    return { props: { domande }, revalidate: 60 }
  }
  return { props: { domande }, revalidate: 300 }
}

export default function Feedback({ domande = DOMANDE_OPENDAY }: Props) {
  const router = useRouter()
  const params = router.query
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

  // One-click choice from the open day emails: saved once the page is open
  // (the link only left a signed cookie, see /api/openday/risposta)
  const answerType = router.isReady ? String(router.query.type || '') : ''
  useEffect(() => {
    if (answerType !== 'domanda' && answerType !== 'richiesta') return
    fetch('/api/openday/risposta', { method: 'POST' })
      .then((res) => {
        if (res.ok) sendGTMEvent({ event: EVENTS.answer })
      })
      .catch(() => {})
  }, [answerType])

  // Open Day: l'iscrizione avviene solo dopo il click sul pulsante
  const confirmOpenday = async () => {
    setConfirming(true)
    setConfirmError('')
    try {
      const res = await fetch('/api/openday/registrazione', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setConfirmError(
          res.status === 400
            ? 'Il link è scaduto. Riapri il link dall’email per confermare di nuovo.'
            : 'Non siamo riusciti a completare l’iscrizione. Riprova tra qualche minuto.'
        )
        return
      }
      sendGTMEvent({ event: EVENTS.openday })
      const next = new URLSearchParams({ type: 'openday', status: 'success' })
      if (params.area) next.set('area', String(params.area))
      if (data.openday_data) next.set('openday_data', data.openday_data)
      router.replace(`/conferma?${next.toString()}`)
    } catch {
      setConfirmError('Errore di connessione. Riprova.')
    } finally {
      setConfirming(false)
    }
  }

  if (!params) {
    return router.replace('/')
  }

  let collegamentoCorso
  if (params.corso) {
    const corsoParam = Array.isArray(params.corso)
      ? params.corso[0]
      : params.corso
    const paths = corsoParam.split('-')
    collegamentoCorso = `corsi/${paths[0]}/corso-${paths[0]}-${paths[1]}-livello`
  }

  const { title, description, wrapper } = classes()

  const areaFormatted = params.area
    ? String(params.area).charAt(0).toUpperCase() + String(params.area).slice(1)
    : ''

  return (
    <main>
      <section className="relative flex flex-col justify-center p-6 sm:py-8 md:py-10 lg:py-12 max-w-[1280px] min-h-inherit mx-auto h-screen">
        <Link href="/" className="absolute top-8 left-8">
          <Logo classes="" primary="#262C2A" secondary="#262C2A" />
        </Link>
        <div className={wrapper()}>
          {params.aggiornamento && (
            <Fragment>
              <Head>
                <title>Conferma aggiornamento</title>
              </Head>
              <h1 className={title()}>
                <span>Grazie {params.nome || null},</span>
                <br />
                <span className="text-5xl">
                  per aver corretto i tuoi dati di contatto!
                </span>
              </h1>
              <p className={description()}>
                Per noi le persone hanno un grosso valore e facciamo del nostro
                meglio per curarle a partire da queste piccole cose.
              </p>
              <Button href="/blog" color="primary" as={HeroLink}>
                Visita il blog
              </Button>
            </Fragment>
          )}
          {params.studente && (
            <Fragment>
              <Head>
                <title>Conferma contatto</title>
              </Head>
              <h1 className={title()}>
                <span>Grazie {params.nome || null},</span>
                <br />
                <span className="text-5xl">
                  per aver confermato il contatto!
                </span>
              </h1>
              <p className={description()}>
                A breve ti invieremo una mail con tutte le informazioni
                necessarie. Nel frattempo, puoi visitare il nostro blog e
                scoprire gli ultimi eventi e approfondimenti dal mondo
                dell’interior design.
              </p>
              <Button href="/blog" color="primary" as={HeroLink}>
                Visita il blog
              </Button>
            </Fragment>
          )}
          {params.cliente && (
            <Fragment>
              <Head>
                <title>Conferma contatto</title>
              </Head>
              <h1 className={title()}>
                <span>Buongiorno {params.nome || null},</span>
                <br />
                <span className="text-5xl">
                  la ringraziamo per aver confermato il contatto.
                </span>
              </h1>
              <p className={description()}>
                A breve le invieremo una mail con tutte le informazioni
                necessarie. Nel frattempo, può visitare il nostro blog e
                scoprire gli ultimi eventi e approfondimenti dal mondo
                dell’interior design.
              </p>
              <Button href="/blog" color="primary" as={HeroLink}>
                Visita il blog
              </Button>
            </Fragment>
          )}
          {params.docente && (
            <Fragment>
              <h1 className={title()}>
                <span>Buongiorno {params.nome || null},</span>
                <br />
                <span className="text-5xl">
                  la ringraziamo per aver confermato il contatto.
                </span>
              </h1>
              <p className={description()}>
                Abbiamo preso in carico la sua candidatura, la ricontatteremo
                non appena possibile!
              </p>
            </Fragment>
          )}
          {params.azienda && (
            <Fragment>
              <Head>
                <title>Conferma contatto</title>
              </Head>
              <h1 className={title()}>
                <span>Buongiorno {params.nome || null},</span>
                <br />
                <span className="text-5xl">
                  la ringraziamo per aver confermato il contatto.
                </span>
              </h1>
              <p className={description()}>
                Abbiamo preso in carico la sua richiesta, la ricontatteremo non
                appena possibile!
              </p>
            </Fragment>
          )}

          {/* Blocco Open Day (Conferma con un click) */}
          {params.type === 'openday' && params.status === 'confirm' && (
            <Fragment>
              <Head>
                <title>Conferma partecipazione Open Day</title>
                <meta name="robots" content="noindex" />
              </Head>
              <h1 className={title()}>
                <span className="text-5xl">
                  Vuoi partecipare all'Open Day {areaFormatted ? `di ${areaFormatted}` : ''}?
                </span>
              </h1>
              <p className={description()}>
                Conferma la tua partecipazione con un click: ti inseriamo tra gli iscritti e ti scriviamo con tutte le informazioni.
              </p>
              <Button color="primary" onPress={confirmOpenday} isLoading={confirming}>
                Confermo la partecipazione
              </Button>
              {confirmError && <p className="mt-4 text-danger-500">{confirmError}</p>}
            </Fragment>
          )}

          {/* Blocco Open Day (Successo) */}
          {(params.openday || (params.type === 'openday' && params.status === 'success')) && (
            <Fragment>
              <Head>
                <title>Conferma partecipazione Open Day</title>
              </Head>
              <h1 className={title()}>
                <span>{params.nome ? `Ciao ${params.nome},` : 'Ciao,'}</span>
                <br />
                <span className="text-5xl">
                  l'iscrizione all'Open Day è confermata!
                </span>
              </h1>
              <div className={description()}>
                <p className="mb-4">
                  Confermiamo che il tuo nominativo è stato inserito tra i partecipanti al prossimo Open Day {areaFormatted ? `di ${areaFormatted} ` : ''}design.
                </p>
                {params.openday_data && (
                  <p className="mb-4">
                    L’incontro si svolgerà il giorno <strong>{params.openday_data}</strong> online alle ore 21:00 per circa un'ora, in diretta con la nostra direzione e i docenti, per offrirti una panoramica completa e concreta del nostro percorso formativo.
                  </p>
                )}
                <p className="mb-4">
                  Il giorno dell'Open Day riceverai il link per collegarti alla video call un'ora prima dell'inizio.
                </p>
                <p>
                  Sarà un piacere incontrarti, anche se virtualmente!
                </p>
              </div>
              {collegamentoCorso ? (
                <Button href={collegamentoCorso} color="primary" as={HeroLink}>
                  Visita la pagina
                </Button>
              ) : (
                <Button href="/corsi" color="primary" as={HeroLink}>
                  Scopri i corsi
                </Button>
              )}
            </Fragment>
          )}

          {/* Open Day: risposta con un clic dall'email "Cosa vedrai" (la scelta la salva Brevo dal clic) */}
          {params.type === 'domanda' && (
            <Fragment>
              <Head>
                <title>Grazie per la tua domanda</title>
                <meta name="robots" content="noindex" />
              </Head>
              <h1 className={title()}>
                <span>Grazie,</span>
                <br />
                <span className="text-5xl">all'open day partiamo dalla tua domanda.</span>
              </h1>
              <p className={description()}>
                {domande[String(params.d)] ||
                  'Durante la serata rispondiamo alle domande di chi partecipa.'}{' '}
                Nei prossimi giorni ti scriviamo ancora per prepararti alla serata.
              </p>
              <Button href="/" color="primary" as={HeroLink}>
                Torna al sito
              </Button>
            </Fragment>
          )}

          {/* Dopo l'open day: scelta con un clic nell'email del giorno dopo (la salva Brevo dal clic) */}
          {params.type === 'richiesta' && (
            <Fragment>
              <Head>
                <title>Grazie, ci pensiamo noi</title>
                <meta name="robots" content="noindex" />
              </Head>
              <h1 className={title()}>
                <span>Grazie,</span>
                <br />
                <span className="text-5xl">ci pensiamo noi.</span>
              </h1>
              <p className={description()}>
                {domande[String(params.d)] || 'Nei prossimi giorni ti scriviamo per aiutarti a decidere.'}
              </p>
              <Button href="/" color="primary" as={HeroLink}>
                Torna al sito
              </Button>
            </Fragment>
          )}

          {/* Blocco Open Day (Errore) */}
          {params.type === 'openday' && params.status === 'error' && (
            <Fragment>
              <Head>
                <title>Errore iscrizione Open Day</title>
              </Head>
              <h1 className={title()}>
                <span className="text-5xl text-danger-500">
                  Ops, qualcosa è andato storto!
                </span>
              </h1>
              <p className={description()}>
                Si è verificato un errore imprevisto durante l'iscrizione all'Open Day {areaFormatted ? `di ${areaFormatted}` : ''}. Ti preghiamo di riprovare più tardi o di contattare la segreteria.
              </p>
              <Button href="/" color="primary" as={HeroLink}>
                Torna alla home
              </Button>
            </Fragment>
          )}

        </div>
      </section>
    </main>
  )
}

const classes = tv({
  slots: {
    title: 'font-serif type-display mb-6',
    description: 'font-sans text-lg mb-12',
    wrapper: 'md:max-w-2/3',
  },
})