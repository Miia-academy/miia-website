// modules/storyblok.ts
import StoryblokClient from 'storyblok-js-client'

const SPACE_ID = process.env.STORYBLOK_SPACE_ID
const MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT

if (!SPACE_ID || !MANAGEMENT_TOKEN) {
  console.warn(
    '[Storyblok Module Warning] STORYBLOK_SPACE_ID o STORYBLOK_MANAGEMENT non sono configurati nelle env.'
  )
}

const storyblok = new StoryblokClient({
  oauthToken: MANAGEMENT_TOKEN,
})

export interface CreateStoryOptions {
  name: string
  slug: string
  component: string
  folderId?: string | number
  content?: Record<string, any>
  publish?: boolean
}

/**
 * 1. Recupera una storia da Storyblok (supporta sia ID numerico che UUID)
 */
export async function getStoryById(storyId: string | number) {
  if (!SPACE_ID) throw new Error('[Storyblok Error] STORYBLOK_SPACE_ID non impostato.')
  if (!storyId || storyId === 'undefined' || storyId === 'null') {
    throw new Error(`[Storyblok Error] storyId non valido ("${storyId}") passato a getStoryById.`)
  }

  try {
    if (typeof storyId === 'string' && storyId.includes('-')) {
      const searchResponse: any = await (storyblok as any).get(`spaces/${SPACE_ID}/stories`, {
        by_uuids: storyId,
      })
      const foundStory = searchResponse?.data?.stories?.[0] || searchResponse?.stories?.[0]
      if (!foundStory) {
        throw new Error(`Impossibile trovare la storia con UUID: ${storyId}`)
      }
      return foundStory
    }

    const response: any = await (storyblok as any).get(`spaces/${SPACE_ID}/stories/${storyId}`)
    return response?.data?.story || response?.story || response
  } catch (error: any) {
    console.error('[Storyblok Get Error]:', error?.response?.data || error?.message || error)
    throw new Error(`Impossibile recuperare la storia ${storyId} da Storyblok.`)
  }
}

/**
 * 2. Creazione generica Story
 */
export async function createStory({
  name,
  slug,
  component,
  folderId,
  content = {},
  publish = false,
}: CreateStoryOptions) {
  if (!SPACE_ID) throw new Error('[Storyblok Error] STORYBLOK_SPACE_ID non impostato.')

  const storyPayload: Record<string, any> = {
    name,
    slug,
    content: {
      component,
      ...content,
    },
  }

  if (folderId) {
    const parsedFolderId = Number(folderId)
    if (!isNaN(parsedFolderId) && parsedFolderId > 0) {
      storyPayload.parent_id = parsedFolderId
    }
  }

  try {
    const endpoint = `spaces/${SPACE_ID}/stories`
    const payload = {
      story: storyPayload,
      publish: publish ? 1 : 0,
    }

    const response: any = await (storyblok as any).post(endpoint, payload)
    return response?.data?.story || response?.story || response
  } catch (error: any) {
    console.error('[Storyblok Management API Error]:', error?.response?.data || error)
    throw new Error(
      error?.response?.data?.message ||
      error?.message ||
      'Errore durante la creazione della Story su Storyblok.'
    )
  }
}

/**
 * 3. Eliminazione Story
 */
export async function deleteStory(storyId: string | number) {
  if (!SPACE_ID) throw new Error('[Storyblok Error] STORYBLOK_SPACE_ID non impostato.')

  try {
    const endpoint = `spaces/${SPACE_ID}/stories/${storyId}`
    const response: any = await (storyblok as any).delete(endpoint)
    return response?.data || response
  } catch (error: any) {
    console.error('[Storyblok Delete Error]:', error?.response?.data || error)
    throw new Error('Impossibile eliminare la story da Storyblok.')
  }
}

/**
 * 4. Update Story
 */
export async function updateStory(storyId: string | number, contentPayload: Record<string, any>) {
  if (!SPACE_ID) throw new Error('[Storyblok Error] STORYBLOK_SPACE_ID non impostato.')
  if (!storyId || storyId === 'undefined' || storyId === 'null') {
    throw new Error(`[Storyblok Error] storyId non valido ("${storyId}") passato a updateStory.`)
  }

  let realNumericId = storyId

  try {
    if (typeof storyId === 'string' && storyId.includes('-')) {
      const searchResponse: any = await (storyblok as any).get(`spaces/${SPACE_ID}/stories`, {
        by_uuids: storyId,
      })

      const foundStory = searchResponse?.data?.stories?.[0] || searchResponse?.stories?.[0]
      if (!foundStory) {
        throw new Error(`Impossibile trovare la storia con UUID: ${storyId}`)
      }

      realNumericId = foundStory.id
    }

    const endpoint = `spaces/${SPACE_ID}/stories/${realNumericId}`
    const payload = {
      story: {
        content: contentPayload,
      },
      publish: 0,
    }

    const response: any = await (storyblok as any).put(endpoint, payload)
    return response?.data?.story || response?.story || response

  } catch (error: any) {
    console.error('[Storyblok Update Error]:', error?.response?.data || error?.message || error)
    throw new Error(
      error?.response?.data?.message ||
      error?.message ||
      `Errore durante l'aggiornamento della Story ${storyId} su Storyblok.`
    )
  }
}