import { useCallback, useEffect, useState } from 'react'
import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getStoryblokApi } from '@storyblok/react'
import { Spinner } from '@heroui/react'
import { Logo } from '@public/logo'
import { getLongDate } from '@modules/formats'
import { getStoryblokVersion } from '@config/version'
import { ChiSei } from '@components/enrollment/chi-sei'
import { Corso, MODE_LABELS, SCOPO_LABELS, editionLine, euro, type CourseChoice } from '@components/enrollment/corso'
import { DOCUMENT_LABELS, Dati } from '@components/enrollment/dati'
import { Profilo } from '@components/enrollment/profilo'
import { Consensi } from '@components/enrollment/consensi'
import { Conferma, Firma } from '@components/enrollment/firma'
import { EnrollmentStepper, Summary, type StepItem } from '@components/enrollment/stepper'
import { isEnrollmentEnabled } from '@modules/enrollment/config'
import { courseFromEditionSlug, courseTitle } from '@modules/enrollment/courses'
import type { EnrollmentState } from '@modules/enrollment/state'
import type { CourseOffer, EditionOption } from '@modules/enrollment/offer'
import { ORE_LABELS, SOURCE_LABELS, TITOLO_LABELS } from '@modules/enrollment/profile'
import { normalizeCourseSlug } from '@modules/enrollment/state'
import { SECTIONS, type PaymentMode, type SectionId } from '@modules/enrollment/types'

interface Props {
  corso: string
  titolo: string
}

