import type { NextApiRequest, NextApiResponse } from 'next'
import { BrevoError } from '@modules/brevo'
import { campagnaEsistente, creaBozza, firmaValida, type ArticoloNewsletter } from '@modules/newsletter'

// Webhook di Storyblok "Story published": serve il corpo grezzo per controllare la firma
export const config = { api: { bodyParser: false } }

async function corpoGrezzo(req: NextApiRequest): Promise<string> {
  const parti: Buffer[] = []
  for await (const parte of req) parti.push(typeof parte === 'string' ? Buffer.from(parte) : parte)
  return Buffer.concat(parti).toString('utf8')
}

function storyblokToken(): string {
  return (
    process.env.STORYBLOK_TOKEN ||
    process.env.NEXT_PUBLIC_STORYBLOK_TOKEN ||
    process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW ||
    ''
  )
}

async function leggiArticolo(storyId: number): Promise<ArticoloNewsletter | null> {
  const token = storyblokToken()
  if (!token) throw new Error('Token Storyblok non configurato')
  const url = `https://api.storyblok.com/v2/cdn/stories/${storyId}?version=published&token=${token}&cv=${Date.now()}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Storyblok ${res.status}`)
  const data = await res.json()
  return data.story || null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'Metodo non consentito' })
  }

  const secret = process.env.STORYBLOK_WEBHOOK_SECRET || ''
  if (!secret) {
    console.error('[newsletter] STORYBLOK_WEBHOOK_SECRET non configurato')
    return res.status(503).json({ ok: false, message: 'Webhook non configurato' })
  }

  const body = await corpoGrezzo(req)
  const firma = req.headers['webhook-signature']
  if (!firmaValida(body, Array.isArray(firma) ? firma[0] : firma, secret)) {
    return res.status(401).json({ ok: false, message: 'Firma non valida' })
  }

  let evento: { action?: string; story_id?: number | string }
  try {
    evento = JSON.parse(body)
  } catch {
    return res.status(400).json({ ok: false, message: 'Corpo non valido' })
  }

  const storyId = Number(evento.story_id)
  if (evento.action !== 'published' || !Number.isInteger(storyId) || storyId <= 0) {
    return res.status(200).json({ ok: true, esito: 'ignorato' })
  }

  try {
    const story = await leggiArticolo(storyId)
    if (!story || story.content?.component !== 'article' || story.content?.newsletter !== true) {
      return res.status(200).json({ ok: true, esito: 'nessuna newsletter' })
    }

    const esistente = await campagnaEsistente(storyId)
    if (esistente) {
      return res.status(200).json({ ok: true, esito: 'già creata', campagna: esistente.id })
    }

    const bozza = await creaBozza(story)
    console.info(`[newsletter] bozza ${bozza.id} "${bozza.nome}" per il segmento ${bozza.segmento}`)
    return res.status(201).json({ ok: true, esito: 'bozza creata', campagna: bozza.id })
  } catch (error) {
    const messaggio = error instanceof BrevoError ? `Brevo ${error.status}: ${error.message}` : String(error)
    console.error(`[newsletter] articolo ${storyId}: ${messaggio}`)
    return res.status(500).json({ ok: false, message: 'Bozza non creata' })
  }
}
