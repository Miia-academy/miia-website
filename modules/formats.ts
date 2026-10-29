export function getLongDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('it-IT', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  })
}

export function getShortDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })
}

export interface ImageSize {
  width: number
  height: number
  ratio: number
  axis: 'width' | 'height'
}

export function getImageSizes(image: any) {
  const size: ImageSize = {
    width: 1024,
    height: 768,
    ratio: 1.333,
    axis: 'width',
  }
  const sizes = image.filename
    .match(/\/(\d+)x(\d+)\//)
    ?.filter((s: string, i: number) => !!i)
    ?.map((s: string) => Number(s))

  if (!!sizes) {
    size.width = sizes[0]
    size.height = sizes[1]
    size.ratio = sizes[0] / sizes[1]
    size.axis = size.ratio >= 1 ? 'width' : 'height'
  }

  return { ...image, size }
}

export const getCapitalize = (string: string) =>
  string
    .split(' ')
    .map((s: string) =>
      s.length > 1 ? `${s[0].toUpperCase()}${s.substring(1).toLowerCase()}` : s
    )
    .join(' ')

/** Folder page of a story: "blog/interior-design/focus-cucina" → "/blog/interior-design"; "/" at the top level. */
export function parentPath(fullSlug?: string): string {
  const parts = (fullSlug || '').split('/').filter(Boolean)
  return `/${parts.slice(0, -1).join('/')}`
}
