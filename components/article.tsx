import type { Article as ArticleBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { storyblokEditable } from '@storyblok/react'
import { Image } from '@heroui/react'
import Link from 'next/link'
import { tv } from 'tailwind-variants'
import { resolveAlias } from '@modules/relations'

interface ArticleComponentProps {
  blok: ArticleBlok
  story?: ISbStoryData<ArticleBlok>
}

export default function Article({ blok, story }: ArticleComponentProps) {
  // 1. Estrazione trasparente dei dati reali (Alias vs Story corrente)
  const { content: article, slug } = resolveAlias<ArticleBlok>(
    blok.alias as ISbStoryData<ArticleBlok> | string | undefined,
    blok,
    story?.full_slug
  )

  // 2. Early exit/guard clause
  if (!article.title || !article.description || !article.image?.filename) {
    return null
  }

  const classes = tv({
    base: 'flex flex-wrap gap-4 items-end col-span-12 md:col-span-8',
  })

  return (
    <article className={classes()} {...storyblokEditable(blok as any)}>
      {article.image.filename && (
        <Link className="flex-none min-w-16 w-full md:w-1/3" href={slug}>
          <Image
            classNames={{
              wrapper: 'aspect-4/3 md:aspect-square w-full max-h-fit',
              img: 'absolute t-0 r-0 w-full h-full object-cover',
            }}
            src={article.image.filename}
            alt={article.image.alt || article.title}
            width={256}
          />
        </Link>
      )}

      <div className="flex-1 min-w-32 space-y-4">
        <Link href={slug}>
          <h4 className="font-bold leading-tight text-3xl">{article.title}</h4>
        </Link>
        <p className="font-sans leading-snug max-sm:line-clamp-3">
          {article.description}
        </p>
      </div>
    </article>
  )
}