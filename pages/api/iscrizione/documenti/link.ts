import { getSignedUploadUrl } from '@modules/google'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { MAX_DOCUMENT_BYTES, documentExtension, documentPath, isDocumentSlot } from '@modules/enrollment/documents'
import { requireDraft } from '@modules/enrollment/draft'
import { canSaveSection } from '@modules/enrollment/validation'

/**
 * Passo 3: link firmato (10 minuti) per caricare una foto del documento
 * direttamente nel bucket privato, con tipo e dimensione massima fissati.
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const draft = await requireDraft(req, res)
  if (!draft) return
  const { row } = draft
  if (!canSaveSection('dati', row.sezioni_complete)) {
    return res.status(409).json({ message: 'Completa prima i passi precedenti' })
  }

  const data = body(req)
  const ext = documentExtension(data.tipo_file)
  if (!isDocumentSlot(data.foto)) return res.status(400).json({ message: 'Foto non valida' })
  if (!ext) return res.status(400).json({ message: 'Carica una foto (JPG, PNG, HEIC) o un PDF' })
  const size = Number(data.dimensione)
  if (!Number.isFinite(size) || size <= 0 || size > MAX_DOCUMENT_BYTES) {
    return res.status(400).json({ message: 'Il file è troppo grande (massimo 10 MB)' })
  }

  const percorso = documentPath(row.id, data.foto, ext)
  const url = await getSignedUploadUrl(percorso, String(data.tipo_file).toLowerCase(), MAX_DOCUMENT_BYTES)
  return res.status(200).json({
    ok: true,
    url,
    percorso,
    headers: { 'Content-Type': String(data.tipo_file).toLowerCase(), 'x-goog-content-length-range': `1,${MAX_DOCUMENT_BYTES}` },
  })
})
