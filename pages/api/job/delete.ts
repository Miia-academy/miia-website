// pages/api/job/delete.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { deleteStory } from '@modules/storyblok' // Solo le funzioni che effettivamente esporti
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import StoryblokClient from 'storyblok-js-client'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const MANAGEMENT_TOKEN = process.env.STORYBLOK_MANAGEMENT
const SPACE_ID = process.env.STORYBLOK_SPACE_ID

// Inizializzazione corretta del client per la Management API
const storyblokManagement = new StoryblokClient({ oauthToken: MANAGEMENT_TOKEN })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 1. Check Autenticazione
  const token = req.cookies.miia_auth_token
  if (!token) return res.status(401).json({ message: 'Non autorizzato' })

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (!authData.storyblok_id) throw new Error('UUID Azienda mancante')
  } catch {
    return res.status(401).json({ message: 'Sessione non valida' })
  }

  const { jobId } = req.body // L'ID del Job da eliminare

  if (!jobId) {
    return res.status(400).json({ message: 'ID Inserzione mancante' })
  }

  try {
    // 2. Controllo di Ownership (Sicurezza)
    // Recuperiamo la storia dalla Management API per leggere il contenuto originale
    const response = await storyblokManagement.get(`spaces/${SPACE_ID}/stories/${jobId}`)
    const story = response.data.story

    // Verifichiamo che il campo relazionale 'company' coincida con lo storyblok_id dell'utente loggato
    const jobCompanyId = story.content?.company

    if (jobCompanyId !== authData.storyblok_id) {
      return res.status(403).json({ message: 'Azione negata: non sei il proprietario di questa inserzione' })
    }

    // 3. Se il controllo passa, eliminiamo la storia
    await deleteStory(jobId)

    return res.status(200).json({ message: 'Inserzione eliminata con successo' })
  } catch (error: any) {
    console.error('[API Job Delete Error]', error)
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Inserzione non trovata' })
    }
    return res.status(500).json({ message: 'Errore durante l\'eliminazione dell\'inserzione' })
  }
}