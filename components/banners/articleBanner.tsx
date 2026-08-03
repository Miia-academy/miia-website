import type { Article as ArticleBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { storyblokEditable } from '@storyblok/react'
import { Image } from '@heroui/react'
import NextLink from 'next/link'
import { resolveAlias } from '@modules/relations'
import type { StoryblokAsset } from '@commonTypes'

export interface ArticleBannerProps {
  blok?: ArticleBlok
  story?: ISbStoryData<ArticleBlok>
  title?: string | null
  description?: string | null
  image?: StoryblokAsset | null
  fullSlug?: string | null
}

export default function ArticleBanner({
  blok,
  story,
  title: propTitle,
  description: propDescription,
  image: propImage,
  fullSlug: propFullSlug,
}: ArticleBannerProps) {
  // 1. Resolve dell'Alias se viene passato il blocco Storyblok
  const resolved = blok
    ? resolveAlias<ArticleBlok>(
      blok.alias as ISbStoryData<ArticleBlok> | string | undefined,
      blok,
      story?.full_slug
    )
    : null

  // 2. Estrazione dati con fallback pulito
  const title = resolved?.content.title ?? propTitle
  const description = resolved?.content.description ?? propDescription
  const image = resolved?.content.image ?? propImage
  const slug = resolved?.slug ?? (propFullSlug ? `/${propFullSlug.replace(/^\/+/, '')}` : '#')

  if (!title || !description) {
    return null
  }

  const cleanSlug = slug && slug !== '#' ? slug : '#'

  return (
    <article
      {...(blok ? storyblokEditable(blok as any) : {})}
      className="col-span-12 grid grid-cols-12 gap-6 items-center w-full"
    >
      {/* 1. Immagine Articolo a Sinistra (4 o 5 colonne su Desktop) */}
      {image?.filename && (
        <div className="col-span-12 md:col-span-5 lg:col-span-5">
          <NextLink href={cleanSlug} className="block w-full overflow-hidden rounded-xl">
            <Image
              classNames={{
                wrapper: 'w-full aspect-[16/10] overflow-hidden rounded-xl',
                img: 'w-full h-full object-cover',
              }}
              src={image.filename}
              alt={image.alt || title}
              radius="lg"
            />
          </NextLink>
        </div>
      )}

      {/* 2. Contenuto Articolo a Destra (Resto delle colonne) */}
      <div
        className={`col-span-12 ${image?.filename ? 'md:col-span-7 lg:col-span-7' : 'md:col-span-12'
          } space-y-4 text-white`}
      >
        <NextLink
          href={cleanSlug}
          className="inline-block space-y-3 transition-opacity hover:opacity-85"
        >
          <h3 className="font-serif text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
            {title}
          </h3>
        </NextLink>

        <p className="text-sm sm:text-base text-neutral-300 line-clamp-3 md:line-clamp-none font-sans leading-relaxed">
          {description}
        </p>

        {/* Bottone "Leggi articolo" */}
        <div className="pt-2">
          <NextLink
            href={cleanSlug}
            className="inline-flex rounded-full border border-white/80 px-5 py-2 text-sm font-medium text-white transition-all hover:bg-white hover:text-black"
          >
            Leggi articolo
          </NextLink>
        </div>
      </div>
    </article>
  )
}