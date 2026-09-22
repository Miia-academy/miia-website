import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { upsertContact } from '@modules/brevo'
import { createJob } from '@modules/jobs/db'
import type { AuthPayload } from '@modules/auth'

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
      company_name,
      contact_person,
      sms,
      indirizzo,
      website,
      company_description,
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

    const provincieArray = Array.isArray(provincie)
      ? provincie.map((p: string) => String(p).trim().toUpperCase()).filter((p) => p.length === 2)
      : []

    if (!normalizedEmail || !title || !description || provincieArray.length === 0) {
      return res.status(400).json({ message: 'Email azienda, titolo, descrizione e provincie sono obbligatori.' })
    }

    // 1. Sincronizzazione Anagrafica Aziendale su Brevo CRM
    try {
      await upsertContact({
        email: normalizedEmail,
        attributes: {
          TIPO_UTENTE: 'Azienda',
          AZIENDA: company_name ? String(company_name).trim() : '',
          NOME_AZIENDA: company_name ? String(company_name).trim() : '',
          REFERENTE: contact_person ? String(contact_person).trim() : '',
          SMS: sms ? String(sms).trim() : '',
          INDIRIZZO: indirizzo ? String(indirizzo).trim() : '',
          SITO_WEB: website ? String(website).trim() : '',
          DESCRIZIONE: company_description ? String(company_description).trim() : '',
          INSERZIONE_CREATA_DA_ADMIN: true,
          ULTIMO_TITOLO_INSERZIONE: title,
        },
        listIds: [BREVO_LIST_AZIENDE],
      })
    } catch (brevoErr) {
      console.warn('⚠️ Avviso Brevo: Sincronizzazione anagrafica azienda non completata:', brevoErr)
    }

    // 2. Inserimento Inserzione nel DB Neon
    const newJob = await createJob({
      company_email: normalizedEmail,
      title: String(title).trim(),
      description: String(description).trim(),
      provincie: provincieArray,
      tipo_contratto: tipo_contratto || 'indeterminato',
      ral: ral ? String(ral).trim() : '',
      orari_lavoro: orari_lavoro || 'full_time',
      trasferte: trasferte || 'no',
      grado_esperienza: grado_esperienza || 'prima_esperienza',
      competenze: Array.isArray(competenze) ? competenze : [],
      lingue: Array.isArray(lingue) ? lingue : [],
      status: 'attiva',
    })

    return res.status(201).json({
      success: true,
      message: 'Inserzione creata con successo e anagrafica azienda aggiornata.',
      job: newJob,
    })

  } catch (error) {
    console.error('❌ Errore API Admin Create Job:', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}