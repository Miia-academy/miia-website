import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { createStory, deleteStory } from '@modules/storyblok'
import type { Job } from '@types'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const JOBS_FOLDER_ID = process.env.STORYBLOK_JOBS_FOLDER_ID

/**
 * Helper per verificare l'autenticazione tramite il Cookie HttpOnly (miia_auth_token)
 */
function getAuthenticatedEmail(req: NextApiRequest): string | null {
  const token = req.cookies.miia_auth_token
  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { email?: string }
    return decoded.email || null
  } catch (err) {
    return null
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const method = req.method

  switch (method) {
    // ------------------------------------------------------------------
    // 1. POST: Creazione di una nuova inserzione di lavoro (Draft su Storyblok)
    // ------------------------------------------------------------------
    case 'POST': {
      const userEmail = getAuthenticatedEmail(req)
      const { company, title, description, location, area, business, logoUrl, email } = req.body

      // Validazione minima obbligatoria
      if (!company || !title) {
        return res.status(400).json({
          message: 'Azienda e Titolo dell\'offerta sono campi obbligatori.'
        })
      }

      if (!JOBS_FOLDER_ID) {
        console.error('[API /api/jobs] Variabile d\'ambiente STORYBLOK_JOBS_FOLDER_ID mancante.')
        return res.status(500).json({
          message: 'Configurazione server incompleta: ID cartella Storyblok mancante.'
        })
      }

      try {
        // Costruzione dell'oggetto content conforme all'interfaccia Job di @types
        const jobContent: Job = {
          component: 'job',
          _uid: '', // Verrà assegnato automaticamente da Storyblok
          company: company.trim(),
          title: title.trim(),
          description: description ? description.trim() : '',
          location: location ? location.trim() : '',
          area: area || '', // es. "interior" | "fashion"
          business: business || '',
          logo: logoUrl ? { filename: logoUrl, fieldtype: 'asset' } : undefined,
          // Tracciamo l'email del creatore (dall'utente autenticato o dal form)
          company_email: userEmail || email || '',
        } as any

        // Sanitizzazione e generazione di uno slug univoco per Storyblok
        const cleanCompany = company.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        const uniqueSlug = `job-${cleanCompany}-${cleanTitle}-${Date.now()}`

        // Creazione della Story tramite il Management Client (@modules/storyblok)
        const newStory = await createStory({
          name: `${company} - ${title}`,
          slug: uniqueSlug,
          component: 'job',
          folderId: JOBS_FOLDER_ID, // Unica cartella jobs per tutti i settori
          content: jobContent,
          publish: false, // 👈 Rimane in DRAFT per consentire la review degli admin
        })

        return res.status(201).json({
          message: 'Inserzione creata con successo! È ora in attesa di approvazione.',
          story: newStory,
        })
      } catch (error: any) {
        console.error('[API /api/jobs POST Error]', error)
        return res.status(500).json({
          message: error.message || 'Errore interno durante la creazione del job.'
        })
      }
    }

    // ------------------------------------------------------------------
    // 2. DELETE: Eliminazione di un'inserzione esistente
    // ------------------------------------------------------------------
    case 'DELETE': {
      const userEmail = getAuthenticatedEmail(req)
      if (!userEmail) {
        return res.status(401).json({
          message: 'Operazione non autorizzata. Effettua prima l\'accesso.'
        })
      }

      const { storyId } = req.query

      if (!storyId || typeof storyId !== 'string') {
        return res.status(400).json({
          message: 'Parametro storyId mancante o non valido.'
        })
      }

      try {
        await deleteStory(storyId)
        return res.status(200).json({
          message: 'Inserzione eliminata con successo.'
        })
      } catch (error: any) {
        console.error('[API /api/jobs DELETE Error]', error)
        return res.status(500).json({
          message: error.message || 'Errore durante l\'eliminazione dell\'inserzione.'
        })
      }
    }

    // ------------------------------------------------------------------
    // Default: Metodi HTTP non supportati
    // ------------------------------------------------------------------
    default: {
      res.setHeader('Allow', ['POST', 'DELETE'])
      return res.status(405).json({ message: `Metodo ${method} non consentito.` })
    }
  }
}