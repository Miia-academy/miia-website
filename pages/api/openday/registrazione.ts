import type { NextApiRequest, NextApiResponse } from 'next'
import { upsertContact, trackEvent } from '@modules/brevo'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  const { email, area } = req.query

  if (!email || typeof email !== 'string') {
    // Se manca l'email, reindirizza alla home o a un errore generico
    return res.redirect(302, '/')
  }

  const areaQuery = typeof area === 'string' ? area : ''

  try {
    // 1. Recupero eventi tramite Storyblok Delivery API (CDN)
    const sbToken = process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW
    if (!sbToken) {
      throw new Error('NEXT_PUBLIC_STORYBLOK_PREVIEW non configurato')
    }

    const sbRes = await fetch(
      `https://api.storyblok.com/v2/cdn/stories?token=${sbToken}&per_page=100`
    )

    if (!sbRes.ok) {
      throw new Error(`Storyblok API Error: ${sbRes.status}`)
    }

    const sbData = await sbRes.json()

    // 2. Calcolo del prossimo Open Day
    const today = new Date()
    const upcomingEvents = (sbData.stories || [])
      .filter((story: any) => story.content?.date)
      .map((story: any) => ({
        name: story.name,
        date: new Date(story.content.date),
      }))
      .sort((a: any, b: any) => a.date.getTime() - b.date.getTime())
      .filter((ev: any) => ev.date >= today)

    let targetEvent = null

    if (areaQuery) {
      const selectedArea = areaQuery.toLowerCase()
      targetEvent = upcomingEvents.find((ev: any) =>
        ev.name.toLowerCase().includes(selectedArea)
      )
    }

    if (!targetEvent && upcomingEvents.length > 0) {
      targetEvent = upcomingEvents[0]
    }

    let opendayDateStr = ''
    if (targetEvent) {
      opendayDateStr = targetEvent.date.toISOString().split('T')[0]
    }

    // 3. Preparazione Attributi e Chiamate a Brevo
    const attributes: Record<string, string> = {
      ULTIMA_AZIONE: 'openday',
    }

    if (opendayDateStr) {
      attributes.OPENDAY = opendayDateStr
    }

    // Upsert su Brevo
    await upsertContact({
      email: email.trim().toLowerCase(),
      listIds: [16],
      attributes,
    })

    // Trigger automazione Open Day
    await trackEvent({
      eventName: 'submit_open_day',
      email: email.trim().toLowerCase(),
    })

    // 4. Redirect con passaggio parametri di successo
    const redirectUrl = new URL('/conferma', `https://${req.headers.host || 'localhost'}`)
    redirectUrl.searchParams.append('status', 'success')
    redirectUrl.searchParams.append('type', 'openday')
    if (areaQuery) {
      redirectUrl.searchParams.append('area', areaQuery)
    }

    return res.redirect(302, redirectUrl.toString().replace(redirectUrl.origin, ''))

  } catch (error) {
    console.error('[OpenDay Enroll Error]:', error)

    // Redirect con passaggio parametri di errore per feedback visivo
    const errorUrl = new URL('/conferma', `https://${req.headers.host || 'localhost'}`)
    errorUrl.searchParams.append('status', 'error')
    errorUrl.searchParams.append('type', 'openday')

    return res.redirect(302, errorUrl.toString().replace(errorUrl.origin, ''))
  }
}