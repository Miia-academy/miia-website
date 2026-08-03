// @modules/cache.ts
import { getStoryblokApi } from '@storyblok/react'
import type { Course, Event, Location, Article, Job, Person, Project } from '@types'

export type ProcessedCourse = Course & {
  uuid: string
}

export type ProcessedEvent = Event & {
  uuid: string
  name: string
  isOpenday: boolean
}

export type ProcessedJob = Job & {
  uuid: string
  tagList: string[]
}

export type ProcessedArticle = Article & {
  uuid: string
  fullSlug: string
  createdAt: string
  tagList: string[]
}

export type ProcessedLocation = Location & {
  uuid?: string
}

export type ProcessedPerson = Person & {
  uuid: string
  tagList: string[]
}

export type ProcessedProject = Project & {
  uuid?: string
  fullSlug: string
  firstPublishedAt: string
  tagList: string[]
}

export type GlobalData = {
  courses: ProcessedCourse[]
  events: ProcessedEvent[]
  locations: ProcessedLocation[]
  articles: ProcessedArticle[]
  jobs: ProcessedJob[]
  persons: ProcessedPerson[]
  projects: ProcessedProject[]
}

let cachedData: GlobalData | null = null

export async function getCachedData(version: 'draft' | 'published' = 'published'): Promise<GlobalData> {
  const storyblokApi = getStoryblokApi()

  try {
    // Eseguiamo le chiamate REST in parallelo per le nostre collezioni
    const [
      coursesRes, eventsRes, locationsRes, articlesRes, jobsRes, personsRes, projectsRes
    ] = await Promise.all([
      storyblokApi.getStories({ version, content_type: 'course', per_page: 100 }),
      storyblokApi.getStories({ version, content_type: 'event', per_page: 100, sort_by: 'content.date:asc' }),
      storyblokApi.getStories({ version, content_type: 'location', per_page: 100 }),
      storyblokApi.getStories({ version, content_type: 'article', per_page: 100, sort_by: 'first_published_at:desc' }),
      storyblokApi.getStories({ version, content_type: 'job', per_page: 100 }),
      storyblokApi.getStories({ version, content_type: 'person', per_page: 100, sort_by: 'content.title:asc' }),
      storyblokApi.getStories({ version, content_type: 'project', per_page: 100, sort_by: 'first_published_at:desc' })
    ])

    // Normalizziamo le risposte REST applicando il cast (as Tipo) direttamente su s.content
    const courses: ProcessedCourse[] = coursesRes.data.stories.map((s: any) => ({
      ...(s.content as Course),
      uuid: s.uuid,
    }))

    const events: ProcessedEvent[] = eventsRes.data.stories.map((s: any) => ({
      ...(s.content as Event),
      uuid: s.uuid,
      name: s.name,
      isOpenday: Boolean(s.name?.startsWith('openday-')),
    }))

    const locations: ProcessedLocation[] = locationsRes.data.stories.map((s: any) => ({
      ...(s.content as Location),
      uuid: s.uuid,
    }))

    const articles: ProcessedArticle[] = articlesRes.data.stories.map((s: any) => ({
      ...(s.content as Article),
      uuid: s.uuid,
      fullSlug: s.full_slug ? `/${s.full_slug}` : '#',
      slug: s.slug,
      createdAt: s.first_published_at || s.created_at,
      tagList: s.tag_list || [],
    }))

    const jobs: ProcessedJob[] = jobsRes.data.stories.map((s: any) => ({
      ...(s.content as Job),
      uuid: s.uuid,
      fullSlug: s.full_slug ? `/${s.full_slug}` : '#',
      tagList: s.tag_list || [],
    }))

    const persons: ProcessedPerson[] = personsRes.data.stories.map((s: any) => ({
      ...(s.content as Person),
      uuid: s.uuid,
      name: s.content?.title || s.name || '',
      title: s.content?.title || s.name || '',
      fullSlug: s.full_slug ? `/${s.full_slug}` : '#',
      tagList: s.tag_list || [],
    }))

    const projects: ProcessedProject[] = projectsRes.data.stories.map((s: any) => ({
      ...(s.content as Project),
      name: s.name,
      slug: s.slug,
      fullSlug: s.full_slug ? `/${s.full_slug}` : '#',
      firstPublishedAt: s.first_published_at,
      tagList: s.tag_list || [],
    }))

    return { courses, events, locations, articles, jobs, persons, projects }
  } catch (error) {
    console.error('❌ Errore durante il fetching REST in getCachedData:', error)
    return { courses: [], events: [], locations: [], articles: [], jobs: [], persons: [], projects: [] }
  }
}