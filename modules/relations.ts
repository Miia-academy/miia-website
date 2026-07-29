import type { ISbStoryData } from '@storyblok/react'

/**
 * Type Guard che verifica se un elemento è una storia risolta (ISbStoryData)
 * oppure solo un'UUID (string)
 */
export function isStoryResolved<T>(
  story: ISbStoryData<T> | string | undefined | null
): story is ISbStoryData<T> {
  return typeof story === 'object' && story !== null && 'content' in story
}

/**
 * Gestisce il pattern Alias / Mirror:
 * Se 'alias' è risolto, restituisce il suo 'content' e il suo 'full_slug'.
 * Altrimenti restituisce il 'fallbackBlok' e il 'fallbackSlug'.
 */
export function resolveAlias<T>(
  aliasField: ISbStoryData<T> | string | undefined | null,
  fallbackBlok: T,
  fallbackSlug?: string
): { content: T; slug: string } {
  if (isStoryResolved<T>(aliasField)) {
    return {
      content: aliasField.content,
      slug: aliasField.full_slug || fallbackSlug || '',
    }
  }

  return {
    content: fallbackBlok,
    slug: fallbackSlug || '',
  }
}