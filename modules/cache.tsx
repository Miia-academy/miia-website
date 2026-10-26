// @modules/cache.ts
import { getStoryblokApi } from '@storyblok/react'
import type { Course, Event, Location } from '@types'
import { relations } from '@config/relations'
import { normalizeBanner, normalizeSiteBanners, type BannerData } from '@modules/banner'
import { parsePriceList } from '@modules/enrollment/catalog'
import { publicPrices, type PublicPrices } from '@modules/aside'

export type ProcessedCourse = Course & { uuid: string; fullSlug: string }
export type ProcessedEvent = Event & { uuid: string; slug: string; name: string; isOpenday: boolean }
export type ProcessedLocation = Location & { uuid?: string }

// Dati leggeri per le card (minimizza il payload < 128 kB)
export type ProcessedArticle = {
  uuid: string
  title?: string
  category?: string
  description?: string
  hidden?: boolean
  cover_image?: any
  image?: any
  date?: string
  fullSlug: string
  slug?: string
  createdAt: string
  tagList: string[]
}

export type ProcessedPerson = {
  uuid: string
  name: string
  title: string
  role?: string
  image?: any
  description?: string
  hide?: string[]
  video?: string
  fullSlug: string
  tagList: string[]
}

export type ProcessedProject = {
  uuid?: string
  name: string
  slug: string
  fullSlug: string
  firstPublishedAt: string
  tagList: string[]
  title?: string
  cover_image?: any
  cover?: any
}

export type Competenza = { name: string; value: string }

export type GlobalData = {
  courses: ProcessedCourse[]
  events: ProcessedEvent[]
  locations: ProcessedLocation[]
  articles: ProcessedArticle[]
  persons: ProcessedPerson[]
  projects: ProcessedProject[]
  competenze: Competenza[]
  // Public price list for the course pages; null if the "listino" datasource is incomplete.
  prices?: PublicPrices | null
  // Site banners; null if the switch is off or the list is not published.
  banner?: BannerData | null
}

/**
 * Banner switch: in production they turn on with BANNER_SITO=on;
 * in Vercel previews and locally they are always on, to try them.
 */
export function bannerAttivi(): boolean {
  return process.env.BANNER_SITO === 'on' || process.env.VERCEL_ENV === 'preview' || process.env.NODE_ENV === 'development'
}

/** All banners of the banner/ folder with their form, and the "Banner di tutto il sito" list. */
export async function getBannerData(version: 'draft' | 'published'): Promise<BannerData | null> {
  if (!bannerAttivi()) return null
  const storyblokApi = getStoryblokApi()
  try {
    const [allRes, siteRes] = await Promise.all([
      storyblokApi.getStories({
        version,
        starts_with: 'banner/',
        content_type: 'banner',
        per_page: 100,
        // "modulo" is the field's name before 22/10/2026, until the content is migrated
        resolve_relations: 'banner.form,banner.modulo,form.alias',
      }),
      storyblokApi.getStory('banner/tutto-il-sito', { version }),
    ])
    return {
      all: allRes.data.stories.map((s: any) => ({ uuid: s.uuid, slug: s.full_slug, content: normalizeBanner(s.content) })),
      ...normalizeSiteBanners(siteRes.data?.story?.content),
    }
  } catch (error) {
    console.error('[Banner] Banner list not available:', error)
    return null
  }
}

// Sanitizza gli slug rimuovendo slash duplicati all'inizio ("//")
const formatSlug = (slug?: string): string => {
  if (!slug) return '#'
  return `/${slug.replace(/^\/+/, '')}`
}

export async function getCachedData(version: 'draft' | 'published' = 'published'): Promise<GlobalData> {
  const storyblokApi = getStoryblokApi()
  const resolveRelations = relations.join(',')

  try {
    const [
      coursesRes,
      eventsRes,
      locationsRes,
      articlesRes,
      personsRes,
      projectsRes,
      competenzeRes,
      listinoRes,
    ] = await Promise.all([
      storyblokApi.getStories({ version, content_type: 'course', per_page: 100, resolve_relations: resolveRelations }),
      storyblokApi.getStories({ version, content_type: 'event', per_page: 100, sort_by: 'content.date:asc', resolve_relations: resolveRelations }),
      storyblokApi.getStories({ version, content_type: 'location', per_page: 100, resolve_relations: resolveRelations }),
      storyblokApi.getStories({ version, content_type: 'article', per_page: 100, sort_by: 'first_published_at:desc', resolve_relations: resolveRelations }),
      storyblokApi.getStories({ version, content_type: 'person', per_page: 100, sort_by: 'content.title:asc', resolve_relations: resolveRelations }),
      storyblokApi.getStories({ version, content_type: 'project', per_page: 100, sort_by: 'first_published_at:desc', resolve_relations: resolveRelations }),
      storyblokApi.get('cdn/datasource_entries', { datasource: 'competenze' }),
      storyblokApi.get('cdn/datasource_entries', { datasource: 'listino', per_page: 100 }),
    ])
    const banner = await getBannerData(version)

    const courses: ProcessedCourse[] = coursesRes.data.stories.map((s: any) => ({
      ...(s.content as Course),
      uuid: s.uuid,
      fullSlug: s.full_slug,
    }))

    const events: ProcessedEvent[] = eventsRes.data.stories.map((s: any) => ({
      ...(s.content as Event),
      uuid: s.uuid,
      slug: s.slug,
      name: s.name,
      isOpenday: Boolean(s.name?.startsWith('openday-')),
    }))

    const locations: ProcessedLocation[] = locationsRes.data.stories.map((s: any) => ({
      ...(s.content as Location),
      uuid: s.uuid,
    }))

    const articles: ProcessedArticle[] = articlesRes.data.stories.map((s: any) => ({
      uuid: s.uuid,
      title: s.content?.title,
      category: s.content?.category,
      description: s.content?.description || s.content?.intro || '',
      hidden: s.content?.hidden,
      cover_image: s.content?.cover_image,
      image: s.content?.image || s.content?.cover_image,
      date: s.content?.date,
      fullSlug: formatSlug(s.full_slug),
      slug: s.slug,
      createdAt: s.first_published_at || s.created_at,
      tagList: s.tag_list || [],
    }))

    const persons: ProcessedPerson[] = personsRes.data.stories.map((s: any) => ({
      uuid: s.uuid,
      name: s.content?.title || s.name || '',
      title: s.content?.title || s.name || '',
      role: s.content?.role,
      image: s.content?.image,
      description: s.content?.description || '',
      hide: s.content?.hide || [],
      video: s.content?.video || '',
      fullSlug: formatSlug(s.full_slug),
      tagList: s.tag_list || [],
    }))

    const projects: ProcessedProject[] = projectsRes.data.stories.map((s: any) => ({
      uuid: s.uuid,
      name: s.name,
      slug: s.slug,
      fullSlug: formatSlug(s.full_slug),
      firstPublishedAt: s.first_published_at,
      tagList: s.tag_list || [],
      title: s.content?.title,
      cover_image: s.content?.cover_image || s.content?.cover,
      cover: s.content?.cover || s.content?.cover_image,
    }))

    const competenze: Competenza[] = competenzeRes.data.datasource_entries.map((e: any) => ({
      name: e.name,
      value: e.value,
    }))

    const prices = publicPrices(parsePriceList(listinoRes.data.datasource_entries || []))

    return { courses, events, locations, articles, persons, projects, competenze, prices, banner }
  } catch (error) {
    console.error('❌ Errore durante il fetching REST in getCachedData:', error)
    return { courses: [], events: [], locations: [], articles: [], persons: [], projects: [], competenze: [] }
  }
}