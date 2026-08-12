// pages/api/job/create.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createStory } from '@modules/storyblok'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const JOBS_FOLDER_ID = process.env.STORYBLOK_JOBS_FOLDER_ID

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 1. Validazione Token
  const token = req.cookies.miia_auth_token
  if (!token) return res.status(401).json({ message: 'Non autorizzato' })

  try {
    jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Sessione non valida' })
  }

  // 2. Destrutturazione del body
  const { title, companyName, companyId, area, description, tipo_contratto, location, skills } = req.body

  if (!title || !companyName || !companyId) {
    return res.status(400).json({ message: 'Titolo, Nome Azienda e ID Azienda sono obbligatori' })
  }

  try {
    const cleanCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const uniqueSlug = `${cleanCompanyName}-${cleanTitle}-${Date.now()}`

    // 3. Costruzione del Content Allineato allo Schema 'job'
    const jobContent = {
      component: 'job',
      title: title.trim(),
      description: description?.trim() || '',
      area: area || '',
      tipo_contratto: tipo_contratto || '',
      location: location || '',
      skills: skills || [],
      company: companyId,
      business: companyId,
    }

    // 4. Creazione su Storyblok (In stato BOZZA / DRAFT)
    await createStory({
      name: `${companyName} - ${title}`,
      slug: uniqueSlug,
      component: 'job',
      folderId: JOBS_FOLDER_ID,
      content: jobContent,
      publish: false, // 👈 Salvata in Draft
    })

    return res.status(200).json({ message: 'Inserzione creata con successo' })
  } catch (error: any) {
    console.error('[API Job Create Error]', error)
    return res.status(500).json({ message: 'Errore durante la creazione dell\'inserzione' })
  }
}