import { useState, useMemo } from 'react'
import { storyblokEditable } from '@storyblok/react'
import { useDataContext } from '@modules/context'
import { Button } from '@heroui/react'
import { tv } from 'tailwind-variants'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'

import ArticleCard from '@components/cards/articleCard'
import JobCard from '@components/cards/jobCard'
import PersonCard from '@components/cards/personCard'
import ProjectCard from '@components/cards/projectCard'

import type { Grid as GridBlokType } from '@types'

interface GridComponentProps {
  blok: GridBlokType & { dark?: boolean }
}

export default function Grid({ blok }: GridComponentProps) {
  const { articles, jobs, courses, events, persons, projects } = useDataContext()

  const pageSize = blok.limit ? parseInt(blok.limit as string, 10) : 6
  const [visibleCount, setVisibleCount] = useState(pageSize)

  const isDarkSection = !!blok.dark

  const filteredAndSortedItems = useMemo(() => {
    let rawItems: any[] = []
    const filterKey = (blok.filter || '').trim().toLowerCase()

    switch (blok.resource) {
      case 'articles':
        rawItems = articles.filter((art) => !art.hidden)
        if (filterKey) {
          rawItems = rawItems.filter(
            (art) =>
              art.tagList?.some((t: string) => t.toLowerCase() === filterKey) ||
              art.category?.toLowerCase() === filterKey
          )
        }
        rawItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        break
      case 'jobs':
        rawItems = [...jobs]
        if (filterKey) {
          rawItems = rawItems.filter(
            (job) =>
              job.area?.toLowerCase() === filterKey ||
              job.tagList?.some((t: string) => t.toLowerCase() === filterKey)
          )
        }
        break
      case 'courses':
        rawItems = [...courses]
        if (filterKey) {
          rawItems = rawItems.filter((course) => course.area?.toLowerCase() === filterKey)
        }
        break
      case 'events':
        rawItems = [...events]
        if (filterKey) {
          rawItems = rawItems.filter((event) => event.name?.toLowerCase().includes(filterKey))
        }
        rawItems.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
        break
      case 'persons':
        rawItems = [...persons]
        if (filterKey) {
          rawItems = rawItems.filter(
            (person) =>
              person.role?.toLowerCase().includes(filterKey) ||
              person.tagList?.some((t: string) => t.toLowerCase() === filterKey)
          )
        }
        rawItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        break
      case 'projects':
        rawItems = [...projects]
        if (filterKey) {
          rawItems = rawItems.filter((project) =>
            project.tagList?.some((t: string) => t.toLowerCase() === filterKey)
          )
        }
        rawItems.sort((a, b) => new Date(b.firstPublishedAt || 0).getTime() - new Date(a.firstPublishedAt || 0).getTime())
        break
      default:
        rawItems = articles
    }
    return rawItems
  }, [blok.resource, blok.filter, articles, jobs, courses, events, persons, projects])

  const parsedTitle = useMemo(() => {
    if (!blok.title) return ''
    return blok.title.replace(/{{total}}|{{count}}/g, filteredAndSortedItems.length.toString())
  }, [blok.title, filteredAndSortedItems.length])

  const parsedSubtitle = useMemo(() => {
    if (!blok.subtitle) return ''
    return blok.subtitle.replace(/{{total}}|{{count}}/g, filteredAndSortedItems.length.toString())
  }, [blok.subtitle, filteredAndSortedItems.length])

  const baseTypography = Typography({ theme: isDarkSection ? 'light' : 'dark' })

  const titleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h2,
    h2: baseTypography.h2,
    h3: baseTypography.h3,
  }

  const subtitleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h4,
    h2: baseTypography.h5,
    p: {
      component: ({ children }: any) => (
        <p className={isDarkSection ? 'text-neutral-300' : 'text-neutral-600'}>
          {children}
        </p>
      ),
    },
  }

  const visibleItems = useMemo(() => {
    return filteredAndSortedItems.slice(0, visibleCount)
  }, [filteredAndSortedItems, visibleCount])

  const hasMore = visibleCount < filteredAndSortedItems.length
  const handleLoadMore = () => setVisibleCount((prev) => prev + pageSize)

  const columnsClass = useMemo(() => {
    if (blok.resource === 'persons') {
      return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    }
    return {
      '2': 'grid-cols-1 md:grid-cols-2',
      '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    }[blok.columns || '3'] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }, [blok.resource, blok.columns])

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={wrapperClasses({ themeDark: isDarkSection })}
    >
      <div className={containerClasses()}>
        {(parsedTitle || parsedSubtitle) && (
          <div className={headerClasses()}>
            {parsedTitle && (
              <Markdown options={{ overrides: titleTypographyOverrides }}>
                {parsedTitle}
              </Markdown>
            )}
            {parsedSubtitle && (
              <Markdown options={{ overrides: subtitleTypographyOverrides }}>
                {parsedSubtitle}
              </Markdown>
            )}
          </div>
        )}

        <div className={`grid ${blok.resource === 'persons' ? 'gap-4 sm:gap-6' : 'gap-6 sm:gap-8'} ${columnsClass}`}>
          {(blok.resource === 'articles' || !blok.resource) &&
            visibleItems.map((article) => (
              <ArticleCard key={article.uuid} article={article} isDark={isDarkSection} />
            ))}

          {blok.resource === 'jobs' &&
            visibleItems.map((job) => (
              <JobCard key={job.uuid} job={job} isDark={isDarkSection} />
            ))}

          {blok.resource === 'persons' &&
            visibleItems.map((person) => (
              <PersonCard key={person.uuid} person={person} isDark={isDarkSection} />
            ))}

          {blok.resource === 'projects' &&
            visibleItems.map((project) => (
              <ProjectCard key={project.fullSlug || project.slug} project={project} isDark={isDarkSection} />
            ))}
        </div>

        {hasMore && (
          <div className="mt-12 flex justify-center">
            <Button
              color="primary"
              variant="flat"
              size="lg"
              onPress={handleLoadMore}
              className="px-8 font-medium"
            >
              Carica altri ({filteredAndSortedItems.length - visibleCount})
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

const wrapperClasses = tv({
  base: 'w-full py-12 md:py-16 lg:py-24 transition-colors',
  variants: {
    themeDark: {
      true: 'dark text-foreground bg-background',
      false: 'light bg-background text-foreground',
    },
  },
})

const containerClasses = tv({
  base: 'max-w-[1280px] mx-auto px-6 md:px-10',
})

const headerClasses = tv({
  base: 'mb-10 space-y-3 text-center md:text-left',
})