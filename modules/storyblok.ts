// modules/storyblok.ts
import StoryblokClient from 'storyblok-js-client'

const SPACE_ID = process.env.STORYBLOK_SPACE_ID
const MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT

const LOGOS_FOLDER_ID = process.env.STORYBLOK_LOGOS_FOLDER_ID || 688306
const BUSINESS_FOLDER_ID = process.env.STORYBLOK_BUSINESS_FOLDER_ID || 680213142
const JOBS_FOLDER_ID = process.env.STORYBLOK_JOBS_FOLDER_ID || 207534502691477

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

export interface CreateCompanyStoryParams {
  companyName: string
  contactName: string
  contactEmail: string
  settore: string
  logoUrl?: string
  folderId?: string | number
}

export interface CreateJobStoryParams {
  companyName: string
  title: string
  description?: string
  location?: string
  area?: string
  business?: string
  logoUrl?: string
  companyEmail?: string
  companyId?: string
  folderId?: string | number
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
    // Se riceve un UUID (con i trattini), recupera la storia cercando per UUID
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

    // Altrimenti esegue la GET diretta con l'ID numerico
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

  const targetFolderId =
    folderId ||
    (component === 'business'
      ? BUSINESS_FOLDER_ID
      : component === 'job'
        ? JOBS_FOLDER_ID
        : undefined)

  if (targetFolderId) {
    const parsedFolderId = Number(targetFolderId)
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
 * 3. Helper Creazione Azienda (In stato Draft)
 */
export async function createCompanyStory({
  companyName,
  contactName,
  contactEmail,
  settore,
  logoUrl,
  folderId,
}: CreateCompanyStoryParams) {
  const cleanSlug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  const rawSettore = settore === 'moda' ? 'moda' : 'interni'
  const storyName = `azienda ${rawSettore} ${companyName}`

  const content: Record<string, any> = {
    title: companyName,
    nome: companyName,
    contact_person: contactName,
    email: contactEmail,
    area: rawSettore === 'moda' ? 'fashion' : 'interior',
  }

  if (logoUrl && logoUrl.trim() !== '') {
    content.logo = {
      filename: logoUrl,
      fieldtype: 'asset',
    }
  }

  return createStory({
    name: storyName,
    slug: cleanSlug,
    component: 'business',
    folderId: folderId || BUSINESS_FOLDER_ID,
    content,
    publish: false, // In stato Draft
  })
}

/**
 * 4. Helper Creazione Job (In stato Draft)
 */
export async function createJobStory({
  companyName,
  title,
  description = '',
  location = '',
  area = 'interior',
  business = '',
  logoUrl,
  companyEmail = '',
  companyId,
  folderId,
}: CreateJobStoryParams) {
  const cleanCompany = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const uniqueSlug = `job-${cleanCompany}-${cleanTitle}-${Date.now()}`

  const content: Record<string, any> = {
    company: companyId || companyName,
    title: title.trim(),
    description: description.trim(),
    location: location.trim(),
    area,
    business,
    company_email: companyEmail,
  }

  if (logoUrl && logoUrl.trim() !== '') {
    content.logo = {
      filename: logoUrl,
      fieldtype: 'asset',
    }
  }

  return createStory({
    name: `${companyName} - ${title}`,
    slug: uniqueSlug,
    component: 'job',
    folderId: folderId || JOBS_FOLDER_ID,
    content,
    publish: false, // In stato Draft
  })
}

/**
 * 5. Eliminazione Story
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
 * 6. Upload Asset loghi su S3 Storyblok
 */
export async function uploadAssetToStoryblok(
  fileBuffer: Buffer,
  filename: string,
  contentType: string,
  folderId?: string | number
): Promise<string> {
  if (!SPACE_ID) throw new Error('STORYBLOK_SPACE_ID non impostato')

  const targetFolderId = folderId || LOGOS_FOLDER_ID
  const cleanFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

  const uploadPayload: Record<string, any> = { filename: cleanFileName }
  if (targetFolderId) {
    const parsedFolder = Number(targetFolderId)
    if (!isNaN(parsedFolder) && parsedFolder > 0) {
      uploadPayload.asset_folder_id = parsedFolder
    }
  }

  const uploadResponse: any = await (storyblok as any).post(
    `spaces/${SPACE_ID}/assets`,
    uploadPayload
  )

  const responseData = uploadResponse?.data || uploadResponse
  const { public_url, pretty_url, post_url, post_address, fields } = responseData || {}

  const targetPostUrl = post_url || post_address

  if (!targetPostUrl || typeof targetPostUrl !== 'string') {
    throw new Error(`Impossibile ottenere l'URL di destinazione da Storyblok.`)
  }

  const formData = new FormData()
  if (fields) {
    Object.keys(fields).forEach((key) => {
      formData.append(key, fields[key])
    })
  }

  const uint8Array = new Uint8Array(fileBuffer)
  formData.append('file', new Blob([uint8Array], { type: contentType }), cleanFileName)

  const s3Upload = await fetch(targetPostUrl, {
    method: 'POST',
    body: formData,
  })

  if (!s3Upload.ok) {
    throw new Error(`Errore durante il caricamento dell'asset (${s3Upload.statusText})`)
  }

  return public_url || (pretty_url ? `https:${pretty_url}` : '')
}

/**
 * 7. Update Story
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
      publish: 0, // Mantiene la storia in stato Draft
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