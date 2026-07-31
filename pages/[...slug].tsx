import type { Location as LocationBlok, Event as EventBlok } from '@types'
import { storyblokApi } from '@modules/storyblokApi'
import { useMemo } from 'react'
import {
  ISbStoryData,
  useStoryblokState,
  StoryblokComponent,
} from '@storyblok/react'
import { CachedDataProps, getCachedData } from '@modules/cache'

const excluding_slugs = ['home', 'splash', 'blog/']

const relations = [
  'page.header',
  'page.footer',
  'aside.courses',
  'aside.enroll',
  'aside.contact',
  'course.location',
  'form.alias',
  'article.alias',
  'article.author',
  'person.alias',
  'course.alias',
  'event.alias',
  'event.form',
  'location.alias',
  'alias.form',
  'map.locations',
  'background.author',
]

export interface EventItem {
  content: EventBlok
  name: string
}

export interface LocationItem {
  content: LocationBlok
  uuid: string
}

interface PageStoryProps {
  story: ISbStoryData
  cached: CachedDataProps
}

export interface Opendays {
  fashion: EventBlok[]
  interior: EventBlok[]
}

export default function PageStory({ story, cached }: PageStoryProps) {
  // TODO needs to adjust cached data
  // 1. Gestione dello stato in tempo reale per Storyblok Visual Editor
  const page = useStoryblokState(story, {
    resolveRelations: relations,
    preventClicks: true,
  })

  // 2. Calcolo dei dati Opendays puro con useMemo (Previene Side-Effects e Memory Leaks in React 19)
  const opendays = useMemo<Opendays>(() => {
    const result: Opendays = { fashion: [], interior: [] }

    events.forEach((event) => {
      if (event.name?.startsWith('openday-interni')) {
        result.interior.push(event.content)
      } else if (event.name?.startsWith('openday-moda')) {
        result.fashion.push(event.content)
      }
    })

    return result
  }, [events])

  if (!page || !page.content) return null

  return (
    <StoryblokComponent
      locations={locations}
      events={events}
      opendays={opendays}
      blok={page.content}
    />
  )
}

export async function getStaticProps({ params }: any) {
  const slugArray = params?.slug ? (Array.isArray(params.slug) ? params.slug : [params.slug]) : []
  const slug = `/${slugArray.join('/')}`

  const variables = { slug, relations: relations.join(',') }
  const query = `
    query ($slug: ID!, $relations: String) {
      ContentNode(
        id: $slug,
        resolve_relations: $relations
      ) {
        id
        slug
        content
        first_published_at
        tag_list
      }
    }
  `
  const cachedData = await getCachedData()

  try {
    const data = await storyblokApi({ query, variables })


    // Se la storia non esiste, restituisci 404 pulito
    if (!data?.ContentNode) {
      return {
        notFound: true,
      }
    }

    return {
      props: {
        story: data.ContentNode,
        data: cachedData,
      },
      revalidate: 3600,
    }
  } catch (error) {
    console.error('Error fetching Storyblok data:', error)
    return {
      notFound: true,
    }
  }
}

export async function getStaticPaths() {
  const variables = { excluding_slugs: excluding_slugs.join(',') }
  const query = `
    query ($excluding_slugs: String) {
      ContentNodes(
        excluding_slugs: $excluding_slugs,
        filter_query: {
          component: {
            in: "page,enroll"
          }
        }
      ) {
        items {
          full_slug
        }
      }
    }
  `

  try {
    const slugs = await storyblokApi({ query, variables })
    const items = slugs?.ContentNodes?.items || []

    const paths = items.map(
      ({ full_slug }: { full_slug: string }) => `/${full_slug}`
    )

    return {
      paths,
      fallback: 'blocking',
    }
  } catch (error) {
    console.error('Error fetching static paths:', error)
    return {
      paths: [],
      fallback: 'blocking',
    }
  }
}