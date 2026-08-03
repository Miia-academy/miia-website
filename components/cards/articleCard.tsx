import type { ProcessedArticle } from '@modules/cache'
import NextLink from 'next/link'
import { Image, Chip } from '@heroui/react'
import { tv } from 'tailwind-variants'

interface ArticleCardProps {
  article: ProcessedArticle
  isDark?: boolean
}

export default function ArticleCard({ article, isDark }: ArticleCardProps) {
  const articleSlug = article.fullSlug ? `/${article.fullSlug}` : '#'

  return (
    <article className={cardClasses({ isDark })}>
      {/* Immagine con Tag sovrapposti in basso */}
      {article.image?.filename && (
        <NextLink href={articleSlug} className="relative block overflow-hidden rounded-xl">
          <Image
            src={article.image.filename}
            alt={article.image.alt || article.title || ''}
            isZoomed
            classNames={{
              wrapper: 'aspect-[16/10] w-full overflow-hidden',
            }}
            radius="sm"
          />
          {article.tagList && article.tagList.length > 0 && (
            <div className="absolute bottom-0 z-20 flex w-full flex-wrap gap-2 p-2">
              {article.tagList.map((tag, index) => (
                <Chip
                  key={index}
                  classNames={{
                    base: 'bg-neutral-200 text-neutral-900',
                    content: 'font-medium',
                  }}
                  size="sm"
                >
                  {tag}
                </Chip>
              ))}
            </div>
          )}
        </NextLink>
      )}

      {/* Blocco Testi e Descrizione */}
      <NextLink
        href={articleSlug}
        className="flex-1 block space-y-2 pt-2 transition-all hover:opacity-80"
      >
        {article.title && (
          <h4 className={titleClasses({ isDark })}>
            {article.title}
          </h4>
        )}
        {article.description && (
          <p className={descriptionClasses({ isDark })}>
            {article.description}
          </p>
        )}
      </NextLink>
    </article>
  )
}

// -- Tailwind Variants per la pulizia del componente --
// -- Tailwind Variants --
const cardClasses = tv({
  base: 'flex flex-col space-y-2 w-full',
  variants: {
    isDark: {
      true: 'text-white',
      false: 'text-neutral-900',
    },
  },
})

const titleClasses = tv({
  base: 'font-bold text-lg leading-5 line-clamp-5 transition-colors',
  variants: {
    isDark: {
      true: 'text-white',
      false: 'text-neutral-900',
    },
  },
})

const descriptionClasses = tv({
  base: 'text-sm line-clamp-5 md:line-clamp-3',
  variants: {
    isDark: {
      true: 'text-neutral-300',
      false: 'text-neutral-600',
    },
  },
})