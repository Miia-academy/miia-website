// Codice ripulito per index.tsx
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

type HomeProps = {
  story: ISbStoryData<PageBlok> | null
  data: GlobalData
  draft: boolean
}

export default function Home({ story, data, draft }: HomeProps) {
  const page = useStoryblokState(story, {
    resolveRelations: relations.join(','),
    preventClicks: true,
  })

  if (!page || !page.content) return null

  return (
    <div className="relative min-h-screen overflow-hidden">
      <StoryblokComponent blok={page.content} />
      <OverLink />
    </div>
  )
}

export const getStaticProps = async ({ draftMode }: GetStaticPropsContext) => {
  const version = getStoryblokVersion()
  const isDraft = version === 'draft' || !!draftMode

  const storyblokApi = getStoryblokApi()
  let storyResult = null

  try {
    const home = await storyblokApi.getStory('home', {
      version,
      resolve_relations: relations.join(','),
    })
    storyResult = home.data ? home.data.story : null
  } catch (error) {
    storyResult = null
  }

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