export default function Iscrizione({ corso, titolo }: Props) {
  const router = useRouter()
  const [state, setState] = useState<EnrollmentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<SectionId>('chi_sei')
  // Passo 2: edizioni e importi, letti una volta verificata l'email e completato il passo 1.
  const [offer, setOffer] = useState<CourseOffer | null>(null)
  const [offerError, setOfferError] = useState('')
  // Scelte in corso nel passo 2, per aggiornare il riepilogo prima di "Continua".
  const [draft, setDraft] = useState<CourseChoice | null>(null)
  const step1Done = !!state?.sezioni_complete.includes('chi_sei')

  useEffect(() => {
    if (!step1Done || offer) return
    let active = true
    fetch(`/api/iscrizione/offerta?corso=${encodeURIComponent(corso)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!active) return
        if (!res.ok) return setOfferError(data.message || 'Non riusciamo a caricare le edizioni, riprova tra poco.')
        setOffer(data as CourseOffer)
      })
      .catch(() => active && setOfferError('Errore di connessione. Ricarica la pagina.'))
    return () => {
      active = false
    }
  }, [step1Done, offer, corso])

  const chosenKey = draft?.edizione || state?.corso_pagamento.edizione || ''
  const chosenMode = (draft?.modalita || state?.corso_pagamento.modalita || null) as PaymentMode | null
  const choice = {
    edizione: offer?.edizioni.find((e) => e.chiave === chosenKey) || null,
    modalita: chosenMode,
    offer,
  }

  // Chi ha già verificato l'email (cookie) riprende da dove era.
  useEffect(() => {
    let active = true
    fetch(`/api/iscrizione/bozza?corso=${encodeURIComponent(corso)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.iscrizione) return
        setState(data.iscrizione)
        setOpen(data.iscrizione.prossima || 'chi_sei')
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [corso])

  const goTo = useCallback((id: SectionId) => {
    setOpen(id)
    requestAnimationFrame(() => document.getElementById(`passo-${id}`)?.scrollIntoView({ behavior: 'smooth' }))
  }, [])

  const saved = (next: EnrollmentState) => {
    setState(next)
    // Dopo "Continua" si va al primo passo non ancora completato.
    goTo(next.prossima || 'firma')
  }

  const signedNow = (next: EnrollmentState) => {
    setState(next)
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  const isSigned = !!state && state.stato !== 'bozza'
  const signedEdition = offer?.edizioni.find((e) => e.chiave === state?.corso_pagamento.edizione)

  const complete = state?.sezioni_complete || []
  const firstLocked = SECTIONS.find((s) => s !== open && !complete.includes(s))

  const items: StepItem[] = SECTIONS.map((id) => {
    const isOpen = id === open
    const done = complete.includes(id) && !isOpen
    const item: StepItem = { id, state: isOpen ? 'open' : done ? 'done' : 'locked', hint: id === firstLocked }
    if (id === 'chi_sei') {
      item.content = (
        <ChiSei
          corso={corso}
          initialEmail={typeof router.query.email === 'string' ? router.query.email : ''}
          state={state}
          onVerified={setState}
          onSaved={saved}
        />
      )
      item.summary = state && (
        <Summary
          rows={[
            ['Nome e cognome', `${state.chi_sei.nome} ${state.chi_sei.cognome}`],
            ['Email', state.email],
            ['Cellulare', state.chi_sei.telefono],
          ]}
        />
      )
    } else if (id === 'corso' && state) {
      item.content = (
        <Corso corso={corso} state={state} offer={offer} loadError={offerError} onSaved={saved} onChange={setDraft} />
      )
      const cp = state.corso_pagamento
      const ed = offer?.edizioni.find((e) => e.chiave === cp.edizione)
      item.summary = (
        <Summary
          rows={[
            ['Edizione', ed ? `${ed.titolo || ed.sede} · dal ${getLongDate(ed.inizio)}` : ''],
            ['Cosa ti aspetti', cp.scopo ? SCOPO_LABELS[cp.scopo] || cp.scopo : ''],
            [
              'Pagamento',
              cp.modalita && cp.totale !== null
                ? `${MODE_LABELS[cp.modalita]}, totale ${euro(cp.totale)}${cp.offerta ? ' (prezzo open day)' : ''}`
                : '',
            ],
          ]}
        />
      )
    } else if (id === 'dati' && state) {
      item.content = <Dati corso={corso} state={state} onSaved={saved} />
      const d = state.dati as Record<string, string | Record<string, string> | null>
      const az = d.azienda && typeof d.azienda === 'object' ? d.azienda : null
      const nascita = typeof d.data_nascita === 'string' && d.data_nascita ? `${getLongDate(d.data_nascita)}, ${d.luogo_nascita}` : ''
      item.summary = (
        <Summary
          rows={[
            ['Nascita', nascita],
            ['Codice fiscale', typeof d.codice_fiscale === 'string' ? d.codice_fiscale : ''],
            ['Residenza', typeof d.via === 'string' && d.via ? `${d.via}, ${d.cap} ${d.comune} (${d.provincia})` : ''],
            [
              'Documento',
              typeof d.documento_tipo === 'string' && d.documento_tipo
                ? `${DOCUMENT_LABELS[d.documento_tipo] || d.documento_tipo} n. ${d.documento_numero}`
                : '',
            ],
            ['Foto', d.documenti === 'dopo' ? 'Le carichi dopo' : state.foto_caricate.length ? 'Caricate' : ''],
            ['Fatturazione', az ? `${az.ragione_sociale}, P. IVA ${az.partita_iva}` : 'A tuo nome'],
          ]}
        />
      )
    } else if (id === 'profilo' && state) {
      item.content = <Profilo corso={corso} state={state} onSaved={saved} />
      const p = state.profilo
      const label = (labels: Record<string, string>, v: unknown) => (typeof v === 'string' ? labels[v] || '' : '')
      const sources = Array.isArray(p.come_ci_hai_conosciuto) ? (p.come_ci_hai_conosciuto as string[]) : []
      item.summary = p.saltato ? (
        <Summary rows={[['Profilo', 'Saltato']]} />
      ) : (
        <Summary
          rows={[
            ['Studi', label(TITOLO_LABELS, p.titolo_studi)],
            ['Lavoro', p.non_lavoro ? 'Non lavora ancora' : [p.occupazione, p.ruolo].filter(Boolean).join(', ')],
            ['Tempo per esercitarti', label(ORE_LABELS, p.ore_settimana)],
            ['Come ci hai conosciuto', sources.map((s) => label(SOURCE_LABELS, s)).join(', ')],
          ]}
        />
      )
    } else if (id === 'consensi' && state) {
      item.content = <Consensi corso={corso} state={state} onSaved={saved} />
      const c = state.consensi
      const answered = Object.keys(c).filter((k) => k !== 'impronta')
      item.summary = (
        <Summary
          rows={[
            ['Consensi', answered.length ? 'Risposte date a tutte le voci obbligatorie' : ''],
            ['Fotografie e video', c.foto === 'si' ? 'Autorizzati' : c.foto === 'no' ? 'Non autorizzati' : ''],
            ['Novità via email', c.newsletter === true ? 'Sì' : 'No'],
          ].filter(([, v]) => v !== '') as Array<[string, string]>}
        />
      )
    } else if (id === 'firma' && state) {
      item.content = (
        <Firma
          corso={corso}
          state={state}
          onSigned={signedNow}
          onReopen={(passo) => {
            // Edizione piena o condizioni cambiate: si torna al passo, con i dati aggiornati.
            if (passo === 'corso') setOffer(null)
            goTo(passo)
          }}
        />
      )
    }
    return item
  })

  return (
    <>
      <Head>
        <title>{`Iscrizione: ${titolo} | MIIA`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="min-h-screen bg-white text-[#232325]">
        <header className="mx-auto flex max-w-[1280px] items-center p-6">
          <Link href="/" aria-label="Made in Italy Academy">
            <Logo classes="h-8 sm:h-10" primary="#171717" secondary="#008C45" />
          </Link>
        </header>
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 pb-16">
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Iscrizione online</p>
            <h1 className="mt-1 mb-2 text-3xl sm:text-4xl font-bold leading-tight">{titolo}</h1>
            <p className="mb-10 text-neutral-600">
              Oggi non paghi nulla. Puoi ripensarci entro 14 giorni dalla firma.
            </p>
            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner color="primary" />
              </div>
            ) : isSigned && state ? (
              <Conferma
                state={state}
                edizione={signedEdition ? `${editionLine(signedEdition)} · dal ${getLongDate(signedEdition.inizio)}` : ''}
              />
            ) : (
              <EnrollmentStepper items={items} onEdit={goTo} />
            )}
          </div>
          <Riepilogo titolo={titolo} choice={choice} />
          </div>
        </div>
      </main>
    </>
  )
}

/** Riquadro "La tua iscrizione": fisso a destra da computer, in fondo da telefono. */
function Riepilogo({
  titolo,
  choice,
}: {
  titolo: string
  choice: { edizione: EditionOption | null; modalita: PaymentMode | null; offer: CourseOffer | null }
}) {
  const q = choice.modalita && choice.offer?.prezzi ? choice.offer.prezzi[choice.modalita] : null
  return (
    <aside className="mt-10 lg:mt-0">
      <div className="lg:sticky lg:top-8 rounded-2xl bg-[#F3F3F2] p-6 text-sm">
        <h2 className="mb-4 text-lg font-bold">La tua iscrizione</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-neutral-500">Corso</dt>
            <dd className="font-medium">{titolo}</dd>
          </div>
          {choice.edizione && (
            <div>
              <dt className="text-neutral-500">Edizione</dt>
              <dd className="font-medium">{editionLine(choice.edizione)}</dd>
              <dd className="text-neutral-600">Dal {getLongDate(choice.edizione.inizio)}</dd>
            </div>
          )}
          {q && (
            <div>
              <dt className="text-neutral-500">Pagamento</dt>
              <dd className="font-medium">
                {q.rate > 1 ? `${q.rate} rate da ${euro(q.rata)}` : 'Soluzione unica'}, totale {euro(q.totale)}
              </dd>
              {q.offerta && <dd className="text-secondary font-semibold">Prezzo open day</dd>}
            </div>
          )}
        </dl>
        <p className="mt-6 border-t border-neutral-300 pt-4 text-base font-bold">Oggi paghi {euro(0)}</p>
      </div>
    </aside>
  )
}

export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' })

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  // Finché l'interruttore è spento la pagina non esiste.
  if (!isEnrollmentEnabled()) return { notFound: true, revalidate: 60 }

  const corso = normalizeCourseSlug(params?.corso)
  if (!corso) return { notFound: true }

  // Il corso esiste se in Storyblok ha almeno un'edizione pubblicata.
  try {
    const { data } = await getStoryblokApi().getStories({
      version: getStoryblokVersion(),
      content_type: 'course',
      starts_with: 'corsi/',
      per_page: 100,
    })
    const found = (data.stories as Array<{ full_slug: string }>).some((s) => courseFromEditionSlug(s.full_slug) === corso)
    if (!found) return { notFound: true, revalidate: 300 }
  } catch (error) {
    console.error('[Iscrizione] Lettura corsi da Storyblok non riuscita:', error)
    return { notFound: true, revalidate: 60 }
  }

  return { props: { corso, titolo: courseTitle(corso) }, revalidate: 3600 }
}
