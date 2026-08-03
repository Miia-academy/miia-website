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

// Slug da escludere dalla generazione statica automatica
const excluding_slugs = ['home', 'splash', 'blog/']

interface PageStoryProps {
  story: ISbStoryData | null
  data: GlobalData
  draft: boolean
}

export default function PageStory({ story, data, draft }: PageStoryProps) {
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  if (!page || !page.content) return null

  return (
    <DataProvider data={data}>
      <StoryblokComponent blok={page.content} fullSlug={page.full_slug} />
    </DataProvider>
  )
}

export const getStaticProps = async ({ params, draftMode }: GetStaticPropsContext) => {
  const isDraft = process.env.NODE_ENV === 'development' || !!draftMode
  const version = isDraft ? 'draft' : 'published'

  const slugArray = params?.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : []
  const slug = slugArray.join('/') || 'home'

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  try {
    const response = await storyblokApi.getStory(slug, {
      version,
      resolve_relations: relations.join(','),
    })
    storyResult = response.data ? response.data.story : null
  } catch (error) {
    console.error(`Page ${slug} non trovata su Storyblok`)
    return { notFound: true }
  }

  const globalData = await getCachedData(version)

  // Sanitizzazione JSON per rimuovere undefined ed evitare crash in Next.js
  const safeStory = JSON.parse(JSON.stringify(storyResult))
  const safeGlobalData = JSON.parse(JSON.stringify(globalData))

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

  try {
    const { data } = await storyblokApi.getStories({
      version: 'published',
      per_page: 100,
      filter_query: {
        component: {
          in: 'page,enroll,project',
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
      fallback: 'blocking',
    }
  } catch (error) {
    console.error('Errore durante il fetching degli static paths:', error)
    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}