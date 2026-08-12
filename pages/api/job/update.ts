// pages/api/job/update.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { updateStory } from '@modules/storyblok'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import StoryblokClient from 'storyblok-js-client'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT
const SPACE_ID = process.env.STORYBLOK_SPACE_ID

const storyblokManagement = new StoryblokClient({ oauthToken: MANAGEMENT_TOKEN })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 1. Validazione Token[cite: 15, 16]
  const token = req.cookies.miia_auth_token
  if (!token) return res.status(401).json({ message: 'Non autorizzato' })

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (!authData.storyblok_id) throw new Error('UUID Azienda mancante')
  } catch {
    return res.status(401).json({ message: 'Sessione non valida' })
  }

  const { jobId, title, location, skills, description } = req.body

  if (!jobId || !title) {
    return res.status(400).json({ message: 'ID Inserzione e Titolo sono obbligatori' })
  }

  try {
    // 2. Controllo di Ownership (Sicurezza)[cite: 15]
    const response = await storyblokManagement.get(`spaces/${SPACE_ID}/stories/${jobId}`)
    const story = response.data.story

    const jobCompanyId = story.content?.company || story.content?.business

    if (jobCompanyId !== authData.storyblok_id && jobCompanyId !== authData.storyblok_uuid) {
      return res.status(403).json({ message: 'Azione negata: non sei il proprietario di questa inserzione' })
    }

    // 3. Aggiornamento dei campi (mantenendo inalterati gli altri campi esistenti)
    const updatedContent = {
      ...story.content,
      title: title.trim(),
      location: location || '',
      skills: Array.isArray(skills) ? skills : [], // Allineato al nuovo schema
      description: description?.trim() || '',
    }

    // 4. Esecuzione Update su Storyblok
    await updateStory(jobId, updatedContent)

    return res.status(200).json({ message: 'Inserzione aggiornata con successo' })
  } catch (error: any) {
    console.error('[API Job Update Error]', error)
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Inserzione non trovata' })
    }
    return res.status(500).json({ message: 'Errore durante l\'aggiornamento dell\'inserzione' })
  }
}