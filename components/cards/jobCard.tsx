import { useEffect, useState } from 'react'
import type { ProcessedJob } from '@modules/cache'
import NextLink from 'next/link'
import { Card, CardBody, CardFooter, Chip, Button, Modal, ModalContent, useDisclosure } from '@heroui/react'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { tv } from 'tailwind-variants'
import AuthGate from '@components/gate'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null
  return null
}

interface JobCardProps {
  job: ProcessedJob
  isDark?: boolean
  isOwner?: boolean
  onDelete?: (uuidOrId: string) => void
  onEdit?: () => void // 👈 Aggiunta della prop opzionale
}

export default function JobCard({ job, isDark, isOwner, onDelete, onEdit }: JobCardProps) {
  const jobSlug = job.fullSlug ? `/${job.fullSlug}` : '#'

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCompanyUser, setIsCompanyUser] = useState(false)
  const { isOpen, onOpen, onOpenChange } = useDisclosure()

  useEffect(() => {
    const rawUser = getCookie('miia_user')
    if (rawUser) {
      setIsAuthenticated(true)
      try {
        const parsed = JSON.parse(decodeURIComponent(rawUser))
        if (parsed?.company || parsed?.storyblok_id) {
          setIsCompanyUser(true)
        }
      } catch {
        // Fallback silente
      }
    }
  }, [])

  // Estrazione sicura del nome azienda
  let companyName = ''
  if (job.company) {
    if (typeof job.company === 'string') {
      companyName = job.company
    } else if (typeof job.company === 'object') {
      companyName = job.company?.content?.title || job.company?.name || ''
    }
  }

  const baseTypography = Typography({ theme: isDark ? 'dark' : 'light' })

  const titleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h4,
    h2: baseTypography.h5,
    h3: baseTypography.h6,
    h4: baseTypography.h6,
    p: {
      component: ({ children }: any) => (
        <span className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-foreground leading-tight">
          {children}
        </span>
      ),
    },
  }

  const descriptionTypographyOverrides = {
    ...baseTypography,
    p: {
      component: ({ children }: any) => (
        <span className="line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
          {children}
        </span>
      ),
    },
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onDelete && (job.uuid || (job as any).id)) {
      onDelete(job.uuid || (job as any).id)
    }
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (onEdit) {
      onEdit()
    }
  }

  const handleApplyClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault()
      e.stopPropagation()
      onOpen()
    }
  }

  return (
    <>
      <Card
        as={NextLink}
        href={jobSlug}
        className={cardClasses({ isDark })}
        shadow="none"
        radius="lg"
      >
        <CardBody className="flex flex-1 flex-col justify-between p-6 space-y-4">
          <div className="space-y-4 text-left">
            {job.area && (
              <div className="flex items-center gap-2">
                <span className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  {job.area}
                </span>
              </div>
            )}

            <div className="space-y-2">
              {companyName && (
                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                  {companyName}
                </p>
              )}

              {job.title ? (
                <Markdown options={{ overrides: titleTypographyOverrides }}>
                  {job.title}
                </Markdown>
              ) : null}

              {job.location && (
                <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 pt-1">
                  <i className="iconoir-map-pin text-base" />
                  {job.location}
                </div>
              )}
            </div>

            {job.description && (
              <div className="pt-2">
                <Markdown options={{ overrides: descriptionTypographyOverrides }}>
                  {job.description}
                </Markdown>
              </div>
            )}
          </div>
        </CardBody>

        <CardFooter className="flex items-center justify-between px-6 pb-6 pt-0 gap-4">
          <div className="flex flex-wrap gap-1.5">
            {job.tagList?.slice(0, 3).map((tag) => (
              <Chip key={tag} size="sm" variant="flat" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                {tag}
              </Chip>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tasti Gestione Inserzione: visibili SOLO se l'utente è l'effettivo proprietario */}
            {isOwner && (
              <div className="flex items-center gap-1">
                {onEdit && (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={handleEdit as any}
                    className="text-xs font-semibold h-8 px-3 rounded-lg"
                  >
                    Modifica
                  </Button>
                )}

                {onDelete && (
                  <Button
                    size="sm"
                    color="danger"
                    variant="light"
                    onPress={handleDelete as any}
                    className="text-xs font-semibold h-8 px-3 rounded-lg"
                  >
                    Elimina
                  </Button>
                )}
              </div>
            )}

            {/* Tasto Candidati: nascosto se l'utente è loggato come azienda */}
            {!isCompanyUser && (
              <span
                onClick={handleApplyClick}
                className="text-sm font-semibold text-primary z-10 relative hover:underline cursor-pointer ml-1"
              >
                Candidati &rarr;
              </span>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Modale di Autenticazione se l'utente tenta di candidarsi senza essere loggato */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
        <ModalContent>
          {() => (
            <div className="p-4">
              <AuthGate
                onSuccess={() => setIsAuthenticated(true)}
                redirectUrl={jobSlug}
              />
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  )
}

const cardClasses = tv({
  base: 'flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800 transition-shadow hover:shadow-md',
  variants: {
    isDark: {
      true: 'bg-neutral-900 text-foreground',
      false: 'bg-background text-foreground',
    },
  },
})