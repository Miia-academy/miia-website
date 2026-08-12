import { useState, useEffect } from 'react'
import { storyblokEditable, type ISbStoryData } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Image as HeroImage, Button, Chip, Modal, ModalContent, useDisclosure, Link } from '@heroui/react'
import NextLink from 'next/link'
import { Typography } from './typography'
import AuthGate from '@components/gate'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

// Interface per il contenuto della storia Business quando risolta via resolve_relations
interface BusinessContent {
  title?: string
  area?: string
  website?: { url?: string } | string
  description?: string
  address?: string
  email?: string
  logo?: { filename?: string }
}

// Interface tipizzata per il blocco Job con la relazione aziendale espansa
export interface ResolvedJobBlok {
  _uid: string
  component: 'job'
  title: string
  company?: ISbStoryData<BusinessContent> | Record<string, any> | string
  location?: string
  skills?: string[]
  description?: string
  company_email?: string
}

interface JobProps {
  blok: ResolvedJobBlok
  fullSlug?: string
}

export default function Job({ blok, fullSlug }: JobProps) {
  const bodyTypography = Typography({})

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  const [applyError, setApplyError] = useState('')
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  useEffect(() => {
    const rawUser = getCookie('miia_user')
    if (rawUser) {
      setIsAuthenticated(true)
    }
  }, [])

  const businessStory = typeof blok.company === 'object' ? blok.company : null
  const companyContent = businessStory?.content as BusinessContent | undefined

  const companyName = companyContent?.title || businessStory?.name || 'Azienda Partner'
  const logoUrl = companyContent?.logo?.filename || ''
  const companyArea = companyContent?.area || ''

  // Gestione sicura del campo website multilink
  const rawWebsite = companyContent?.website
  const companyWebsite = typeof rawWebsite === 'object' ? rawWebsite?.url : (typeof rawWebsite === 'string' ? rawWebsite : '')

  const companyDescription = companyContent?.description || ''
  const companyAddress = companyContent?.address || ''

  const contactEmail = companyContent?.email || blok.company_email || 'info@miia.it'
  const skills: string[] = Array.isArray(blok.skills) ? blok.skills : []

  const handleApply = async () => {
    if (!isAuthenticated) {
      onOpen()
      return
    }

    setIsApplying(true)
    setApplyError('')

    // Estrazione dell'URL completo della pagina corrente per trasmetterlo alla mail di notifica
    const currentJobUrl = typeof window !== 'undefined' ? window.location.href : ''

    try {
      const res = await fetch('/api/job/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobTitle: blok.title,
          companyName: companyName,
          companyEmail: contactEmail,
          jobUrl: currentJobUrl, // 👈 Link dell'inserzione inviato all'API
        }),
      })

      if (res.ok) {
        setHasApplied(true)
      } else {
        const data = await res.json()
        setApplyError(data.message || 'Si è verificato un errore.')
      }
    } catch (err) {
      setApplyError('Errore di connessione. Riprova più tardi.')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <article {...storyblokEditable(blok as any)} className="w-full bg-white dark:bg-neutral-50 text-neutral-900">
      <section className="relative flex w-full flex-col bg-neutral-900 text-white pt-10 pb-16 shadow-lg">
        <div className="relative z-20 mx-auto w-full max-w-[1280px] px-6 pb-8">
          <NextLink
            href="/lavoro/inserzioni"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400 transition-colors hover:text-white"
          >
            <i className="iconoir-arrow-left text-base" />
            Torna alle inserzioni
          </NextLink>
        </div>

        <div className="relative z-20 mx-auto w-full max-w-[1280px] px-6">
          <div className="max-w-4xl space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              {logoUrl ? (
                <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white p-2 shadow-sm flex-shrink-0">
                  <HeroImage
                    removeWrapper
                    src={logoUrl}
                    alt={companyName}
                    className="h-full w-full object-contain"
                    radius="none"
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-800 text-2xl font-bold flex-shrink-0 text-white shadow-sm">
                  {companyName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-sm font-bold uppercase tracking-widest text-neutral-300">
                  {companyName}
                </span>
              </div>
            </div>

            {typeof blok.title === 'string' && blok.title.trim() !== '' && (
              <h1 className="font-serif break-words text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
                {blok.title}
              </h1>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1280px] px-6 py-12 md:py-20">
        <div className="grid grid-cols-1 gap-x-12 gap-y-3 lg:grid-cols-12">

          {/* Main Column */}
          <div className="lg:col-span-8">
            <div className="pb-8 space-y-4">
              <h2 className="text-2xl font-bold text-neutral-900 mb-4">
                Dettagli della posizione
              </h2>
              {blok.location && (
                <div className="mb-4">
                  <span className="text-sm font-medium flex items-center gap-1.5 text-neutral-600 mt-1">
                    <i className="iconoir-map-pin text-2xl" />
                    {blok.location}
                  </span>
                </div>
              )}
              {skills.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {skills.map((skill) => (
                    <Chip
                      key={skill}
                      size="sm"
                      variant="flat"
                      className="bg-neutral-100 text-neutral-700 font-medium capitalize px-3"
                    >
                      {skill.replace('_', ' ')}
                    </Chip>
                  ))}
                </div>
              )}
              {typeof blok.description === 'string' && blok.description.trim() !== '' ? (
                <div className="text-base sm:text-lg text-neutral-700 prose prose-neutral max-w-none leading-relaxed">
                  {compiler(blok.description, {
                    overrides: bodyTypography,
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center bg-neutral-50">
                  <p className="text-neutral-500 italic">Nessuna descrizione dettagliata fornita.</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Laterale */}
          <aside className="lg:col-span-4">
            <div className="sticky top-24 rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/50 p-6 sm:p-8 space-y-8">

              {/* Informazioni Azienda */}
              <div>
                <h3 className="font-bold text-xs uppercase tracking-widest text-neutral-400 mb-5">
                  Informazioni Azienda
                </h3>

                <div className="space-y-1 mb-4">
                  <p className="font-semibold text-base">{companyName}</p>
                  {companyAddress && (
                    <p className="font-medium">{companyAddress}</p>
                  )}
                </div>
                <div className='space-y-2'>
                  {companyArea && (
                    <p className="capitalize font-medium">{companyArea}</p>
                  )}
                  {companyDescription && (
                    <div className="text-neutral-600 text-sm leading-relaxed line-clamp-5">
                      {companyDescription}
                    </div>
                  )}
                  {companyWebsite && (
                    <Link
                      href={companyWebsite.startsWith('http') ? companyWebsite : `https://${companyWebsite}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="primary"
                      className='font-smibold'
                    >
                      Visita il sito web
                      <i className="iconoir-arrow-right" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Call to Action della Candidatura */}
              <div className="pt-6 border-t border-neutral-100">
                <h3 className="font-bold text-lg text-neutral-900 mb-3">
                  Come candidarsi
                </h3>

                {!hasApplied ? (
                  <>
                    <p className="text-sm text-neutral-600 leading-relaxed mb-6">
                      Invia il tuo CV aggiornato e il Portfolio lavori direttamente al referente aziendale per procedere con la selezione.
                    </p>

                    <Button
                      onPress={handleApply}
                      isLoading={isApplying}
                      className="w-full bg-[#009245] text-white font-medium h-12 rounded-xl text-base shadow-md shadow-[#009245]/20 hover:opacity-90 transition-opacity"
                    >
                      {isAuthenticated ? 'Invia Candidatura' : 'Accedi per candidarti'}
                    </Button>

                    {applyError && (
                      <div className="mt-4 rounded-xl bg-amber-50 p-3 text-center border border-amber-200">
                        <p className="text-xs text-amber-700 font-semibold">{applyError}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-[#009245]/10 border border-[#009245]/20 rounded-2xl p-6 text-center mt-4">
                    <i className="iconoir-check-circle text-4xl text-[#009245] mb-3 inline-block" />
                    <p className="text-sm font-semibold text-[#009245]">
                      Candidatura inviata!
                    </p>
                    <p className="text-xs text-[#009245]/70 mt-1">Abbiamo ricevuto la tua candidatura.</p>
                  </div>
                )}
              </div>

            </div>
          </aside>

        </div>
      </div >

      {/* Modale Login / Registrazione se l'utente tenta di candidarsi senza sessione */}
      < Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur" >
        <ModalContent>
          {() => (
            <div className="p-4">
              <AuthGate
                onSuccess={() => {
                  setIsAuthenticated(true)
                }}
                redirectUrl={fullSlug ? `/${fullSlug}` : undefined}
              />
            </div>
          )}
        </ModalContent>
      </Modal >
    </article >
  )
}