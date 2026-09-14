// Codice ripulito per [...slug].tsx
import type { GetStaticPropsContext } from 'next'
import {
  getStoryblokApi,
  StoryblokComponent,
  useStoryblokState,
  type ISbStoryData,
} from '@storyblok/react'
import type { Page as PageBlok } from '@types'
import { getCachedData, type GlobalData } from '@modules/cache'
import { relations } from '@config/relations'
import { optimizePayload } from '@modules/sanitize'
import { getStoryblokVersion } from '@config/version'
import { OverLink } from '@components/overlink'

const EXCLUDING_SLUGS = ['home', 'splash']

interface PageStoryProps {
  story: ISbStoryData<PageBlok> | null
  data: GlobalData
  draft: boolean
}

export default function PageStory({ story, data, draft }: PageStoryProps) {
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  return (
    <div className="relative min-h-screen overflow-hidden">
      {page && page.content ? (
        <StoryblokComponent blok={page.content} fullSlug={page.full_slug} />
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-500 text-sm">Contenuto non disponibile.</p>
        </div>
      )}
      <OverLink />
    </div>
  )
}

export const getStaticProps = async ({ params, draftMode }: GetStaticPropsContext) => {
  const version = getStoryblokVersion()
  const isDraft = version === 'draft' || !!draftMode

  const slugArray = params?.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : []
  const slug = slugArray.join('/') || 'home'

  if (slug.startsWith('_next') || slug.includes('.json') || slug.startsWith('.well-known')) {
    return { notFound: true }
  }

  const storyblokApi = getStoryblokApi()
  let storyResult = null

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
          in: 'page,enroll,project,article',
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