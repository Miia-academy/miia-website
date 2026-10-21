import Head from 'next/head'
import { useRouter } from 'next/router'
import { SITE_NAME, SITE_URL } from '@config/site'

const defaultMeta = {
  title: 'Made in italy academy, fashion e interior design',
  description:
    'Scuola specializzata in corsi di formazione per arredatori, stilisti e modellisti Made in italy',
  image: `${SITE_URL}/meta-image.jpg`,
  alt: SITE_NAME,
}

const MAX_DESCRIPTION = 160

interface MetaComponentProps {
  title?: string
  description?: string
  image?: {
    filename?: string | null
    alt?: string | null
  }
  type?: 'website' | 'article'
  noindex?: boolean
}

/** Text without Markdown marks and line breaks, for title and description tags. */
export function plainText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_`>~|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : cut.length)}…`
}

/** Absolute address of a path: no query, no trailing slash, home as "/". */
export function canonicalUrl(asPath: string): string {
  let path = asPath.split(/[?#]/)[0] || '/'
  if (path === '/index' || path === '/home') path = '/'
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

export default function Meta(blok: MetaComponentProps) {
  const router = useRouter()
  const url = canonicalUrl(router?.asPath || '/')

  const metaTitle = plainText(blok?.title) || defaultMeta.title
  const metaDescription = shorten(plainText(blok?.description) || defaultMeta.description, MAX_DESCRIPTION)

  // Storyblok asset addresses can start with "//"
  let metaImage = blok?.image?.filename || defaultMeta.image
  if (metaImage.startsWith('//')) {
    metaImage = `https:${metaImage}`
  }

  const metaImageAlt = blok?.image?.alt || defaultMeta.alt

  return (
    <Head>
      <title>{metaTitle}</title>

      <meta name="description" content={metaDescription} key="desc" />
      {blok?.noindex ? (
        <meta name="robots" content="noindex" />
      ) : (
        <link rel="canonical" href={url} />
      )}

      {/* OpenGraph / Facebook */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="it_IT" />
      <meta property="og:type" content={blok?.type || 'website'} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={metaTitle} key="title" />
      <meta property="og:description" content={metaDescription} key="description" />
      <meta property="og:image" content={metaImage} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      <meta name="twitter:image:alt" content={metaImageAlt} />
    </Head>
  )
}
