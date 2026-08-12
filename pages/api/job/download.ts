// pages/api/job/download.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { Storage } from '@google-cloud/storage'

const PRIVATE_BUCKET_NAME = process.env.GCS_BUCKET_PRIVATE || 'miia-documents'

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

  // Ora ci aspettiamo solo il parametro "file" (il path esatto su GCS)
  const { file } = req.query

  try {
    const filePath = typeof file === 'string' ? file.trim() : ''

    if (!filePath) {
      return res.status(400).json({ message: 'Parametro file mancante o non valido.' })
    }

    // Generazione della Signed URL temporanea (7 giorni) dal Bucket Privato GCS
    const storage = getStorageClient()
    const bucket = storage.bucket(PRIVATE_BUCKET_NAME)
    const gcsFile = bucket.file(filePath)

    // Verifica se il file esiste realmente per evitare redirect a vuoto
    const [exists] = await gcsFile.exists()
    if (!exists) {
      return res.status(404).json({ message: 'Curriculum Vitae non trovato sul server.' })
    }

    const [signedUrl] = await gcsFile.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // Validità 7 giorni
    })

    // Redirect 302 sicuro verso la risorsa firmata
    return res.redirect(302, signedUrl)

  } catch (error: any) {
    console.error('[API Job Download Error]', error)
    return res.status(500).json({ message: 'Errore durante la generazione del link di download' })
  }
}