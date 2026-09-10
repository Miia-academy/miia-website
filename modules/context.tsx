// context.tsx
import { createContext, useContext, useMemo, useCallback, ReactNode } from 'react'
import type {
  GlobalData,
  ProcessedCourse,
  ProcessedEvent,
  ProcessedJob,
  ProcessedArticle,
  ProcessedPerson,
  ProcessedProject,
} from '@modules/cache'

export type CourseOpendayKey =
  | ""
  | "interni - primo livello"
  | "interni - secondo livello"
  | "moda - primo livello"
  | "moda - secondo livello"

export type HiddenFilter = 'all' | 'only_hidden' | 'exclude_hidden'

interface DataContextType extends GlobalData {
  getLatestItems: <T>(items: T[], dateExtractor: (item: T) => string | undefined, limit?: number) => T[]

  getEventsByPrefix: (prefix: string) => ProcessedEvent[]
  getCoursesByOpenday: (openday: CourseOpendayKey) => ProcessedCourse[]
  getJobsByArea: (area: string) => ProcessedJob[]
  getArticlesByTag: (tag: string, visibility?: HiddenFilter, limit?: number) => ProcessedArticle[]
  getPersonsByRole: (roleKeyword: string) => ProcessedPerson[]
  getProjectsByTag: (tag: string) => ProcessedProject[]
  getLatestArticle: () => ProcessedArticle | undefined

  // Helper specifico per le competenze
  getCompetenzaNameByValue: (value: string) => string | undefined
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export function DataProvider({
  children,
  data,
}: {
  children: ReactNode
  data?: GlobalData
}) {
  const courses = data?.courses || []
  const events = data?.events || []
  const locations = data?.locations || []
  const articles = data?.articles || []
  const jobs = data?.jobs || []
  const persons = data?.persons || []
  const projects = data?.projects || []
  const competenze = data?.competenze || []

  // --- UTILITY DI BASE ---

  const getLatestItems = useCallback(
    <T,>(items: T[], dateExtractor: (item: T) => string | undefined, limit?: number): T[] => {
      const sorted = [...items].sort((a, b) => {
        const dateA = new Date(dateExtractor(a) || 0).getTime()
        const dateB = new Date(dateExtractor(b) || 0).getTime()
        return dateB - dateA
      })
      return limit ? sorted.slice(0, limit) : sorted
    },
    []
  )

  // --- HELPER SPECIFICI ---

  const getEventsByPrefix = useCallback(
    (prefix: string) => events.filter((e) => e.name?.startsWith(prefix)),
    [events]
  )

  const getCoursesByOpenday = useCallback(
    (openday: CourseOpendayKey) => courses.filter((c) => c.openday === openday),
    [courses]
  )

  const getJobsByArea = useCallback(
    (area: string) => jobs.filter((j) => j.area?.toLowerCase() === area.toLowerCase()),
    [jobs]
  )

  const getArticlesByTag = useCallback(
    (tag: string, visibility: HiddenFilter = 'exclude_hidden', limit?: number) => {
      const filtered = articles.filter((a) => {
        const hasTag = a.tagList?.some((t) => t.toLowerCase() === tag.toLowerCase())

        let visibilityMatch = true
        if (visibility === 'only_hidden') visibilityMatch = a.hidden === true
        if (visibility === 'exclude_hidden') visibilityMatch = !a.hidden

        return hasTag && visibilityMatch
      })

      return limit ? getLatestItems(filtered, (a) => a.createdAt, limit) : filtered
    },
    [articles, getLatestItems]
  )

  const getPersonsByRole = useCallback(
    (roleKeyword: string) =>
      persons.filter((p) => p.role?.toLowerCase().includes(roleKeyword.toLowerCase())),
    [persons]
  )

  const getProjectsByTag = useCallback(
    (tag: string) =>
      projects.filter((p) => p.tagList?.some((t) => t.toLowerCase() === tag.toLowerCase())),
    [projects]
  )

  const getLatestArticle = useCallback(() => {
    return getLatestItems(articles, (a) => a.createdAt, 1)[0]
  }, [articles, getLatestItems])

  // Helper per le Competenze
  const getCompetenzaNameByValue = useCallback(
    (value: string) => competenze.find((c) => c.value === value)?.name,
    [competenze]
  )

  const value = useMemo(
    () => ({
      courses,
      events,
      locations,
      articles,
      jobs,
      persons,
      projects,
      competenze,
      getLatestItems,
      getEventsByPrefix,
      getCoursesByOpenday,
      getJobsByArea,
      getArticlesByTag,
      getPersonsByRole,
      getProjectsByTag,
      getLatestArticle,
      getCompetenzaNameByValue,
    }),
    [
      courses,
      events,
      locations,
      articles,
      jobs,
      persons,
      projects,
      competenze,
      getLatestItems,
      getEventsByPrefix,
      getCoursesByOpenday,
      getJobsByArea,
      getArticlesByTag,
      getPersonsByRole,
      getProjectsByTag,
      getLatestArticle,
      getCompetenzaNameByValue,
    ]
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useDataContext() {
  const context = useContext(DataContext)
  if (!context) {
    throw new Error('useDataContext deve essere usato dentro DataProvider')
  }
  return context
}