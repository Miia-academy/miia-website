// components/grid/index.tsx
import { useState, useMemo } from 'react'
import { storyblokEditable } from '@storyblok/react'
import { useDataContext } from '@modules/context'
import { Button } from '@components/ui/button'
import { tv } from 'tailwind-variants'

import ArticleCard from '@components/cards/articleCard'
import PersonCard from '@components/cards/personCard'
import ProjectCard from '@components/cards/projectCard'

import GridHeading from './heading'
import FilterGroup from './filters'
import { authorOptions, byVisibility, filterKeys, gridControls, hasTag, tagLabel, tagOptions } from '@modules/grid'

import type { Grid as GridBlokType } from '@types'

interface GridComponentProps {
  blok: GridBlokType & { dark?: boolean }
}

export default function Grid({ blok }: GridComponentProps) {
  const contextData = useDataContext()
  const articles = contextData?.articles || []
  const courses = contextData?.courses || []
  const events = contextData?.events || []
  const persons = contextData?.persons || []
  const projects = contextData?.projects || []

  const pageSize = blok.limit ? parseInt(blok.limit as string, 10) : 6
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [activeTag, setActiveTag] = useState('')
  const [activeAuthor, setActiveAuthor] = useState('')

  const isDarkSection = !!blok.dark

  const filteredAndSortedItems = useMemo(() => {
    let rawItems: any[] = []
    const filterKey = (blok.filter || '').trim().toLowerCase()
    const keys = filterKeys(blok.filter)

    switch (blok.resource) {
      // Empty type: articles, like the cards rendered below
      case '':
      case undefined:
      case 'articles':
        rawItems = byVisibility(articles, blok.visibility)
        if (keys.length) {
          rawItems = rawItems.filter((art) =>
            keys.some((key) => hasTag(art, key) || art.category?.toLowerCase() === key)
          )
        }
        rawItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        break

      case 'courses':
        rawItems = [...courses]
        if (filterKey) rawItems = rawItems.filter((course) => course.area?.toLowerCase() === filterKey)
        break

      case 'events':
        rawItems = [...events]
        if (filterKey) rawItems = rawItems.filter((event) => event.name?.toLowerCase().includes(filterKey))
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
        if (keys.length) rawItems = rawItems.filter((project) => keys.some((key) => hasTag(project, key)))
        rawItems.sort((a, b) => new Date(b.firstPublishedAt || 0).getTime() - new Date(a.firstPublishedAt || 0).getTime())
        break

      default:
        rawItems = []
    }
    return rawItems
  }, [blok.resource, blok.filter, blok.visibility, articles, courses, events, persons, projects])

  // Interactive filters chosen by the editor; each one shows only when it has at least two values
  const controls = useMemo(() => gridControls(blok.controls), [blok.controls])
  const isArticles = !blok.resource || blok.resource === 'articles'
  const tags = useMemo(
    () => (controls.includes('tags') ? tagOptions(filteredAndSortedItems) : []),
    [controls, filteredAndSortedItems]
  )
  const authors = useMemo(
    () => (isArticles && controls.includes('authors') ? authorOptions(filteredAndSortedItems) : []),
    [isArticles, controls, filteredAndSortedItems]
  )

  const shownItems = useMemo(
    () =>
      filteredAndSortedItems.filter(
        (item) => (!activeTag || hasTag(item, activeTag)) && (!activeAuthor || item.author?.uuid === activeAuthor)
      ),
    [filteredAndSortedItems, activeTag, activeAuthor]
  )

  const visibleItems = useMemo(() => shownItems.slice(0, visibleCount), [shownItems, visibleCount])

  const hasMore = visibleCount < shownItems.length
  const handleLoadMore = () => setVisibleCount((prev) => prev + pageSize)

  const columnsClass = useMemo(() => {
    if (blok.resource === 'persons') return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
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
        <GridHeading
          title={blok.title}
          subtitle={blok.subtitle}
          totalCount={shownItems.length}
          isDarkSection={isDarkSection}
        />

        {(tags.length > 1 || authors.length > 1) && (
          <div className="mb-8 space-y-3">
            {tags.length > 1 && (
              <FilterGroup
                label="Filtra per tema"
                allLabel="Tutti i temi"
                options={tags.map((tag) => ({ value: tag, label: tagLabel(tag) }))}
                active={activeTag}
                onChange={(value) => {
                  setActiveTag(value)
                  setVisibleCount(pageSize)
                }}
              />
            )}
            {authors.length > 1 && (
              <FilterGroup
                label="Filtra per autore"
                allLabel="Tutti gli autori"
                options={authors.map((author) => ({ value: author.uuid, label: author.name }))}
                active={activeAuthor}
                onChange={(value) => {
                  setActiveAuthor(value)
                  setVisibleCount(pageSize)
                }}
              />
            )}
          </div>
        )}

        <div className={`grid ${blok.resource === 'persons' ? 'gap-4 sm:gap-6' : 'gap-6 sm:gap-8'} ${columnsClass}`}>
          {(blok.resource === 'articles' || !blok.resource) &&
            visibleItems.map((article) => (
              <ArticleCard key={article.uuid} article={article} isDark={isDarkSection} />
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
              color={isDarkSection ? 'default' : 'primary'}
              variant="ghost"
              size="lg"
              onPress={handleLoadMore}
              className="px-8"
            >
              Carica altri {shownItems.length - visibleCount}
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