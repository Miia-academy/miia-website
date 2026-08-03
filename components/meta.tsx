import Head from 'next/head'
import { useRouter } from 'next/router'
import type { Page as PageBlok } from '@types'

// Dominio base del sito per la generazione di URL canonici e OpenGraph assoluti
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.madeinitalyacademy.it'

const defaultMeta = {
  title: 'Made in italy academy, fashion e interior design',
  description:
    'Scuola specializzata in corsi di formazione per arredatori, stilisti e modellisti Made in italy',
  image: `${SITE_URL}/meta-image.jpg`,
  alt: 'Made in Italy Academy',
}

interface MetaComponentProps {
  title?: string
  description?: string
  image?: {
    filename?: string
    alt?: string
  }
}

export default function Meta(blok: MetaComponentProps) {
  const router = useRouter()

  // 1. Costruzione sicura dell'URL corrente assoluto (previene problemi SEO e hydration mismatch)
  const currentPath = router?.asPath || ''
  const cleanPath = currentPath.split('?')[0] // Rimuove eventuali query parameters per la canonical
  const canonicalUrl = `${SITE_URL}${cleanPath}`

  // 2. Risoluzione fallback per i metadati
  const metaTitle =
    typeof blok?.title === 'string' && blok.title.trim() !== ''
      ? blok.title
      : defaultMeta.title

  const metaDescription =
    typeof blok?.description === 'string' && blok.description.trim() !== ''
      ? blok.description
      : defaultMeta.description

  // Risoluzione sicura dell'immagine (se l'URL di Storyblok è relativo, aggiungiamo la protocollazione)
  let metaImage = blok?.image?.filename || defaultMeta.image
  if (metaImage.startsWith('//')) {
    metaImage = `https:${metaImage}`
  }

  const metaImageAlt = blok?.image?.alt || defaultMeta.alt

  return (
    <Head>
      {/* Title */}
      <title>{metaTitle}</title>

      {/* Basic Meta */}
      <meta name="description" content={metaDescription} key="desc" />
      <link rel="canonical" href={canonicalUrl} />

      {/* OpenGraph / Facebook */}
      <meta property="og:site_name" content="Made in Italy Academy" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonicalUrl} />
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