import { useState, useEffect, useMemo } from 'react'
import type { GetStaticPropsContext, GetStaticPathsContext } from 'next'
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
import { getStoryblokVersion } from '@config/version'
import AuthGate from '@components/gate'

const EXCLUDING_SLUGS = ['home', 'splash']

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
  const [showPaywall, setShowPaywall] = useState<boolean>(false)

  // Rilevamento se la pagina è aperta dentro il Visual Editor Iframe di Storyblok
  const isStoryblokIframe = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.location.search.includes('_storyblok') || window.location !== window.parent.location
  }, [])

  // Check autenticazione istantaneo lato client tramite cookie 'miia_user'
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
      } catch {
        // Fallback per cookie salvati come stringa grezza
        setIsAuthenticated(true)
      }
    }
  }, [])

  // Calcolo delle condizioni di blocco pagina
  const requiresAuth = useMemo(() => {
    if (!page?.content) return false
    return (page.content as any)?.auth === true || page.full_slug?.includes('nuova-inserzione')
  }, [page])

  // Non blocca se siamo in draft dentro l'Iframe dell'editor visivo di Storyblok
  const isLocked = requiresAuth && mounted && !isAuthenticated && !isStoryblokIframe // TODO remove comment //&& !draft

  // Dissolvenza e animazione dell'Overlay Paywall
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => setShowPaywall(true), 300)
      return () => clearTimeout(timer)
    } else {
      setShowPaywall(false)
    }
  }, [isLocked])

  return (
    <DataProvider data={data}>
      <div className="relative min-h-screen overflow-hidden">
        {page && page.content ? (
          <>
            {/* Layout della pagina: applica la sfocatura ed inabilita l'interazione se la pagina è bloccata */}
            <div
              className={`transition-[filter,opacity] duration-700 ease-in-out ${showPaywall
                ? 'select-none pointer-events-none opacity-30 blur-xl aria-hidden'
                : ''
                }`}
              aria-hidden={showPaywall}
            >
              <StoryblokComponent blok={page.content} fullSlug={page.full_slug} />
            </div>

            {/* Paywall Overlay con AuthGate integrato */}
            {isLocked && (
              <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-4 transition-opacity duration-700 ease-in-out ${showPaywall ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
              >
                <div className="w-full max-w-lg">
                  <AuthGate onSuccess={() => setIsAuthenticated(true)} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <p className="text-neutral-500 text-sm">Contenuto non disponibile.</p>
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

  // Fetching della story con la versione corretta
  try {
    const response = await storyblokApi.getStory(slug, {
      version,
      resolve_relations: relations.join(','),
    })
    storyResult = response.data ? response.data.story : null
  } catch (error) {
    console.error(`[PageStory Error] Impossibile recuperare lo slug: ${slug}`, error)
    return { notFound: true }
  }

  // Fetching dei dati globali per la cache e Context
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
  const version = getStoryblokVersion()

  try {
    const { data } = await storyblokApi.getStories({
      version,
      per_page: 100,
      filter_query: {
        component: {
          in: 'page,enroll,project,article,job',
        },
      },
    })

    const paths = data.stories
      .filter((story: ISbStoryData) => !EXCLUDING_SLUGS.includes(story.full_slug))
      .map((story: ISbStoryData) => {
        const slug = story.full_slug.split('/')
        return { params: { slug } }
      })

    return {
      paths,
      fallback: 'blocking',
    }
  } catch (error) {
    console.error('[getStaticPaths Error] Errore durante il fetching degli static paths:', error)
    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}