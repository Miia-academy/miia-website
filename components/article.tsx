import type { Article as ArticleBlok } from '@types'
import { storyblokEditable, StoryblokComponent } from '@storyblok/react'
import SlotBanner from '@components/banners/slotBanner'
import Meta from '@components/meta'
import { compiler } from 'markdown-to-jsx'
import { Image as HeroImage } from '@components/ui/image'
import { responsiveImage } from '@modules/images'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import { Typography } from './typography'
import { getLongDate, parentPath } from '@modules/formats'

interface ArticleProps {
  blok: ArticleBlok
  fullSlug?: string
}

export default function Article({ blok, fullSlug }: ArticleProps) {
  const router = useRouter()
  const backHref = fullSlug ? parentPath(fullSlug) : '/blog'
  // Coming from another page of the site (a list, maybe filtered): go back to it as it was
  const goBack = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof document === 'undefined' || window.history.length < 2) return
    try {
      if (new URL(document.referrer).origin !== window.location.origin) return
    } catch {
      return
    }
    event.preventDefault()
    router.back()
  }

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
      <Meta title={blok.title} description={blok.description} image={blok.image} type="article" />
      {/* 1. HERO SECTION */}
      <section className="relative flex min-h-[70vh] w-full flex-col justify-between overflow-hidden bg-neutral-950 text-white">
        {/* Immagine di Copertina */}
        {blok.image?.filename && (
          <div className="absolute inset-0 z-0 h-full w-full">
            <HeroImage
              removeWrapper
              {...responsiveImage(blok.image.filename, '100vw')}
              fetchPriority="high"
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
            href={backHref}
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-neutral-200 transition-colors hover:text-white"
          >
            <i className="iconoir-arrow-left text-base" />
            Torna indietro
          </NextLink>
        </div>

        {/* Titolo, Metadati e Descrizione */}
        <div className="relative z-20 mx-auto w-full max-w-[1280px] p-6 pb-16 md:pb-24">
          <div className="max-w-3xl space-y-4">

            {/* Data e Autore: blur aderente */}
            {(dateStr || authorName) && (
              <div className="w-fit inline-flex flex-wrap items-center gap-3 text-sm font-medium text-neutral-300 backdrop-blur-sm rounded-xl px-3 py-1.5 -ml-3">
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

            {/* Titolo Principale: Blur Rimosso */}
            {typeof blok.title === 'string' && blok.title.trim() !== '' ? (
              <h1 className="w-fit inline-block font-serif break-words type-display">
                {blok.title}
              </h1>
            ) : null}

            {/* Descrizione / Introduzione dell'articolo: blur aderente */}
            {typeof blok.description === 'string' && blok.description.trim() !== '' ? (
              <div className="w-fit inline-block text-base sm:text-lg text-neutral-200 backdrop-blur-sm rounded-2xl px-4 py-2 -ml-4">
                {compiler(blok.description, {
                  overrides: heroTypography,
                })}
              </div>
            ) : null}

          </div>
        </div>
      </section>

      {/* 2. DYNAMIC BODY BLOCKS */}
      {/* Bottom space so the text ends clear of the page edge and the WhatsApp button */}
      <div className="w-full pb-20 md:pb-24">
        {blok.body &&
          blok.body.map((nestedBlok) => (
            <StoryblokComponent
              blok={nestedBlok}
              parent={nestedBlok.component}
              key={nestedBlok._uid}
            />
          ))}
      </div>

      {/* Fixed banner place, at the end */}
      <SlotBanner slot="articles" />
    </article>
  )
}