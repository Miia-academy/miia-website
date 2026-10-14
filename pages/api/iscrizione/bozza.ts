import type { NextApiResponse } from 'next'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { syncContact } from '@modules/enrollment/contact'
import { getEnrollment, logEvent, saveChiSei } from '@modules/enrollment/db'
import { readSession } from '@modules/enrollment/session'
import { clientIp, normalizeCourseSlug, publicState, userAgent } from '@modules/enrollment/state'
import type { SectionId } from '@modules/enrollment/types'
import { canSaveSection, completeAfterSave, validateChiSei } from '@modules/enrollment/validation'

const notVerified = (res: NextApiResponse) =>
  res.status(401).json({ message: 'Verifica di nuovo la tua email per continuare.' })

/**
 * GET: riprende la bozza di chi ha già verificato l'email (cookie).
 * PUT: salva una sezione; per ora "chi_sei", le altre arrivano con la pagina completa.
 */
export default enrollmentApi(['GET', 'PUT'], async (req, res) => {
  const session = readSession(req)
  const corso = normalizeCourseSlug(req.method === 'GET' ? req.query.corso : body(req).corso)
  // Il cookie vale solo per il corso per cui l'email è stata verificata.
  if (!session || !corso || session.corso !== corso) return notVerified(res)

  const row = await getEnrollment(session.id, session.email)
  if (!row || row.stato !== 'bozza') return notVerified(res)

  if (req.method === 'GET') return res.status(200).json({ ok: true, iscrizione: publicState(row) })

  const data = body(req)
  const section = data.sezione as SectionId
  const values = data.valori && typeof data.valori === 'object' ? (data.valori as Record<string, unknown>) : {}

  if (section !== 'chi_sei') return res.status(400).json({ message: 'Sezione non ancora disponibile' })
  if (!canSaveSection(section, row.sezioni_complete)) {
    return res.status(409).json({ message: 'Completa prima i passi precedenti' })
  }

  // L'email è quella verificata: non si cambia da qui.
  const result = validateChiSei({ ...values, email: session.email })
  if (!result.ok) {
    return res.status(400).json({ message: 'Completa i campi con l’asterisco', errori: result.errors })
  }

  const saved = await saveChiSei(row.id, session.email, result.value, completeAfterSave(section, row.sezioni_complete))
  if (!saved) return notVerified(res)
  await logEvent(row.id, 'sezione_salvata', clientIp(req), userAgent(req), { sezione: section })

  try {
    await syncContact(session.email, result.value)
  } catch (error) {
    // L'iscrizione è salvata nel database: Brevo si riallinea alla firma.
    console.error('[Iscrizione] Aggiornamento contatto Brevo non riuscito:', error)
  }

  return res.status(200).json({ ok: true, iscrizione: publicState(saved) })
})
