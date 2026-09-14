import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact } from '@modules/brevo'
import { neon } from '@neondatabase/serverless'
import type { AuthPayload } from '@modules/auth'

const sql = neon(process.env.DATABASE_URL!)
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'
const BREVO_LIST_AZIENDE = Number(process.env.BREVO_AZIENDE_LIST_ID) || 43

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const token = req.cookies['miia_auth_token']
  if (!token) return res.status(401).json({ message: 'Autenticazione mancante' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (decoded.tipo_utente !== 'Admin') {
      return res.status(403).json({ message: 'Accesso negato: rotta riservata all\'Admin' })
    }

    const {
      company_email,
      title,
      description,
      provincie,
      tipo_contratto,
      ral,
      orari_lavoro,
      trasferte,
      grado_esperienza,
      competenze,
      lingue,
    } = req.body

    const normalizedEmail = company_email?.trim().toLowerCase()

    if (!normalizedEmail || !title || !description || !provincie || provincie.length === 0) {
      return res.status(400).json({ message: 'Email azienda, titolo, descrizione e provincia sono obbligatori.' })
    }

    // 1. Sincronizzazione Silenziosa Azienda su Brevo (Senza Magic Link o Flow di Registrazione)
    try {
      await upsertContact({
        email: normalizedEmail,
        attributes: {
          TIPO_UTENTE: 'Azienda',
          INSERZIONE_CREATA_DA_ADMIN: true,
          ULTIMO_TITOLO_INSERZIONE: title,
        },
        listIds: [BREVO_LIST_AZIENDE],
      })
    } catch (brevoErr) {
      console.warn('⚠️ Avviso Brevo: Creazione contatto azienda non completata:', brevoErr)
    }

    // 2. Inserimento Job nel Database Neon
    const provinciaPrincipale = provincie[0] || 'TV'

    const rows = await sql`
      INSERT INTO jobs (
        title, 
        description, 
        company_email, 
        provincia, 
        provincie, 
        tipo_contratto, 
        ral, 
        orari_lavoro, 
        trasferte, 
        grado_esperienza, 
        competenze, 
        lingue, 
        status
      )
      VALUES (
        ${title}, 
        ${description}, 
        ${normalizedEmail}, 
        ${provinciaPrincipale}, 
        ${JSON.stringify(provincie)}, 
        ${tipo_contratto || 'indeterminato'}, 
        ${ral || ''}, 
        ${orari_lavoro || 'full_time'}, 
        ${trasferte || 'no'}, 
        ${grado_esperienza || 'prima_esperienza'}, 
        ${JSON.stringify(competenze || [])}, 
        ${JSON.stringify(lingue || [])}, 
        'attiva'
      )
      RETURNING id, title, company_email, status, created_at
    `

    return res.status(201).json({
      success: true,
      message: 'Inserzione creata con successo e assegnata all\'azienda.',
      job: rows[0],
    })

  } catch (error) {
    console.error('❌ Errore API Admin Create Job:', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}