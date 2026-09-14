import type { NextApiRequest, NextApiResponse } from 'next'
import { sql } from '@modules/db'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validazione del Token HttpOnly
  const token = req.cookies.miia_auth_token
  if (!token) return res.status(401).json({ message: 'Accesso negato. Effettua il login.' })

  let authData: AuthPayload
  try {
    authData = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Sessione scaduta o non valida.' })
  }

  const { email, tipo_utente } = authData

  // 2. Metodo GET: Lettura dinamica in base al ruolo
  if (req.method === 'GET') {
    try {
      if (tipo_utente === 'Azienda') {
        // L'azienda vede tutte le sue inserzioni (anche quelle in pausa/chiuse)
        const jobs = await sql`
          SELECT * FROM jobs 
          WHERE company_email = ${email} 
          ORDER BY created_at DESC
        `
        return res.status(200).json(jobs)
      } else {
        // Lo studente vede solo le inserzioni attive (qui in futuro aggiungeremo il matching)
        const jobs = await sql`
          SELECT * FROM jobs 
          WHERE status = 'attiva' 
          ORDER BY created_at DESC
        `
        return res.status(200).json(jobs)
      }
    } catch (error) {
      console.error('[API GET Jobs Error]', error)
      return res.status(500).json({ message: 'Errore di connessione al database.' })
    }
  }

  // 3. Metodo POST: Creazione nuova inserzione
  if (req.method === 'POST') {
    // Sicurezza aggiuntiva: gli studenti non possono creare lavori
    if (tipo_utente !== 'Azienda') {
      return res.status(403).json({ message: 'Azione non consentita.' })
    }

    const { title, description, provincia, competenze } = req.body

    try {
      const newJob = await sql`
        INSERT INTO jobs (company_email, title, description, provincia, competenze)
        VALUES (${email}, ${title}, ${description}, ${provincia}, ${competenze || '{}'})
        RETURNING *;
      `
      return res.status(201).json({
        message: 'Inserzione creata con successo!',
        job: newJob[0]
      })
    } catch (error) {
      console.error('[API POST Jobs Error]', error)
      return res.status(500).json({ message: 'Errore durante il salvataggio.' })
    }
  }

  // Fallback per metodi non supportati
  return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
}