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
    // Se è privato, l'URL pubblica non funzionerà (dovremo usare una Signed URL in futuro),
    // ma la generiamo comunque per i file di miia-assets
    publicUrl: `https://storage.googleapis.com/${targetBucket.name}/${fullPath}`,
  }
}