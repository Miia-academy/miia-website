// pages/api/brevo.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export interface BrevoEvent {
  identifiers: { email_id: string }
  event_name: string
  event_date?: string
  event_properties: { [key: string]: string | number | boolean }
}

export interface BrevoContact {
  id?: string | number
  listIds?: Array<number>
  email: string
  attributes?: {
    [key: string]: any
  }
  updateEnabled?: boolean
}

interface BrevoRequestBody {
  event?: BrevoEvent
  contact?: BrevoContact
}

const apiUrl = 'https://api.brevo.com/v3'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  // Verifica i metodi consentiti
  if (!['POST', 'PUT', 'GET'].includes(req.method || '')) {
    res.setHeader('Allow', ['POST', 'PUT', 'GET'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const token = process.env.BREVO_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'Missing Brevo Api Token' })
  }

  const optionsInit: RequestInit = {
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': token,
    },
  }

  try {
    // --- 1. GESTIONE CHIAMATE GET (Lettura Contatto) ---
    if (req.method === 'GET') {
      const email = req.query.email as string
      if (!email) {
        return res.status(400).json({ error: 'Email query param required for GET' })
      }

      const getRes = await fetch(`${apiUrl}/contacts/${encodeURIComponent(email)}`, {
        ...optionsInit,
        method: 'GET',
      })

      if (!getRes.ok) {
        const errData = await getRes.json().catch(() => ({}))
        return res.status(getRes.status).json({ error: errData || 'Brevo API Error' })
      }

      const data = await getRes.json()
      return res.status(200).json(data)
    }

    // --- 2. GESTIONE CHIAMATE POST/PUT (Upsert Contatto e Tracking Eventi) ---
    const { contact, event }: BrevoRequestBody = req.body
    let contactData = null

    // A. Sincronizzazione Contatto (se presente nel body)
    if (contact) {
      let contactEndpoint = `${apiUrl}/contacts`
      let contactOptions = { ...optionsInit }

      if (contact.id) {
        // Aggiornamento esatto per ID
        contactEndpoint += `/${contact.id}`
        contactOptions.method = 'PUT'
        contactOptions.body = JSON.stringify(contact)
      } else if (req.method === 'PUT') {
        // Aggiornamento per Email
        contactEndpoint += `/${encodeURIComponent(contact.email)}`
        contactOptions.method = 'PUT'
        contactOptions.body = JSON.stringify(contact)
      } else {
        // POST con Upsert (Crea o Aggiorna in sicurezza tramite l'email)
        contactOptions.method = 'POST'
        contactOptions.body = JSON.stringify({ ...contact, updateEnabled: true })
      }

      const contactRes = await fetch(contactEndpoint, contactOptions)

      if (
        contactRes.status !== 204 &&
        contactRes.headers.get('content-type')?.includes('application/json')
      ) {
        try {
          contactData = await contactRes.json()
        } catch (error) {
          console.warn('Contact JSON parse error:', error)
        }
      }

      if (!contactRes.ok) {
        return res.status(contactRes.status).json({ error: contactData || 'Error syncing contact' })
      }
    }

    // B. Tracking Evento (se presente nel body)
    if (event) {
      const eventOptions = {
        ...optionsInit,
        method: 'POST',
        body: JSON.stringify(event),
      }
      const eventRes = await fetch(`${apiUrl}/events`, eventOptions)

      let eventData = null
      if (
        eventRes.status !== 204 &&
        eventRes.headers.get('content-type')?.includes('application/json')
      ) {
        try {
          eventData = await eventRes.json()
        } catch (error) {
          console.warn('Event JSON parse error:', error)
        }
      }

      if (!eventRes.ok) {
        return res.status(eventRes.status).json({ error: eventData || 'Error tracking event' })
      }
    }

    return res.status(200).json({ success: true, contact: contactData })

  } catch (error) {
    console.error('Brevo Api call failed:', error)
    return res.status(500).json({ error: 'Internal server Error' })
  }
}