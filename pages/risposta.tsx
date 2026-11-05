import { Logo } from '@public/logo'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import type { GetStaticProps } from 'next'
import { tv } from 'tailwind-variants'
import { Link as HeroLink } from '@heroui/react'
import { getStoryblokApi } from '@storyblok/react'
import { sendGTMEvent } from '@next/third-parties/google'
import { Button } from '@components/ui/button'
import { EVENTS } from '@modules/brevo-events'
import { TELEFONATA_URL, WHATSAPP_NUMERO, WHATSAPP_URL, ctaFor, paragraphs, parseCorso, parseFase } from '@modules/risposte'

// Risposte ai dubbi cliccati nelle email del funnel. Si scrivono in
// Storyblok › Datasources › "Domande open day": il nome della voce è il valore "d" del
// link (ed è salvato in Brevo, non va rinominato), il valore è la risposta completa.
// Un a capo nel testo separa i paragrafi.
// Questi testi servono solo se Storyblok non risponde.
export const RISPOSTE_DI_RISERVA: Record<string, string> = {
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
  risposte: Record<string, string>
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const risposte = { ...RISPOSTE_DI_RISERVA }
  try {
    const { data } = await getStoryblokApi().get('cdn/datasource_entries', {
      datasource: 'domande-open-day',
      per_page: 100,
    })
    for (const e of (data.datasource_entries || []) as Array<{ name?: string; value?: string }>) {
      const name = String(e.name || '').trim()
      const value = String(e.value || '').trim()
      if (name && value) risposte[name] = value
    }
  } catch (error) {
    console.error('[Risposta] Lettura "Domande open day" da Storyblok non riuscita:', error)
    return { props: { risposte }, revalidate: 60 }
  }
  return { props: { risposte }, revalidate: 300 }
}

export default function Risposta({ risposte = RISPOSTE_DI_RISERVA }: Props) {
  const router = useRouter()
  const ready = router.isReady
  const q = router.query
  const tipo = ready ? String(q.tipo || '') : ''
  const fase = parseFase(q.fase)
  const corso = parseCorso(q.corso)
  const testo = risposte[String(q.d || '')]
  const cta = ctaFor(fase, corso)

  // The link only left a signed cookie (see /api/openday/risposta): the choice is saved now
  useEffect(() => {
    if (tipo !== 'domanda' && tipo !== 'richiesta') return
    fetch('/api/openday/risposta', { method: 'POST' })
      .then((res) => {
        if (res.ok) sendGTMEvent({ event: EVENTS.answer })
      })
      .catch(() => {})
  }, [tipo])

  const { title, body, box, wrapper } = classes()

  return (
    <main>
      <Head>
        <title>{tipo === 'richiesta' ? 'Grazie, ci pensiamo noi' : 'La risposta alla tua domanda'}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <section className="relative flex flex-col justify-center p-6 pt-28 sm:py-8 md:py-10 lg:py-12 max-w-[1280px] min-h-screen mx-auto">
        <Link href="/" className="absolute top-8 left-8">
          <Logo classes="" primary="#262C2A" secondary="#262C2A" />
        </Link>
        <div className={wrapper()}>
          <h1 className={title()}>
            {tipo === 'richiesta' ? (
              <span>Grazie, ci pensiamo noi.</span>
            ) : (
              <span>Ecco la risposta alla tua domanda.</span>
            )}
          </h1>
          <div className={body()}>
            {(testo ? paragraphs(testo) : ['Ti rispondiamo volentieri di persona: scegli tu come sentirci.']).map((p, i) => (
              <p key={i} className="mb-4">
                {p}
              </p>
            ))}
          </div>

          <div className={box()}>
            <h2 className="font-serif text-2xl mb-2">Vuoi approfondire?</h2>
            <p className="mb-6">Parliamone direttamente, senza impegno.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button href={TELEFONATA_URL} target="_blank" color="primary" variant="bordered" as={HeroLink}>
                Prenota una telefonata di 15 minuti
              </Button>
              <Button href={WHATSAPP_URL} target="_blank" color="primary" variant="bordered" as={HeroLink}>
                Scrivici su WhatsApp ({WHATSAPP_NUMERO})
              </Button>
            </div>
          </div>

          {fase === 'pre-openday' && (
            <p className="font-sans text-lg">Ne parliamo anche all’open day: porta con te le tue domande.</p>
          )}
          {cta && (
            <Button href={cta.href} color="primary" as={HeroLink}>
              {cta.label}
            </Button>
          )}
        </div>
      </section>
    </main>
  )
}

const classes = tv({
  slots: {
    title: 'font-serif type-display mb-6 text-5xl',
    body: 'font-sans text-lg mb-10',
    box: 'font-sans text-lg mb-10 p-6 rounded-lg border-1 border-neutral-500/20',
    wrapper: 'md:max-w-2/3',
  },
})
