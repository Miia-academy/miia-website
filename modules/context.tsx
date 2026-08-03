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

// 1. Definiamo i Tipi Letterali per le tue chiavi specifiche
export type CourseOpendayKey =
  | ""
  | "interni - primo livello"
  | "interni - secondo livello"
  | "moda - primo livello"
  | "moda - secondo livello"

export type HiddenFilter = 'all' | 'only_hidden' | 'exclude_hidden'

// 2. Interfaccia del nostro Context arricchito
interface DataContextType extends GlobalData {
  // Utility generica per ottenere i primi N elementi (ordinati per data)
  getLatestItems: <T>(items: T[], dateExtractor: (item: T) => string | undefined, limit?: number) => T[]

  // Helpers Specifici
  getEventsByPrefix: (prefix: string) => ProcessedEvent[]
  getCoursesByOpenday: (openday: CourseOpendayKey) => ProcessedCourse[]
  getJobsByArea: (area: string) => ProcessedJob[]
  getArticlesByTag: (tag: string, visibility?: HiddenFilter, limit?: number) => ProcessedArticle[]
  getPersonsByRole: (roleKeyword: string) => ProcessedPerson[]
  getProjectsByTag: (tag: string) => ProcessedProject[]

  // Esempio per la tua domanda: "voglio solo l'ultimo articolo pubblicato"
  getLatestArticle: () => ProcessedArticle | undefined
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

  // --- UTILITY DI BASE ---

  // Helper interno per ordinare per data decrescente e tagliare i primi N elementi
  const getLatestItems = useCallback(
    <T,>(items: T[], dateExtractor: (item: T) => string | undefined, limit?: number): T[] => {
      const sorted = [...items].sort((a, b) => {
        const dateA = new Date(dateExtractor(a) || 0).getTime()
        const dateB = new Date(dateExtractor(b) || 0).getTime()
        return dateB - dateA // Più recente prima
      })
      return limit ? sorted.slice(0, limit) : sorted
    },
    []
  )

  // --- HELPER SPECIFICI ---

  // 1. EVENTI: Controllo rigoroso con startsWith
  const getEventsByPrefix = useCallback(
    (prefix: string) => events.filter((e) => e.name?.startsWith(prefix)),
    [events]
  )

  // 2. CORSI: Tipizzazione stretta su openday
  const getCoursesByOpenday = useCallback(
    (openday: CourseOpendayKey) => courses.filter((c) => c.openday === openday),
    [courses]
  )

  // 3. JOBS: Match area case-insensitive
  const getJobsByArea = useCallback(
    (area: string) => jobs.filter((j) => j.area?.toLowerCase() === area.toLowerCase()),
    [jobs]
  )

  // 4. ARTICOLI: Filtro incrociato (Tag + Visibility)
  const getArticlesByTag = useCallback(
    (tag: string, visibility: HiddenFilter = 'exclude_hidden', limit?: number) => {
      const filtered = articles.filter((a) => {
        // Match del tag (case-insensitive)
        const hasTag = a.tagList?.some((t) => t.toLowerCase() === tag.toLowerCase())

        // Risoluzione della logica "hidden"
        let visibilityMatch = true
        if (visibility === 'only_hidden') visibilityMatch = a.hidden === true
        if (visibility === 'exclude_hidden') visibilityMatch = !a.hidden

        return hasTag && visibilityMatch
      })

      // Se richiesto, ordiniamo per data e applichiamo il limite
      return limit ? getLatestItems(filtered, (a) => a.createdAt, limit) : filtered
    },
    [articles, getLatestItems]
  )

  // 5. PERSONE
  const getPersonsByRole = useCallback(
    (roleKeyword: string) =>
      persons.filter((p) => p.role?.toLowerCase().includes(roleKeyword.toLowerCase())),
    [persons]
  )

  // 6. PROGETTI
  const getProjectsByTag = useCallback(
    (tag: string) =>
      projects.filter((p) => p.tagList?.some((t) => t.toLowerCase() === tag.toLowerCase())),
    [projects]
  )

  // 7. RISPOSTA ALLA TUA DOMANDA: "Voglio solo l'ultimo elemento per data"
  // Sfruttiamo l'helper generico impostando limite a 1 e prendiamo il primo elemento dell'array risultante
  const getLatestArticle = useCallback(() => {
    return getLatestItems(articles, (a) => a.createdAt, 1)[0]
  }, [articles, getLatestItems])


  const value = useMemo(
    () => ({
      // Array grezzi
      courses,
      events,
      locations,
      articles,
      jobs,
      persons,
      projects,
      // Metodi Helper
      getLatestItems,
      getEventsByPrefix,
      getCoursesByOpenday,
      getJobsByArea,
      getArticlesByTag,
      getPersonsByRole,
      getProjectsByTag,
      getLatestArticle,
    }),
    [
      courses,
      events,
      locations,
      articles,
      jobs,
      persons,
      projects,
      getLatestItems,
      getEventsByPrefix,
      getCoursesByOpenday,
      getJobsByArea,
      getArticlesByTag,
      getPersonsByRole,
      getProjectsByTag,
      getLatestArticle,
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