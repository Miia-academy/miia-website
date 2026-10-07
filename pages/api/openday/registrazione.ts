import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact, trackEvent } from '@modules/brevo'
import { getJwtSecret } from '@modules/jwt-secret'

const COOKIE_NAME = 'miia_openday_richiesta'
const COOKIE_MAX_AGE = 30 * 60 // 30 minuti per confermare
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RichiestaOpenday {
  email: string
  area: string
}

function readRichiesta(req: NextApiRequest): RichiestaOpenday | null {
  const token = req.cookies[COOKIE_NAME]
  if (!token) return null
  try {
    const d = jwt.verify(token, getJwtSecret()) as Partial<RichiestaOpenday> & { purpose?: string }
    if (d.purpose !== 'openday' || !d.email) return null
    return { email: d.email, area: d.area || '' }
  } catch {
    return null
  }
}

// GET: il link nelle email. Non iscrive nessuno: ricorda la richiesta in un cookie
// firmato (l'email non viaggia verso la pagina di conferma) e porta alla pagina dove
// la persona conferma con un click.
function handleLink(req: NextApiRequest, res: NextApiResponse) {
  const { email, area } = req.query
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    return res.redirect(302, '/')
  }

  const areaValue = typeof area === 'string' ? area.trim().slice(0, 60) : ''
  const token = jwt.sign({ purpose: 'openday', email: cleanEmail, area: areaValue }, getJwtSecret(), {
    expiresIn: COOKIE_MAX_AGE,
  })

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure}`
  )

  const target = new URL('/conferma', 'https://miia.it')
  target.searchParams.set('type', 'openday')
  target.searchParams.set('status', 'confirm')
  if (areaValue) target.searchParams.set('area', areaValue)
  return res.redirect(302, target.pathname + target.search)
}

// POST: la persona ha cliccato "Confermo la partecipazione"
async function handleConfirm(req: NextApiRequest, res: NextApiResponse) {
  const richiesta = readRichiesta(req)
  if (!richiesta) {
    return res.status(400).json({ ok: false, message: 'Richiesta scaduta o non valida.' })
  }

  const email = richiesta.email
  const areaQuery = richiesta.area

  try {
    const sbToken = process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW
    if (!sbToken) {
      throw new Error('NEXT_PUBLIC_STORYBLOK_PREVIEW non configurato')
    }

    // Aggiunto filtro content_type=event
    const sbRes = await fetch(
      `https://api.storyblok.com/v2/cdn/stories?token=${sbToken}&per_page=100&content_type=event`
    )

    if (!sbRes.ok) {
      throw new Error(`Storyblok API Error: ${sbRes.status}`)
    }

    const sbData = await sbRes.json()

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
    let opendayDataLocale = ''

    if (targetEvent) {
      opendayDateStr = targetEvent.date.toISOString().split('T')[0]
      opendayDataLocale = targetEvent.date.toLocaleDateString('it-IT', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }

    const attributes: Record<string, string> = {
      ULTIMA_AZIONE: 'openday',
    }

    if (opendayDateStr) {
      attributes.OPENDAY = opendayDateStr
    }

    await upsertContact({
      email,
      listIds: [16],
      attributes,
    })

    await trackEvent({
      eventName: 'submit_open_day',
      email,
    })

    // La richiesta è usata: il cookie non serve più
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)

    return res.status(200).json({ ok: true, openday_data: opendayDataLocale })
  } catch (error) {
    console.error('[OpenDay Enroll Error]:', error)
    return res.status(502).json({ ok: false, message: 'Iscrizione non riuscita.' })
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return handleLink(req, res)
  if (req.method === 'POST') return handleConfirm(req, res)
  return res.status(405).json({ message: 'Method Not Allowed' })
}
