import { useCallback, useEffect, useState } from 'react'
import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getStoryblokApi } from '@storyblok/react'
import { Spinner } from '@heroui/react'
import { Logo } from '@public/logo'
import { getStoryblokVersion } from '@config/version'
import { ChiSei } from '@components/enrollment/chi-sei'
import { EnrollmentStepper, Summary, type StepItem } from '@components/enrollment/stepper'
import { isEnrollmentEnabled } from '@modules/enrollment/config'
import { courseFromEditionSlug, courseTitle } from '@modules/enrollment/courses'
import type { EnrollmentState } from '@modules/enrollment/state'
import { normalizeCourseSlug } from '@modules/enrollment/state'
import { SECTIONS, type SectionId } from '@modules/enrollment/types'

interface Props {
  corso: string
  titolo: string
}

export default function Iscrizione({ corso, titolo }: Props) {
  const router = useRouter()
  const [state, setState] = useState<EnrollmentState | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<SectionId>('chi_sei')

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
    } else {
      item.content = <p className="text-sm text-neutral-500">Questo passo è in preparazione.</p>
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
            ) : (
              <EnrollmentStepper items={items} onEdit={goTo} />
            )}
          </div>
        </div>
      </main>
    </>
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
