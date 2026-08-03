import type { Article as ArticleBlok } from '@types'
import { storyblokEditable, StoryblokComponent } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { Image as HeroImage } from '@heroui/react'
import NextLink from 'next/link'
import { Typography } from './typography'
import { getLongDate } from '@modules/formats'

interface ArticleProps {
  blok: ArticleBlok
  fullSlug?: string
}

export default function Article({ blok, fullSlug }: ArticleProps) {
  // Tema 'light' per garantire il contrasto sul background scuro dell'Hero
  const heroTypography = Typography({ theme: 'light' })

  // Estrazione sicura di Data e Autore per Storyblok / TypeScript
  const rawDate = (blok as any).date || (blok as any).published_at || (blok as any).first_published_at
  const dateStr = rawDate ? getLongDate(rawDate) : null

  const rawAuthor = (blok as any).author
  const authorName =
    typeof rawAuthor === 'string'
      ? rawAuthor
      : rawAuthor?.content?.name || rawAuthor?.name || null

  return (
    <article {...storyblokEditable(blok as any)} className="w-full">
      {/* 1. HERO SECTION */}
      <section className="relative flex min-h-[70vh] w-full flex-col justify-between overflow-hidden bg-neutral-950 text-white">
        {/* Immagine di Copertina */}
        {blok.image?.filename && (
          <div className="absolute inset-0 z-0 h-full w-full">
            <HeroImage
              removeWrapper
              src={blok.image.filename}
              alt={blok.image.alt || blok.title || ''}
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
            href="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-200 transition-colors hover:text-white"
          >
            <i className="iconoir-arrow-left text-base" />
            Torna indietro
          </NextLink>
        </div>

        {/* Titolo, Metadati e Descrizione */}
        <div className="relative z-20 mx-auto w-full max-w-[1280px] p-6 pb-16 md:pb-24">
          <div className="max-w-3xl space-y-4">

            {/* Data e Autore */}
            {(dateStr || authorName) && (
              <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-neutral-300">
                {dateStr && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="iconoir-calendar text-base" />
                    {dateStr}
                  </span>
                )}
                {dateStr && authorName && <span className="opacity-50">•</span>}
                {authorName && (
                  <span className="inline-flex items-center gap-1.5">
                    <i className="iconoir-user text-base" />
                    {authorName}
                  </span>
                )}
              </div>
            )}

            {/* Titolo Principale */}
            {typeof blok.title === 'string' && blok.title.trim() !== '' ? (
              <h1 className="font-serif break-words text-3xl md:text-6xl xl:text-7xl font-black leading-tight md:leading-tight xl:leading-none">
                {blok.title}
              </h1>
            ) : null}

            {/* Descrizione / Introduzione dell'articolo */}
            {typeof blok.description === 'string' && blok.description.trim() !== '' ? (
              <div className="pt-2 text-base sm:text-lg text-neutral-200">
                {compiler(blok.description, {
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