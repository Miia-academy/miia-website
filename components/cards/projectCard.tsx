import type { ProcessedProject } from '@modules/cache'
import { Image, Card, Chip } from '@heroui/react'
import NextLink from 'next/link'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { tv } from 'tailwind-variants'

interface ProjectCardProps {
  project: ProcessedProject
  isDark?: boolean
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const projectSlug = project.fullSlug ? `/${project.fullSlug}` : '#'

  // Formattatore legato alle regole tipografiche di progetto
  const baseTypography = Typography({ theme: 'light' })

  const cardTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h4,
    h2: baseTypography.h5,
    h3: baseTypography.h6,
    h4: baseTypography.h6,
    p: {
      component: ({ children }: any) => (
        <span className="block text-neutral-200">{children}</span>
      ),
    },
  }

  return (
    <Card
      as={NextLink}
      href={projectSlug}
      isPressable
      className="group relative flex aspect-[4/3] h-full w-full flex-col justify-end overflow-hidden rounded-2xl border-none bg-neutral-900 shadow-inner sm:min-h-[320px]"
    >
      {/* 1. Sfondo Immagine */}
      <div className="absolute inset-0 z-0 h-full w-full">
        {project.cover?.filename ? (
          <Image
            removeWrapper
            src={project.cover.filename}
            alt={project.cover.alt || project.title || ''}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            radius="none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs text-neutral-400">
            Nessuna copertina
          </div>
        )}
      </div>

      {/* 2. Sfumatura Oscurante (Gradiente per il contrasto dei testi) */}
      <div className="absolute inset-0 z-10 bg-gradient-to-tr from-black/80 via-black/30 to-transparent to-70% mix-blend-multiply transition-opacity duration-500 group-hover:opacity-90" />

      {/* 3. Layer di Blur Graduale Angolare (Senza box o cornici) */}
      <div className={blurOverlayClasses()} />

      {/* 4. Contenuto Testuale */}
      <article className="relative z-30 flex w-full flex-col p-5 sm:p-6">
        <div className="space-y-1">
          {project.title && (
            <Markdown options={{ overrides: cardTypographyOverrides }}>
              {project.title}
            </Markdown>
          )}
        </div>

        {/* Tags */}
        {project.tagList && project.tagList.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.tagList.map((tag) => (
              <Chip
                key={tag}
                size="sm"
                variant="flat"
                className="border-none bg-white/20 text-white backdrop-blur-md"
              >
                {tag}
              </Chip>
            ))}
          </div>
        )}
      </article>
    </Card>
  )
}

// -- Tailwind Variants per il layer di Blur --
const blurOverlayClasses = tv({
  base: [
    'absolute inset-0 z-20 pointer-events-none',
    'backdrop-blur-sm', // Blur leggero
    'bg-black/10', // Leggero tint scuro per ammorbidire
    // Sfumatura Angolare: parte forte in basso a sinistra (black) e sfuma verso il centro/alto (transparent)
    '[mask-image:linear-gradient(to_top_right,black_0%,black_25%,transparent_65%)]',
    '[-webkit-mask-image:linear-gradient(to_top_right,black_0%,black_25%,transparent_65%)]',
  ],
})