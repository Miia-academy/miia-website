// @modules/gcs.ts
import { Storage } from '@google-cloud/storage'

// --- TYPINGS ---
export interface UploadFileOptions {
  fileBuffer: Buffer
  fileName: string
  mimeType: string
  folderPath?: string
  isPublic?: boolean // true = va in miia-assets, false = va in miia-documents
}

// --- CLIENT INITIALIZATION ---
const getGcsClient = () => {
  const clientEmail = process.env.GCS_CLIENT_EMAIL
  const privateKey = process.env.GCS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const publicBucketName = process.env.GCS_BUCKET_PUBLIC
  const privateBucketName = process.env.GCS_BUCKET_PRIVATE

  if (!clientEmail || !privateKey || !publicBucketName || !privateBucketName) {
    throw new Error('[GCS] Credenziali o nomi dei Bucket mancanti nelle env')
  }

  const storage = new Storage({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  })

  return {
    storage,
    publicBucket: storage.bucket(publicBucketName),
    privateBucket: storage.bucket(privateBucketName)
  }
}

// --- FUNZIONI API ---

export async function uploadFile({
  fileBuffer,
  fileName,
  mimeType,
  folderPath = '',
  isPublic = false,
}: UploadFileOptions) {
  const { publicBucket, privateBucket } = getGcsClient()

  // Sceglie il bucket di destinazione in base alla privacy richiesta
  const targetBucket = isPublic ? publicBucket : privateBucket

  const fullPath = folderPath ? `${folderPath.replace(/\/$/, '')}/${fileName}` : fileName
  const file = targetBucket.file(fullPath)

  // A. Upload diretto e pulito (senza chiamate ACL aggiuntive)
  await file.save(fileBuffer, {
    contentType: mimeType,
    resumable: false // Ottimizzato per le Serverless Function di Vercel
  })

  return {
    id: fullPath,
    name: fileName,
    bucket: targetBucket.name,
    publicUrl: `https://storage.googleapis.com/${targetBucket.name}/${fullPath}`,
  }
}

export async function getSignedFileUrl(filePath: string, isPublic = false): Promise<string> {
  const { publicBucket, privateBucket } = getGcsClient()
  const targetBucket = isPublic ? publicBucket : privateBucket
  const file = targetBucket.file(filePath)

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 15 * 60 * 1000, // Scadenza 15 minuti
  })

  return url
}
/**
 * Link firmato per caricare un file direttamente dal browser nel bucket privato
 * (il file non passa dalla funzione Vercel, che ha un limite di 4,5 MB).
 * Tipo e dimensione massima sono fissati nella firma.
 */
export async function getSignedUploadUrl(filePath: string, contentType: string, maxBytes: number): Promise<string> {
  const { privateBucket } = getGcsClient()
  const [url] = await privateBucket.file(filePath).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + 10 * 60 * 1000, // Scadenza 10 minuti
    contentType,
    extensionHeaders: { 'x-goog-content-length-range': `1,${maxBytes}` },
  })
  return url
}

/** Tipo e dimensione di un file del bucket privato, o null se non esiste. */
export async function getPrivateFileInfo(filePath: string): Promise<{ contentType: string; size: number } | null> {
  const { privateBucket } = getGcsClient()
  const file = privateBucket.file(filePath)
  const [exists] = await file.exists()
  if (!exists) return null
  const [meta] = await file.getMetadata()
  return { contentType: String(meta.contentType || ''), size: Number(meta.size || 0) }
}
