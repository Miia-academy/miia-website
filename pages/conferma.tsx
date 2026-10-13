import { Logo } from '@public/logo'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Fragment, useState } from 'react'
import { tv } from 'tailwind-variants'
import { Link as HeroLink, Button } from '@heroui/react'
import Link from 'next/link'

export default function Feedback() {
  const router = useRouter()
  const params = router.query
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState('')

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

  const { title, subtitle, description, wrapper } = classes()

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
    title: 'font-serif font-black text-4xl md:text-6xl leading-none mb-6',
    subtitle: 'font-sans font-medium text-2xl md:text-3xl leading-none mb-3',
    description: 'font-sans text-lg mb-12',
    wrapper: 'md:max-w-2/3',
  },
})