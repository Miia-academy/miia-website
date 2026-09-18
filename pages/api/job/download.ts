import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { Storage } from '@google-cloud/storage'
import { markCvDownloaded } from '@modules/applications/db'
import { trackEvent } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const PRIVATE_BUCKET_NAME = process.env.GCS_BUCKET_PRIVATE || 'miia-documents'
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

function getStorageClient() {
  const clientEmail = process.env.GCS_CLIENT_EMAIL
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) {
    throw new Error('[GCS] Credenziali di servizio mancanti nelle variabili d\'ambiente')
  }

  return new Storage({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const { file, application_id } = req.query

  try {
    const filePath = typeof file === 'string' ? file.trim() : ''

    if (!filePath) {
      return res.status(400).json({ message: 'Parametro file mancante o non valido.' })
    }

    const token = req.cookies['miia_auth_token']
    if (token && typeof application_id === 'string' && application_id.trim()) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
        if (decoded.tipo_utente === 'Azienda' || decoded.tipo_utente === 'Admin') {
          // Aggiornamento logico su DB
          await markCvDownloaded(application_id.trim())

          // Tracciamento CRM in capo all'utente che ha scaricato il CV
          await trackEvent({
            eventName: 'cv_downloaded',
            email: decoded.email,
            properties: {
              application_id: application_id.trim(),
              file_path: filePath,
              tipo_utente: decoded.tipo_utente,
            },
          })
        }
      } catch (authErr) {
        console.warn('[API Job Download] Token non valido per tracciamento download:', authErr)
      }
    }

    const storage = getStorageClient()
    const bucket = storage.bucket(PRIVATE_BUCKET_NAME)
    const gcsFile = bucket.file(filePath)

    const [exists] = await gcsFile.exists()
    if (!exists) {
      return res.status(404).json({ message: 'Curriculum Vitae non trovato sul server.' })
    }

    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })

    return res.redirect(302, signedUrl)

  } catch (error: any) {
    console.error('[API Job Download Error]', error)
    return res.status(500).json({ message: 'Errore durante la generazione del link di download' })
  }
}