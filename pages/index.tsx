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

type HomeProps = {
  // Passiamo PageBlok come Generic, tipizzando automaticamente story.content
  story: ISbStoryData<PageBlok> | null
  data: GlobalData
  draft: boolean
}

export default function Home({ story, data, draft }: HomeProps) {
  // Abilita il real-time visual editor di Storyblok
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  if (!page || !page.content) return null

  return (
    <DataProvider data={data}>
      <StoryblokComponent blok={page.content} />
    </DataProvider>
  )
}

export const getStaticProps = async ({ draftMode }: GetStaticPropsContext) => {
  // 1. Gestione del Draft Mode: in locale o con il draftMode di Next.js attivo usiamo "draft"
  const isDraft = process.env.NODE_ENV === 'development' || !!draftMode
  const version = isDraft ? 'draft' : 'published'

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  // 2. Fetching della pagina root ("home") tramite API REST
  try {
    const home = await storyblokApi.getStory('home', {
      version,
      resolve_relations: relations.join(','),
    })
    storyResult = home.data ? home.data.story : null
  } catch (error) {
    storyResult = null
  }

  // 3. Fallback: se "home" non esiste o fallisce, prova a cercare "splash"
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

  // 4. Fetching dei dati globali passando la versione al sistema di caching centralizzato
  const globalData = await getCachedData(version)

  // 5. La nuova "Silver Bullet" ottimizzata
  // Preserviamo gli 'undefined' parser se in draft (per mantenere attivi i tag _editable dell'editor),
  // altrimenti sfoltiamo radicalmente il JSON per far sparire il warning "large-page-data".
  const safeStory = isDraft
    ? JSON.parse(JSON.stringify(storyResult))
    : optimizePayload(storyResult)

  // I dati globali non interagiscono con il Visual Editor, quindi li puliamo sempre
  const safeGlobalData = optimizePayload(globalData)

  return {
    props: {
      story: safeStory,
      data: safeGlobalData,
      draft: isDraft,
    },
    // Revalidazione: istantanea se in draft, ogni ora in produzione
    revalidate: isDraft ? 1 : 3600,
  }
}