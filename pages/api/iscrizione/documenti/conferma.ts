import { getPrivateFileInfo } from '@modules/google'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { saveDocument, logEvent } from '@modules/enrollment/db'
import { MAX_DOCUMENT_BYTES, documentExtension, isDocumentSlot, isOwnDocumentPath, uploadedFiles } from '@modules/enrollment/documents'
import { requireDraft } from '@modules/enrollment/draft'
import { clientIp, userAgent } from '@modules/enrollment/state'

/**
 * Passo 3: dopo il caricamento il browser conferma la foto. Il server controlla
 * che il file esista davvero nel bucket, sia di quell'iscrizione e di un tipo ammesso.
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const draft = await requireDraft(req, res)
  if (!draft) return
  const { row, session } = draft

  const data = body(req)
  if (!isDocumentSlot(data.foto) || !isOwnDocumentPath(data.percorso, row.id, data.foto)) {
    return res.status(400).json({ message: 'Foto non valida' })
  }
  const info = await getPrivateFileInfo(data.percorso)
  if (!info || !documentExtension(info.contentType) || info.size <= 0 || info.size > MAX_DOCUMENT_BYTES) {
    return res.status(400).json({ message: 'Il caricamento non è riuscito, riprova.' })
  }

  const saved = await saveDocument(row.id, session.email, data.foto, {
    percorso: data.percorso,
    tipo: info.contentType,
    dimensione: info.size,
    caricato_il: new Date().toISOString(),
  })
  if (!saved) return res.status(401).json({ message: 'Verifica di nuovo la tua email per continuare.' })
  await logEvent(row.id, 'documento_caricato', clientIp(req), userAgent(req), { foto: data.foto })

  const files = uploadedFiles(saved.documenti)
  return res.status(200).json({ ok: true, caricate: Object.keys(files) })
})
