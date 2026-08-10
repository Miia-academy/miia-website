/**
 * Brevo API Client & Service Layer per Next.js su Vercel
 * Path Alias: @crm/*
 */

const BREVO_API_URL = 'https://api.brevo.com/v3'

// --- TYPINGS ---

export interface BrevoRequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>
  body?: Record<string, any>
}

export interface GetContactOptions {
  identifier: string
  isPhone?: boolean
}

export interface CreateContactPayload {
  email: string
  attributes?: Record<string, any>
  listIds?: number[]
}

export interface UpsertContactPayload {
  email: string
  attributes?: Record<string, any>
  listIds?: number[]
  unlinkListIds?: number[]
}

export interface TrackEventPayload {
  eventName: string
  email: string
  properties?: Record<string, any>
}

export class BrevoError extends Error {
  constructor(public status: number, message: string, public data?: any) {
    super(message)
    this.name = 'BrevoError'
  }
}

// --- CLIENT BASE HTTP (Ultra-fast per Serverless Vercel) ---

export async function brevoFetch<T = any>(
  endpoint: string,
  { params, body, headers, ...customConfig }: BrevoRequestOptions = {}
): Promise<T> {
  const apiKey = process.env.BREVO_MANAGEMENT || process.env.BREVO_TOKEN

  if (!apiKey) {
    throw new Error('[Brevo Client] Missing API Key in environment variables (BREVO_MANAGEMENT or BREVO_TOKEN)')
  }

  // Costruzione pulita della Query String
  let url = `${BREVO_API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  if (params) {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value))
      }
    })
    const queryString = searchParams.toString()
    if (queryString) url += `?${queryString}`
  }

  const response = await fetch(url, {
    ...customConfig,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  // Gestione risposte 204 No Content (es. Delete/Put senza body)
  if (response.status === 204) {
    return {} as T
  }

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMsg = data.message || data.code || `Brevo API Error ${response.status}`
    throw new BrevoError(response.status, errorMsg, data)
  }

  return data as T
}

// --- API FUNZIONALI (LISTA DELLA SPESA) ---

/**
 * 1. Cerca un contatto tramite EMAIL o NUMERO DI TELEFONO
 * Restituisce l'oggetto contatto completo di attributi e liste.
 */
export async function getContact({ identifier, isPhone = false }: GetContactOptions) {
  const formattedIdentifier = isPhone
    ? encodeURIComponent(identifier)
    : encodeURIComponent(identifier.trim().toLowerCase()).replace(/\+/g, '%2B')

  return brevoFetch(`/contacts/${formattedIdentifier}`, {
    method: 'GET',
    params: isPhone ? { identifierType: 'phone_id' } : undefined,
  })
}

/**
 * 2. Crea un NUOVO contatto
 * Fallisce se il contatto esiste già (updateEnabled: false)
 */
export async function createContact({ email, attributes, listIds }: CreateContactPayload) {
  return brevoFetch('/contacts', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      attributes,
      listIds,
      updateEnabled: false,
    },
  })
}

/**
 * 3. Aggiorna (o Crea se non esiste) un contatto (UPSERT)
 * Aggiorna attributi e aggiunge/rimuove le liste specificate.
 */
export async function upsertContact({ email, attributes, listIds, unlinkListIds }: UpsertContactPayload) {
  return brevoFetch('/contacts', {
    method: 'POST',
    body: {
      email: email.trim().toLowerCase(),
      attributes,
      listIds,
      unlinkListIds,
      updateEnabled: true, // 👈 Se esiste aggiorna, se non esiste crea
    },
  })
}

/**
 * 4. Invia un EVENTO custom per scatenare Automazioni / Marketing Automation
 * (es. submit_login con magic_link, job_application, etc.)
 */
export async function trackEvent({ eventName, email, properties }: TrackEventPayload) {
  return brevoFetch('/events', {
    method: 'POST',
    body: {
      event_name: eventName,
      identifiers: {
        email_id: email.trim().toLowerCase(),
      },
      event_properties: properties,
    },
  })
}