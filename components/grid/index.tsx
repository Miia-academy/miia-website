// components/grid/index.tsx
import { useState, useMemo, useEffect } from 'react'
import { storyblokEditable } from '@storyblok/react'
import { useDataContext } from '@modules/context'
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react'
import { tv } from 'tailwind-variants'

import ArticleCard from '@components/cards/articleCard'
import PersonCard from '@components/cards/personCard'
import ProjectCard from '@components/cards/projectCard'

import GridHeading from './heading'
import GridManager from './manager'

import type { Grid as GridBlokType } from '@types'

interface GridComponentProps {
  blok: GridBlokType & { dark?: boolean }
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

export default function Grid({ blok }: GridComponentProps) {
  const contextData = useDataContext()
  const articles = contextData?.articles || []
  const initialJobs = contextData?.jobs || []
  const courses = contextData?.courses || []
  const events = contextData?.events || []
  const persons = contextData?.persons || []
  const projects = contextData?.projects || []

  const pageSize = blok.limit ? parseInt(blok.limit as string, 10) : 6
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [deletedJobIds, setDeletedJobIds] = useState<string[]>([])

  const [createdJobs, setCreatedJobs] = useState<any[]>([])

  const [isMounted, setIsMounted] = useState(false)
  const [userData, setUserData] = useState<{
    email?: string;
    company?: string;
    contact_person?: string;
    storyblok_id?: string;
    storyblok_uuid?: string;
    address?: string;
    website?: string;
    description?: string;
    area?: string;
    sms?: string;
    newsletter?: boolean;
    occupazione?: string;
    comune?: string;
    provincia?: string;
    ricerca?: boolean;
    competenze?: string[];
    cv?: string;
  } | null>(null)

  const [isOwner, setIsOwner] = useState<boolean>(false)

  const { isOpen: isFeedbackOpen, onOpen: onFeedbackOpen, onOpenChange: onFeedbackOpenChange } = useDisclosure()
  const [feedback, setFeedback] = useState<{ title: string; message: string; color: 'danger' | 'success' }>({ title: '', message: '', color: 'success' })

  const isDarkSection = !!blok.dark

  useEffect(() => {
    const rawUser = getCookie('miia_user')
    if (rawUser) {
      try {
        const parsed = JSON.parse(decodeURIComponent(rawUser))
        setUserData(parsed)
        if (parsed.company || parsed.storyblok_id || parsed.storyblok_uuid) {
          setIsOwner(true)
        }
      } catch {
        // Fallback silente
      }
    }
    setIsMounted(true)
  }, [])

  const handleDeleteJob = async (storyIdOrUuid: string) => {
    try {
      const res = await fetch('/api/job/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: storyIdOrUuid })
      })
      if (res.ok) {
        setDeletedJobIds((prev) => [...prev, storyIdOrUuid])
      } else {
        const errorData = await res.json()
        setFeedback({ title: 'Errore', message: errorData.message || 'Errore durante l\'eliminazione.', color: 'danger' })
        onFeedbackOpen()
      }
    } catch {
      setFeedback({ title: 'Errore di connessione', message: 'Riprova più tardi.', color: 'danger' })
      onFeedbackOpen()
    }
  }

  const handleJobCreated = (newJob: any) => {
    if (newJob) {
      setCreatedJobs((prev) => [newJob, ...prev])
    }
  }

  const filteredAndSortedItems = useMemo(() => {
    if (!isMounted) return []

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
        const combinedJobs = [...createdJobs, ...initialJobs]
        rawItems = combinedJobs.filter((job) => !deletedJobIds.includes(job.uuid || job.id))

        if (isOwner && (userData?.storyblok_id || userData?.storyblok_uuid)) {
          rawItems = rawItems.filter(
            (job) =>
              job.company === userData?.storyblok_id ||
              job.content?.company === userData?.storyblok_id ||
              job.company === userData?.storyblok_uuid ||
              job.content?.company === userData?.storyblok_uuid ||
              job.content?.business === userData?.storyblok_uuid
          )
        }

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
  }, [isMounted, blok.resource, blok.filter, articles, initialJobs, createdJobs, courses, events, persons, projects, deletedJobIds, isOwner, userData])

  const visibleItems = useMemo(() => {
    return filteredAndSortedItems.slice(0, visibleCount)
  }, [filteredAndSortedItems, visibleCount])

  const hasMore = visibleCount < filteredAndSortedItems.length
  const handleLoadMore = () => setVisibleCount((prev) => prev + pageSize)

  const columnsClass = useMemo(() => {
    if (blok.resource === 'persons') return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
    return {
      '2': 'grid-cols-1 md:grid-cols-2',
      '3': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      '4': 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    }[blok.columns || '3'] || 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }, [blok.resource, blok.columns])

  if (!isMounted && blok.resource === 'jobs') {
    return (
      <section className={wrapperClasses({ themeDark: isDarkSection })}>
        <div className={containerClasses()}>
          <div className="animate-pulse h-64 bg-neutral-200/50 dark:bg-neutral-800/50 rounded-2xl w-full"></div>
        </div>
      </section>
    )
  }

  return (
    <section
      {...storyblokEditable(blok as any)}
      className={wrapperClasses({ themeDark: isDarkSection })}
    >
      <div className={containerClasses()}>
        <GridHeading
          title={blok.title}
          subtitle={blok.subtitle}
          totalCount={filteredAndSortedItems.length}
          isDarkSection={isDarkSection}
        />

        {blok.resource === 'jobs' ? (
          <GridManager
            jobs={visibleItems}
            isDarkSection={isDarkSection}
            userData={userData}
            onDeleteJob={handleDeleteJob}
            onJobCreated={handleJobCreated}
          />
        ) : (
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
        )}

        {hasMore && (
          <div className="mt-12 flex justify-center">
            <Button
              color={isDarkSection ? 'default' : 'primary'}
              variant="ghost"
              size="lg"
              onPress={handleLoadMore}
              className="px-8 font-medium"
            >
              Carica altri {filteredAndSortedItems.length - visibleCount}
            </Button>
          </div>
        )}
      </div>

      <Modal isOpen={isFeedbackOpen} onOpenChange={onFeedbackOpenChange} backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className={`text-xl font-bold ${feedback.color === 'danger' ? 'text-red-600' : 'text-[#009245]'}`}>
                {feedback.title}
              </ModalHeader>
              <ModalBody>
                <p>{feedback.message}</p>
              </ModalBody>
              <ModalFooter>
                <Button color={feedback.color} onPress={onClose}>
                  Chiudi
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
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