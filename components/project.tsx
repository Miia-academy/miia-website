import type { Project as ProjectBlok } from '@types'
import { storyblokEditable, StoryblokComponent } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Image as HeroImage } from '@heroui/react'
import NextLink from 'next/link'
import { Typography } from './typography'

interface ProjectProps {
  blok: ProjectBlok
  fullSlug?: string
}

function getParentPath(fullSlug?: string): string {
  if (!fullSlug) return '/progetti'

  const cleanSlug = fullSlug.replace(/^\/+|\/+$/g, '')
  const segments = cleanSlug.split('/')

  if (segments.length > 1) {
    segments.pop()
    return `/${segments.join('/')}`
  }

  return '/progetti'
}

export default function Project({ blok, fullSlug }: ProjectProps) {
  const backUrl = getParentPath(fullSlug)

  // Usiamo lo stesso pattern di text.tsx: tema 'light' per la Hero scura
  const heroTypography = Typography({ theme: 'light' })

  return (
    <article {...storyblokEditable(blok as any)} className="w-full">
      {/* 1. HERO SECTION */}
      <section className="relative flex min-h-[70vh] w-full flex-col justify-between overflow-hidden bg-neutral-950 text-white">
        {/* Immagine di Copertina */}
        {blok.cover?.filename && (
          <div className="absolute inset-0 z-0 h-full w-full">
            <HeroImage
              removeWrapper
              src={blok.cover.filename}
              alt={blok.cover.alt || blok.title || ''}
              className="h-full w-full object-cover opacity-60"
              radius="none"
            />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/80 via-black/40 to-transparent md:w-3/4" />

        {/* Back Link */}
        <div className="relative z-20 mx-auto w-full max-w-[1280px] p-6 pt-8">
          <NextLink
            href={backUrl}
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-200 transition-colors hover:text-white"
          >
            <i className="iconoir-arrow-left text-base" />
            Torna indietro
          </NextLink>
        </div>

        {/* Titolo e Sottotitolo compilati con Typography */}
        <div className="relative z-20 mx-auto w-full max-w-[1280px] p-6 pb-16 md:pb-24">
          <div className="max-w-2xl space-y-3">
            {typeof blok.title === 'string' && blok.title.trim() !== '' ? (
              <div>
                {compiler(blok.title, {
                  overrides: heroTypography,
                })}
              </div>
            ) : null}

            {typeof blok.subtitle === 'string' && blok.subtitle.trim() !== '' ? (
              <div>
                {compiler(blok.subtitle, {
                  overrides: heroTypography,
                })}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 2. DYNAMIC BODY BLOCKS */}
      <div className="w-full">
        {blok.body &&
          blok.body.map((nestedBlok) => (
            <StoryblokComponent
              blok={nestedBlok}
              parent={nestedBlok.component}
              key={nestedBlok._uid}
            />
          ))}
      </div>
    </article>
  )
}