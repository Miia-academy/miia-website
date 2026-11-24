import type { Image as ImageBlok } from '@types'
import { storyblokEditable } from '@storyblok/react'
import { storyblokImageUrl } from '@modules/images'

/** Logo = immagine piccola (lato lungo fino a 600px), come i loghi partner da 256x256 */
const LOGO_MAX_SIDE = 600
const SIZE_IN_URL = /\/(\d+)x(\d+)\//

export function isLogo(slide: { component?: string; image?: { filename?: string | null } }) {
  if (slide.component !== 'image' || !slide.image?.filename) return false
  const match = slide.image.filename.match(SIZE_IN_URL)
  return !!match && Math.max(Number(match[1]), Number(match[2])) <= LOGO_MAX_SIDE
}

/**
 * Striscia di loghi che scorre lenta e continua: tanti loghi piccoli visibili insieme,
 * alla stessa altezza, invece di un carosello che ne mostra uno grande alla volta.
 * Si ferma al passaggio del mouse; con "riduci movimento" diventa una fila scorrevole a mano.
 */
export function LogoStrip({ logos }: { logos: ImageBlok[] }) {
  // Velocità costante qualunque sia il numero di loghi
  const duration = `${Math.max(20, logos.length * 3.5)}s`
  const row = (copy: number) =>
    logos.map((logo) => (
      <li
        key={`${copy}-${logo._uid}`}
        className="flex h-20 w-28 shrink-0 box-content items-center justify-center pr-8 md:h-24 md:w-36 md:pr-12"
        aria-hidden={copy > 0 || undefined}
        {...(copy === 0 ? storyblokEditable(logo as any) : {})}
      >
        <img
          src={storyblokImageUrl(logo.image!.filename!, 256)}
          alt={copy === 0 ? logo.image!.alt || '' : ''}
          loading="eager"
          decoding="async"
          className="max-h-full max-w-full object-contain mix-blend-multiply grayscale opacity-70 transition duration-300 hover:grayscale-0 hover:opacity-100"
        />
      </li>
    ))

  return (
    <div className="group relative w-full overflow-hidden motion-reduce:overflow-x-auto [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <ul
        className="flex w-max py-2 animate-marquee group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ ['--marquee-duration' as any]: duration }}
      >
        {row(0)}
        {row(1)}
      </ul>
    </div>
  )
}
