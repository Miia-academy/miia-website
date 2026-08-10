/**
 * Storyblok Service Layer
 * Path: @modules/storyblok.ts
 */

import StoryblokClient from 'storyblok-js-client'

// --- TYPINGS ---

export interface GetStoryOptions {
  idOrUuid: string | number
  byUuid?: boolean
  resolveRelations?: string[]
}

export interface GetDatasourceEntryOptions {
  datasourceSlugOrId: string | number
  dimensionValueKey: string
}

export interface CreateStoryPayload {
  name: string
  slug: string
  component: string
  content?: Record<string, any>
  folderId?: string | number
  publish?: boolean
}

export interface UploadAssetPayload {
  fileBuffer: Buffer
  fileName: string
  contentType: string
  folderId?: string | number
}

// --- CLIENT INITIALIZATION ---

const getContentClient = () => {
  const token = process.env.NEXT_PUBLIC_STORYBLOK_TOKEN || process.env.STORYBLOK_TOKEN
  if (!token) throw new Error('[CMS] STORYBLOK_TOKEN non presente nelle env')

  return new StoryblokClient({
    accessToken: token,
  })
}

const getManagementClient = () => {
  const oauthToken = process.env.STORYBLOK_MANAGEMENT
  if (!oauthToken) throw new Error('[CMS] STORYBLOK_MANAGEMENT non presente nelle env')

  return new StoryblokClient({
    oauthToken: oauthToken,
  })
}

const SPACE_ID = process.env.STORYBLOK_SPACE_ID || process.env.NEXT_PUBLIC_STORYBLOK_SPACE_ID

// --- FUNZIONI API ---

/**
 * 1. Cerca una Story dato ID o UUID
 */
export async function getStory({ idOrUuid, byUuid = false, resolveRelations }: GetStoryOptions) {
  const storyblok = getContentClient()

  const params: Record<string, any> = {}
  if (byUuid) params.find_by = 'uuid'
  if (resolveRelations?.length) params.resolve_relations = resolveRelations.join(',')

  const response = await storyblok.get(`cdn/stories/${idOrUuid}`, params as any)
  return (response as any).data?.story
}

/**
 * 2. Cerca un elemento in un Datasource
 */
export async function getDatasourceEntry({ datasourceSlugOrId, dimensionValueKey }: GetDatasourceEntryOptions) {
  const storyblok = getContentClient()

  const params: Record<string, any> = {
    datasource: String(datasourceSlugOrId),
    dimension_value: dimensionValueKey,
  }

  const response = await storyblok.get('cdn/datasource_entries', params as any)
  const entries = (response as any).data?.datasource_entries || []
  return entries.length > 0 ? entries[0] : null
}

/**
 * 3. Crea una nuova Story
 */
export async function createStory({ name, slug, component, content = {}, folderId, publish = false }: CreateStoryPayload) {
  if (!SPACE_ID) throw new Error('[CMS] STORYBLOK_SPACE_ID mancante nelle env')
  const storyblok = getManagementClient()

  const storyPayload = {
    name,
    slug,
    parent_id: folderId ? String(folderId) : undefined, // FIX: storyblok vuole sempre string
    content: {
      component,
      ...content,
    },
  }

  const response = await storyblok.post(`spaces/${SPACE_ID}/stories`, {
    story: storyPayload,
    publish: publish ? 1 : 0,
  } as any)

  return (response as any).data?.story
}

/**
 * 4. Carica un nuovo Asset (S3 Multi-part Upload)
 */
export async function uploadAsset({ fileBuffer, fileName, contentType, folderId }: UploadAssetPayload) {
  if (!SPACE_ID) throw new Error('[CMS] STORYBLOK_SPACE_ID mancante nelle env')
  const storyblok = getManagementClient()

  // STEP A: Chiedi la firma d'upload a Storyblok
  const signedResponse = await storyblok.post(`spaces/${SPACE_ID}/assets`, {
    filename: fileName,
    asset_folder_id: folderId ? Number(folderId) : undefined,
  } as any)

  const signedData = (signedResponse as any).data
  if (!signedData || !signedData.fields) {
    throw new Error('[CMS] Impossibile ottenere i dati di firma per caricare l\'asset su S3')
  }

  const formData = new FormData()

  // Campi AWS S3
  Object.keys(signedData.fields).forEach((key) => {
    formData.append(key, signedData.fields[key])
  })

  // FIX Buffer -> Uint8Array per compatibilità Blob in Node.js/Next.js
  const uint8Array = new Uint8Array(fileBuffer)
  const blob = new Blob([uint8Array], { type: contentType })
  formData.append('file', blob, fileName)

  // STEP B: Upload diretto su Amazon S3
  const s3Upload = await fetch(signedData.post_url, {
    method: 'POST',
    body: formData,
  })

  if (!s3Upload.ok) {
    throw new Error(`[CMS] Errore S3 durante l'upload dell'asset: ${s3Upload.statusText}`)
  }

  return {
    id: signedData.id as number,
    url: signedData.pretty_url as string,
  }
}

/**
 * 5. Elimina una Story dato l'ID
 */
export async function deleteStory(storyId: number | string) {
  if (!SPACE_ID) throw new Error('[CMS] STORYBLOK_SPACE_ID mancante nelle env')
  const storyblok = getManagementClient()

  const response = await storyblok.delete(`spaces/${SPACE_ID}/stories/${storyId}`, {})
  return (response as any).data
}

/**
 * 6. Elimina un Asset dato l'ID
 */
export async function deleteAssetById(assetId: number | string) {
  if (!SPACE_ID) throw new Error('[CMS] STORYBLOK_SPACE_ID mancante nelle env')
  const storyblok = getManagementClient()

  const response = await storyblok.delete(`spaces/${SPACE_ID}/assets/${assetId}`, {})
  return (response as any).data
}

/**
 * 7. Elimina un Asset dato l'URL
 */
export async function deleteAssetByUrl(assetUrl: string) {
  if (!SPACE_ID) throw new Error('[CMS] STORYBLOK_SPACE_ID mancante nelle env')
  const storyblok = getManagementClient()

  const params: Record<string, any> = { search: assetUrl }

  const assetsList = await storyblok.get(`spaces/${SPACE_ID}/assets`, params as any)
  const assets = (assetsList as any).data?.assets || []

  const asset = assets.find(
    (a: any) => assetUrl.includes(a.filename) || a.pretty_url?.includes(assetUrl)
  )

  if (!asset) {
    throw new Error(`[CMS] Nessun asset trovato per l'URL: ${assetUrl}`)
  }

  return deleteAssetById(asset.id)
}