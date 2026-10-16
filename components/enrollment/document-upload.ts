/**
 * Caricamento di una foto del documento: riduzione nel browser, link firmato
 * dal server, caricamento diretto nel bucket privato, conferma al server.
 */

const MAX_SIDE = 2000

/** Riduce le foto JPEG/PNG a 2000 px sul lato lungo; PDF e HEIC passano così come sono. */
export async function shrinkImage(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png)$/.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Il browser a volte non dà il tipo delle foto HEIC: lo ricaviamo dal nome. */
function fileType(blob: Blob, name: string): string {
  if (blob.type) return blob.type
  if (/\.hei[cf]$/i.test(name)) return 'image/heic'
  if (/\.pdf$/i.test(name)) return 'application/pdf'
  return ''
}

export async function uploadDocument(corso: string, foto: string, file: File): Promise<{ ok: true } | { ok: false; message: string }> {
  const blob = await shrinkImage(file)
  const tipo_file = fileType(blob, file.name)

  const linkRes = await fetch('/api/iscrizione/documenti/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corso, foto, tipo_file, dimensione: blob.size }),
  })
  const link = await linkRes.json().catch(() => ({}))
  if (!linkRes.ok) return { ok: false, message: link.message || 'Caricamento non riuscito, riprova.' }

  const put = await fetch(link.url, { method: 'PUT', headers: link.headers, body: blob }).catch(() => null)
  if (!put || !put.ok) return { ok: false, message: 'Caricamento non riuscito, controlla la connessione e riprova.' }

  const confirm = await fetch('/api/iscrizione/documenti/conferma', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ corso, foto, percorso: link.percorso }),
  })
  const done = await confirm.json().catch(() => ({}))
  return confirm.ok ? { ok: true } : { ok: false, message: done.message || 'Caricamento non riuscito, riprova.' }
}
