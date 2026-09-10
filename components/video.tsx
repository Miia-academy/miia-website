import type { Video as VideoBlok } from '@types'
import { YouTubeEmbed } from '@next/third-parties/google'
import { storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'

// Tipizzazioni strette per Tailwind Variants
type OrderVariant = '1' | '2' | '3' | '4' | '5' | '6' | undefined
type WidthVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1' | undefined

interface VideoComponentProps {
  blok: VideoBlok
}

/**
 * Utility per estrarre l'ID di YouTube sia se l'utente inserisce l'ID nudo,
 * sia se incolla un link completo (watch, embed, short link youtu.be).
 */
function extractYouTubeId(urlOrId?: string): string | null {
  if (!urlOrId) return null
  const trimmed = urlOrId.trim()

  // Se è già un ID pulito (11 caratteri)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  // Se è un URL completo di YouTube
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/
  const match = trimmed.match(regExp)

  return match && match[2].length === 11 ? match[2] : null
}

export default function Video({ blok }: VideoComponentProps) {
  const videoId = extractYouTubeId(blok.source)

  if (!videoId) return null

  const orderAttr = blok.order ? (blok.order.toString() as OrderVariant) : undefined

  return (
    <div
      {...storyblokEditable(blok as any)}
      className={classes({
        order: orderAttr,
        sm: blok.width?.[0] as WidthVariant,
        md: blok.width?.[1] as WidthVariant,
        lg: blok.width?.[2] as WidthVariant,
        xl: blok.width?.[3] as WidthVariant,
      })}
    >
      <YouTubeEmbed
        videoid={videoId}
        params="rel=0&modestbranding=1&autohide=1&mute=1&controls=0"
      />
    </div>
  )
}

const classes = tv({
  base: 'col-span-12 sm:order-none overflow-hidden rounded-xl',
  variants: {
    order: {
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    sm: {
      '1/4': 'sm:col-span-3',
      '1/3': 'sm:col-span-4',
      '1/2': 'sm:col-span-6',
      '2/3': 'sm:col-span-8',
      '3/4': 'sm:col-span-9',
      '1/1': 'sm:col-span-12',
    },
    md: {
      '1/4': 'md:col-span-3',
      '1/3': 'md:col-span-4',
      '1/2': 'md:col-span-6',
      '2/3': 'md:col-span-8',
      '3/4': 'md:col-span-9',
      '1/1': 'md:col-span-12',
    },
    lg: {
      '1/4': 'lg:col-span-3',
      '1/3': 'lg:col-span-4',
      '1/2': 'lg:col-span-6',
      '2/3': 'lg:col-span-8',
      '3/4': 'lg:col-span-9',
      '1/1': 'lg:col-span-12',
    },
    xl: {
      '1/4': 'xl:col-span-3',
      '1/3': 'xl:col-span-4',
      '1/2': 'xl:col-span-6',
      '2/3': 'xl:col-span-8',
      '3/4': 'xl:col-span-9',
      '1/1': 'xl:col-span-12',
    },
  },
})