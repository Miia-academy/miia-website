import type { GetStaticPropsContext } from 'next'
import {
  getStoryblokApi,
  StoryblokComponent,
  useStoryblokState,
  type ISbStoryData,
} from '@storyblok/react'
import { getCachedData, type GlobalData } from '@modules/cache'
import { DataProvider } from '@modules/context'
import { relations } from '@config/relations'

// Slug che vogliamo escludere dalla generazione statica automatica
const excluding_slugs = ["home", "splash", "blog/"]

interface PageStoryProps {
  story: ISbStoryData | null
  data: GlobalData
  draft: boolean
}

export default function PageStory({ story, data, draft }: PageStoryProps) {
  // Abilita il real-time visual editor di Storyblok quando sei nell'iframe
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

export const getStaticProps = async ({ params, draftMode }: GetStaticPropsContext) => {
  // 1. Definiamo se siamo in draft in base all'ambiente o al flag nativo di Next.js
  const isDraft = process.env.NODE_ENV === "development" || !!draftMode
  const version = isDraft ? "draft" : "published"

  const slugArray = params?.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : []
  const slug = slugArray.join('/') || 'home'

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  try {
    // 2. Fetch della pagina corrente (REST)
    const response = await storyblokApi.getStory(slug, {
      version,
      resolve_relations: relations.join(','),
    })
    storyResult = response.data ? response.data.story : null
  } catch (error) {
    console.error(`Page ${slug} non trovata su Storyblok`)
    return { notFound: true }
  }

  // 3. Fetch dei dati globali passando la versione corretta alla cache
  const globalData = await getCachedData(version)

  // 4. "Silver Bullet": sanitizzazione JSON per rimuovere gli undefined.
  // Next.js va in crash se provi a passare undefined come prop in getStaticProps.
  const safeStory = JSON.parse(JSON.stringify(storyResult))
  const safeGlobalData = JSON.parse(JSON.stringify(globalData))

  return {
    props: {
      story: safeStory,
      data: safeGlobalData,
      draft: isDraft,
    },
    // Se siamo in draft ricarichiamo subito (1s), altrimenti ISR ogni ora
    revalidate: isDraft ? 1 : 3600,
  }
}

export const getStaticPaths = async () => {
  const storyblokApi = getStoryblokApi()

  try {
    // Raccogliamo le pagine pubblicate usando REST
    const { data } = await storyblokApi.getStories({
      version: 'published',
      per_page: 100, // Alzare se si superano le 100 pagine base
      filter_query: {
        component: {
          in: 'page,enroll' // Generiamo i path solo per i componenti principali
        }
      }
    })

    const paths = data.stories
      .filter((story: ISbStoryData) => !excluding_slugs.includes(story.full_slug))
      .map((story: ISbStoryData) => {
        // Next.js si aspetta un array di segmenti per le rotte catch-all [...slug]
        const slug = story.full_slug.split('/')
        return { params: { slug } }
      })

    return {
      paths,
      fallback: 'blocking', // Le nuove pagine verranno generate on-demand alla prima visita
    }
  } catch (error) {
    console.error('Errore durante il fetching degli static paths:', error)
    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}