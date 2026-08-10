import { useState, useEffect } from 'react'
import type { GetStaticPropsContext } from 'next'
import {
  getStoryblokApi,
  StoryblokComponent,
  useStoryblokState,
  type ISbStoryData,
} from '@storyblok/react'
import type { Page as PageBlok } from '@types'
import { getCachedData, type GlobalData } from '@modules/cache'
import { DataProvider } from '@modules/context'
import { relations } from '@config/relations'
import { optimizePayload } from '@modules/sanitize'
import { Card, CardBody, Input, Button } from '@heroui/react'
import { getStoryblokVersion } from '@config/version'

const excluding_slugs = ['home', 'splash']

interface PageStoryProps {
  story: ISbStoryData<PageBlok> | null
  data: GlobalData
  draft: boolean
}

// Helper utility per accedere ai cookie nel browser lato client
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

export default function PageStory({ story, data, draft }: PageStoryProps) {
  // Abilita il real-time visual editor di Storyblok
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [mounted, setMounted] = useState<boolean>(false)

  // Stati per il form di Login / Paywall
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [sent, setSent] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [showPaywall, setShowPaywall] = useState<boolean>(false)

  // Check login istantaneo lato client tramite cookie 'miia_user' (Zero latenza)
  useEffect(() => {
    setMounted(true)
    const rawUserCookie = getCookie('miia_user')
    if (rawUserCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawUserCookie))
        if (parsed?.email) {
          setIsAuthenticated(true)
          setUserEmail(parsed.email)
        }
      } catch (e) {
        // Fallback per cookie memorizzati come stringa grezza
        setIsAuthenticated(true)
      }
    }
  }, [])

  if (!page || !page.content) return null

  // Verifica se la pagina richiede autenticazione tramite il flag di Storyblok
  const requiresAuth = (page.content as any)?.auth === true
  const isLocked = requiresAuth && mounted && !isAuthenticated && !draft
  // TODO Eventualmente testare: 
  // const isStoryblokIframe = typeof window !== 'undefined' && window.location.search.includes('_storyblok')

  // Effetto di dissolvenza/blur per la comparsa del Paywall
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => setShowPaywall(true), 1000)
      return () => clearTimeout(timer)
    } else {
      setShowPaywall(false)
    }
  }, [isLocked])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const currentPath = page.full_slug ? `/${page.full_slug}` : '/'
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          redirectUrl: currentPath,
        }),
      })

      if (res.ok) {
        setSent(true)
      } else {
        const result = await res.json()
        setErrorMsg(result.message || 'Errore durante la verifica.')
      }
    } catch (err) {
      console.error('[PageStory Auth Error]', err)
      setErrorMsg('Errore di connessione al server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DataProvider data={data}>
      <div className="relative min-h-screen overflow-hidden">
        {/* Layout della pagina: applica il blur se il contenuto è bloccato */}
        <div
          className={`transition-[filter] duration-1000 ease-in-out ${showPaywall
            ? 'blur-lg select-none pointer-events-none aria-hidden'
            : ''
            }`}
          aria-hidden={showPaywall}
        >
          <StoryblokComponent blok={page.content} fullSlug={page.full_slug} />
        </div>

        {/* Paywall Overlay */}
        {isLocked && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 transition-opacity duration-1000 ease-in-out ${showPaywall ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
          >
            <Card className="w-full max-w-[340px] sm:max-w-[400px] p-4 sm:p-6 shadow-2xl border border-neutral-200 dark:border-neutral-800">
              <CardBody className="gap-5 text-center px-0 sm:px-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  Accedi per visualizzare i contenuti della pagina
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Le inserzioni e le risorse sono riservate agli studenti della scuola.
                  Inserisci l'email usata durante l'iscrizione per ricevere il Magic Link di accesso.
                </p>

                {sent ? (
                  <div className="p-4 bg-success-50 text-success-700 rounded-medium text-sm font-medium">
                    📩 Magic Link inviato! Controlla la tua casella di posta.
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-2">
                    <Input
                      type="email"
                      label="Indirizzo email"
                      placeholder="studente@example.it"
                      value={email}
                      onValueChange={setEmail}
                      isRequired
                      variant="bordered"
                      isInvalid={!!errorMsg}
                      errorMessage={errorMsg}
                    />
                    <Button
                      type="submit"
                      color="primary"
                      isLoading={loading}
                      className="font-medium h-12 text-md mt-1"
                    >
                      Invia Magic Link
                    </Button>
                  </form>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </DataProvider>
  )
}

export const getStaticProps = async ({ params, draftMode }: GetStaticPropsContext) => {
  // Rileva 'draft' o 'published' in base all'ambiente Vercel/Locale
  const version = getStoryblokVersion()
  const isDraft = version === 'draft' || !!draftMode

  const slugArray = params?.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : []
  const slug = slugArray.join('/') || 'home'

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  // Fetching con la versione corretta!
  try {
    const response = await storyblokApi.getStory(slug, {
      version, // 👈 Passa 'draft' se sei su develop/preview!
      resolve_relations: relations.join(','),
    })
    storyResult = response.data ? response.data.story : null
  } catch (error) {
    return { notFound: true }
  }
  const globalData = await getCachedData(version)

  const safeStory = isDraft
    ? JSON.parse(JSON.stringify(storyResult))
    : optimizePayload(storyResult)

  const safeGlobalData = optimizePayload(globalData)

  return {
    props: {
      story: safeStory,
      data: safeGlobalData,
      draft: isDraft,
    },
    revalidate: isDraft ? 1 : 3600,
  }
}

export const getStaticPaths = async () => {
  const storyblokApi = getStoryblokApi()
  const version = getStoryblokVersion() // 👈 'draft' per develop, 'published' per main

  try {
    const { data } = await storyblokApi.getStories({
      version, // 👈 Cerca tutte le storie (anche draft se in preview)
      per_page: 100,
      filter_query: {
        component: {
          in: 'page,enroll,project,article',
        },
      },
    })

    const paths = data.stories
      .filter((story: ISbStoryData) => !excluding_slugs.includes(story.full_slug))
      .map((story: ISbStoryData) => {
        const slug = story.full_slug.split('/')
        return { params: { slug } }
      })

    return {
      paths,
      fallback: 'blocking', // 👈 Mantieni 'blocking' così se viene creata una nuova story draft dopo la build, Next.js la genererà on-demand al primo hit!
    }
  } catch (error) {
    console.error('Errore durante il fetching degli static paths:', error)
    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}