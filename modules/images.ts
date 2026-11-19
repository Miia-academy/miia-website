/**
 * Resized images from the Storyblok image service, so the browser downloads
 * the size it shows instead of the original upload.
 */

const STORYBLOK_ASSET = /^(https?:)?\/\/a\.storyblok\.com\/f\/\d+\/(\d+)x(\d+)\/[^?#]+\.(jpe?g|png|webp)$/i

export const IMAGE_WIDTHS = [480, 768, 1024, 1440, 1920]

const QUALITY = 70

export interface ResponsiveImage {
  src: string
  srcSet?: string
  sizes?: string
}

/** Original width of a Storyblok asset, from the "/1920x1080/" part of its address. */
function originalWidth(filename: string): number | null {
  const match = filename.match(STORYBLOK_ASSET)
  return match ? Number(match[2]) : null
}

/** Address of a Storyblok image resized to the given width (height follows the ratio). */
export function storyblokImageUrl(filename: string, width: number): string {
  const original = originalWidth(filename)
  if (!original) return filename
  return `${filename}/m/${Math.min(width, original)}x0/filters:quality(${QUALITY})`
}

/**
 * src, srcSet and sizes for an <img>. Addresses that are not resizable Storyblok
 * images (SVG, GIF, other sites) come back as they are.
 */
export function responsiveImage(
  filename: string | null | undefined,
  sizes: string,
  widths: number[] = IMAGE_WIDTHS
): ResponsiveImage {
  if (!filename) return { src: '' }
  const original = originalWidth(filename)
  if (!original) return { src: filename }

  const usable = widths.filter((w) => w < original)
  const steps = [...usable, Math.min(original, widths[widths.length - 1])]
  const unique = Array.from(new Set(steps))

  return {
    src: storyblokImageUrl(filename, unique[Math.min(2, unique.length - 1)]),
    srcSet: unique.map((w) => `${storyblokImageUrl(filename, w)} ${w}w`).join(', '),
    sizes,
  }
}

const FRACTIONS: Record<string, number> = {
  '1/4': 0.25,
  '1/3': 0.334,
  '1/2': 0.5,
  '2/3': 0.667,
  '3/4': 0.75,
  '1/1': 1,
}

const MAX_CONTENT = 1280

/**
 * sizes attribute for an image in the 12-column grid, from the Storyblok width
 * per breakpoint [sm, md, lg, xl]. Below sm the image is full width.
 */
export function gridSizes(widths: Array<string | undefined> | undefined): string {
  const breakpoints = [640, 768, 1024, 1280]
  const rules: string[] = []
  for (let i = breakpoints.length - 1; i >= 0; i--) {
    const fraction = FRACTIONS[widths?.[i] || '']
    if (!fraction) continue
    const size = i === breakpoints.length - 1
      ? `${Math.round(MAX_CONTENT * fraction)}px`
      : `${Math.round(fraction * 100)}vw`
    rules.push(`(min-width: ${breakpoints[i]}px) ${size}`)
  }
  return [...rules, '100vw'].join(', ')
}

// Cards in the article and project grids: three columns on desktop, two on tablet
export const CARD_SIZES = '(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw'

// Round portraits of teachers and students
export const PORTRAIT_SIZES = '320px'
export const PORTRAIT_WIDTHS = [320, 640]
