import { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { updateApplicationStatus } from '@modules/applications/db' // Assicurati che il percorso sia corretto

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Accettiamo solo il metodo PUT per gli aggiornamenti
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // 2. Gatekeeper: Estrazione e validazione del Token
  const token = req.cookies['miia_auth_token']

  if (!token) {
    return res.status(401).json({ message: 'Autenticazione mancante' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any

    // Sicurezza ferrea: solo l'Admin può cambiare lo stato
    if (decoded.tipo_utente !== 'Admin') {
      return res.status(403).json({ message: 'Accesso negato: Privilegi insufficienti' })
    }

    // 3. Estrazione dei dati dalla richiesta
    const applicationId = req.query.id as string
    const { status } = req.body

    if (!status) {
      return res.status(400).json({ message: 'Nuovo stato mancante nel payload' })
    }

    // 4. Aggiornamento nel Database
    await updateApplicationStatus(applicationId, status)

    return res.status(200).json({ success: true, message: 'Stato candidatura aggiornato con successo' })

  } catch (error) {
    console.error('❌ Errore API update application:', error)
    return res.status(500).json({ message: 'Errore interno del server' })
  }
}