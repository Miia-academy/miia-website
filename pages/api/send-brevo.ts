import type { NextApiRequest, NextApiResponse } from 'next'

export interface BrevoEvent {
  identifiers: { email_id: string }
  event_name: string
  event_date?: string
  event_properties: { [key: string]: string | number }
}

export interface BrevoContact {
  id?: string | number
  listIds?: Array<number>
  email: string
  attributes: {
    [key: string]: any
  }
}

interface BrevoRequestBody {
  event?: BrevoEvent
  contact: BrevoContact
}

const apiUrl = 'https://api.brevo.com/v3'

type BrevoResponse = {}

export default async function sendBrevo(
  req: NextApiRequest,
  res: NextApiResponse<BrevoResponse>
): Promise<void> {
  if (req.method !== 'POST') {
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

  const { contact, event }: BrevoRequestBody = req.body

  try {
    // Contact API call
    let contactEndpoint = `${apiUrl}/contacts/`
    let contactOptions = { ...optionsInit }

    if (!event) {
      contactEndpoint += contact.email
      contactOptions.method = 'GET'
    } else {
      if (contact.id) {
        contactEndpoint += contact.id
        contactOptions.method = 'PUT'
      } else {
        contactOptions.method = 'POST'
      }
      contactOptions.body = JSON.stringify(contact)
    }

    const contactRes = await fetch(contactEndpoint, contactOptions)
    let contactData = null
    if (
      contactRes.status !== 204 &&
      contactRes.headers.get('content-type')?.includes('application/json')
    ) {
      try {
        contactData = await contactRes.json()
      } catch (error) {
        // Only log error if parsing fails
        console.warn('Contact JSON parse error:', error)
      }
    }
    if (!contactRes.ok) {
      return res
        .status(contactRes.status)
        .json({ error: contactData || 'Brevo API Error' })
    } else if (contactRes.ok && !event) {
      const { id, email, attributes } = contactData || {}
      return res.status(200).json({ id, email, attributes })
    }

    // Event API call
    if (event) {
      let eventEndpoint = `${apiUrl}/events`
      let eventOptions = {
        ...optionsInit,
        method: 'POST',
        body: JSON.stringify(event),
      }

      const eventRes = await fetch(eventEndpoint, eventOptions)
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
        return res
          .status(eventRes.status)
          .json({ error: eventData || 'Brevo API Error' })
      }
    }
    return res.status(200).json(contactData)
  } catch (error) {
    console.error('Brevo Api call failed:', error)
    return res.status(500).json({ error: 'Internal server Error' })
  }
}
