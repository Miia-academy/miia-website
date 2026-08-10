import type { ProcessedJob } from '@modules/cache'
import NextLink from 'next/link'
import { Card, CardBody, CardFooter, Chip, Button } from '@heroui/react'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { tv } from 'tailwind-variants'

interface JobCardProps {
  job: ProcessedJob
  isDark?: boolean
  isOwner?: boolean
  onDelete?: (uuidOrId: string) => void
}

export default function JobCard({ job, isDark, isOwner, onDelete }: JobCardProps) {
  // Predisposizione per la pagina di dettaglio completa (es. /lavoro/frontend-developer)
  const jobSlug = job.fullSlug ? `/${job.fullSlug}` : '#'

  const baseTypography = Typography({ theme: isDark ? 'dark' : 'light' })

  const titleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h4,
    h2: baseTypography.h5,
    h3: baseTypography.h6,
    h4: baseTypography.h6,
    p: {
      component: ({ children }: any) => (
        <span className="font-sans text-xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
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
    if (onDelete && job.uuid) {
      onDelete(job.uuid)
    }
  }

  return (
    <Card
      as={NextLink}
      href={jobSlug}
      isPressable
      className={cardClasses({ isDark })}
      shadow="sm"
    >
      <CardBody className="flex flex-1 flex-col justify-between p-6 space-y-4">
        <div className="space-y-3 text-left">
          {/* Badge Area Lavorativa (es. "Interior", "Fashion") */}
          {job.area && (
            <span className="inline-block rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {job.area}
            </span>
          )}

          {/* Titolo Job */}
          <div>
            {job.title ? (
              <Markdown options={{ overrides: titleTypographyOverrides }}>
                {job.title}
              </Markdown>
            ) : null}
          </div>

          {/* Breve Descrizione */}
          {job.description && (
            <Markdown options={{ overrides: descriptionTypographyOverrides }}>
              {job.description}
            </Markdown>
          )}
        </div>
      </CardBody>

      {/* Footer con Tags e CTA */}
      <CardFooter className="flex items-center justify-between px-6 pb-6 pt-0">
        <div className="flex flex-wrap gap-1.5">
          {job.tagList?.slice(0, 3).map((tag) => (
            <Chip key={tag} size="sm" variant="flat">
              {tag}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {isOwner && onDelete && (
            <Button
              size="sm"
              color="danger"
              variant="light"
              onPress={handleDelete as any}
              className="text-xs font-semibold"
            >
              Elimina
            </Button>
          )}
          <span className="text-xs font-semibold text-primary group-hover:underline">
            Candidati →
          </span>
        </div>
      </CardFooter>
    </Card>
  )
}

const cardClasses = tv({
  base: 'group flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-neutral-200/80 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800',
  variants: {
    isDark: {
      true: 'bg-neutral-900 text-foreground',
      false: 'bg-background text-foreground',
    },
  },
})