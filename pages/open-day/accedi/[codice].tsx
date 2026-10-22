import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { Input, Link as HeroLink } from '@heroui/react'
import { Button } from '@components/ui/button'
import { tv } from 'tailwind-variants'
import { Logo } from '@public/logo'
import { normalizeEmail } from '@modules/crm-form'
import {
  APRE_PRIMA_MINUTI,
  fase,
  loadOpenday,
  normalizeCodice,
  prossimo,
  quandoTesto,
  type Fase,
} from '@modules/openday-accesso'

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
  return { props: { evento, prossimo: next, email } }
}

export default function Accedi({ evento, prossimo: next, email: emailIniziale }: Props) {
  const [now, setNow] = useState<Date | null>(null)
  const [email, setEmail] = useState(emailIniziale)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // L'orario si controlla nel browser e si aggiorna da solo: chi apre la pagina in
  // anticipo vede il pulsante attivarsi senza ricaricare.
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])

  const stato: Fase | null = evento && now ? fase(new Date(evento.inizio), now) : null

  const entra = async () => {
    if (!evento) return
    if (!normalizeEmail(email)) {
      setError("Scrivi l'email con cui ti sei iscritto.")
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/openday/accedi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codice: evento.codice, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.link) {
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
      <section className="relative flex flex-col justify-center p-6 sm:py-8 md:py-10 lg:py-12 max-w-[1280px] min-h-inherit mx-auto h-screen">
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
                  onPress={entra}
                >
                  Entra nell&apos;open day
                </Button>
              </div>
              {error && <p className="text-danger-500">{error}</p>}
            </>
          )}
        </div>
      </section>
    </main>
  )
}
