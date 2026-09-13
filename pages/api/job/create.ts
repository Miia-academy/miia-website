import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { createJob } from '@modules/jobs/db'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  try {
    // 1. Controllo Autenticazione tramite Cookie HttpOnly
    const token = req.cookies['miia_auth_token']
    if (!token) {
      return res.status(401).json({ message: 'Non autorizzato: Sessione mancante' })
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    // 2. Controllo Ruolo Azienda
    if (decoded.tipo_utente !== 'Azienda') {
      return res.status(403).json({ message: 'Accesso negato: Solamente le aziende possono pubblicare annunci' })
    }

    // 3. Estrazione e Validazione Input secondo lo schema DB reale
    const { title, description, provincia, competenze } = req.body

    if (!title || !description || !provincia) {
      return res.status(400).json({ message: 'I campi titolo, descrizione e provincia sono obbligatori' })
    }

    // Validazione sigla provincia (2 caratteri)
    const cleanProvincia = String(provincia).trim().toUpperCase()
    if (cleanProvincia.length !== 2) {
      return res.status(400).json({ message: 'La provincia deve essere una sigla valida di 2 lettere (es. MI, RM)' })
    }

    // Normalizzazione array competenze
    const competenzeArray = Array.isArray(competenze)
      ? competenze.map((c: string) => c.trim()).filter(Boolean)
      : []

    // 4. Salvataggio su Neon PostgreSQL
    const newJob = await createJob({
      company_email: decoded.email,
      title: String(title).trim(),
      description: String(description).trim(),
      provincia: cleanProvincia,
      competenze: competenzeArray,
    })

    return res.status(201).json({
      message: 'Annuncio pubblicato con successo!',
      job: newJob,
    })
  } catch (error: any) {
    console.error('[API Create Job Error]', error)
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Sessione non valida o scaduta' })
    }
    return res.status(500).json({ message: 'Errore interno durante la creazione dell\'annuncio' })
  }
}