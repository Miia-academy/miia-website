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
import { getStoryblokVersion } from '@config/version'
import AuthGate from '@components/gate'

type HomeProps = {
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

export default function Home({ story, data, draft }: HomeProps) {
  // Abilita il real-time visual editor di Storyblok
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [userEmail, setUserEmail] = useState<string>('')
  const [mounted, setMounted] = useState<boolean>(false)
  const [showPaywall, setShowPaywall] = useState<boolean>(false)

  // Check login istantaneo lato client tramite cookie 'miia_user'
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

  // Controllo se anche la Homepage deve supportare l'autenticazione tramite Storyblok
  const requiresAuth = (page.content as any)?.auth === true
  const isLocked = requiresAuth && mounted && !isAuthenticated // TODO remove comment //&& !draft

  // Effetto di dissolvenza/blur per la comparsa del Paywall
  useEffect(() => {
    if (isLocked) {
      const timer = setTimeout(() => setShowPaywall(true), 400)
      return () => clearTimeout(timer)
    } else {
      setShowPaywall(false)
    }
  }, [isLocked])

  return (
    <DataProvider data={data}>
      <div className="relative min-h-screen overflow-hidden">
        {/* Layout della Homepage: applica il blur e disabilita gli eventi mouse se bloccata */}
        <div
          className={`transition-[filter,opacity] duration-700 ease-in-out ${showPaywall
            ? 'blur-xl select-none pointer-events-none aria-hidden opacity-40'
            : ''
            }`}
          aria-hidden={showPaywall}
        >
          <StoryblokComponent blok={page.content} />
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
      </div>
    </DataProvider>
  )
}

export const getStaticProps = async ({ draftMode }: GetStaticPropsContext) => {
  // Rileva 'draft' o 'published' in base all'ambiente Vercel/Locale
  const version = getStoryblokVersion()
  const isDraft = version === 'draft' || !!draftMode

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  // 1. Fetching della pagina root ("home") tramite API REST
  try {
    const home = await storyblokApi.getStory('home', {
      version, // Passa 'draft' per Preview/Develop e 'published' per Production
      resolve_relations: relations.join(','),
    })
    storyResult = home.data ? home.data.story : null
  } catch (error) {
    storyResult = null
  }

  // 2. Fallback: se "home" non esiste o fallisce, prova a cercare "splash"
  if (!storyResult) {
    try {
      const splash = await storyblokApi.getStory('splash', {
        version,
        resolve_relations: relations.join(','),
      })
      storyResult = splash.data ? splash.data.story : null
    } catch (error) {
      console.error('Nessuna pagina root trovata (né home né splash).')
      storyResult = null
    }
  }

  // 3. Fetching dei dati globali passando la versione corretta
  const globalData = await getCachedData(version)

  // 4. Ottimizzazione Payload
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
    // Revalidazione istantanea se in draft, ogni ora in produzione
    revalidate: isDraft ? 1 : 3600,
  }
}