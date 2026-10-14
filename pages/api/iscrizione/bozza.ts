import type { NextApiResponse } from 'next'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { syncContact } from '@modules/enrollment/contact'
import { getEnrollment, logEvent, saveChiSei, saveCorso, saveDati, saveProfilo } from '@modules/enrollment/db'
import { documentsComplete } from '@modules/enrollment/documents'
import { loadOffer } from '@modules/enrollment/load-offer'
import { openEditions } from '@modules/enrollment/offer'
import { readSession } from '@modules/enrollment/session'
import { clientIp, normalizeCourseSlug, publicState, userAgent } from '@modules/enrollment/state'
import type { SectionId } from '@modules/enrollment/types'
import { canSaveSection, completeAfterSave, validateChiSei, validateCorso, validateDati, validateProfilo } from '@modules/enrollment/validation'

const notVerified = (res: NextApiResponse) =>
  res.status(401).json({ message: 'Verifica di nuovo la tua email per continuare.' })

/**
 * GET: riprende la bozza di chi ha già verificato l'email (cookie).
 * PUT: salva una sezione; per ora "chi_sei", "corso", "dati" e "profilo", le altre arrivano dopo.
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

  if (section !== 'chi_sei' && section !== 'corso' && section !== 'dati' && section !== 'profilo') {
    return res.status(400).json({ message: 'Sezione non ancora disponibile' })
  }
  if (!canSaveSection(section, row.sezioni_complete)) {
    return res.status(409).json({ message: 'Completa prima i passi precedenti' })
  }
  const complete = completeAfterSave(section, row.sezioni_complete)
  const ip = clientIp(req)
  const ua = userAgent(req)

  if (section === 'corso') {
    // Edizioni, posti e importi si ricalcolano qui: non si usa niente di ciò che manda il browser.
    const offer = await loadOffer(corso, session.email)
    const result = validateCorso(values, openEditions(offer))
    if (!result.ok) {
      return res.status(400).json({ message: 'Completa le scelte del passo', errori: result.errors })
    }
    if (!offer.prezzi) {
      return res.status(503).json({ message: 'I prezzi non sono disponibili in questo momento, riprova più tardi.' })
    }
    const saved = await saveCorso(row.id, session.email, result.value, offer.prezzi[result.value.modalita], complete)
    if (!saved) return notVerified(res)
    await logEvent(row.id, 'sezione_salvata', ip, ua, { sezione: section, edizione: result.value.edizione })
    return res.status(200).json({ ok: true, iscrizione: publicState(saved) })
  }

  if (section === 'dati') {
    // Le foto contano solo se risultano caricate sul server (vedi /documenti/conferma).
    const caricati = documentsComplete(row.documenti, String(values.documento_tipo || ''))
    const result = validateDati(values, { documentiCaricati: caricati })
    if (!result.ok) {
      return res.status(400).json({ message: 'Completa i campi con l’asterisco', errori: result.errors })
    }
    const saved = await saveDati(row.id, session.email, result.value, complete)
    if (!saved) return notVerified(res)
    await logEvent(row.id, 'sezione_salvata', ip, ua, { sezione: section, documenti: result.value.documenti })
    return res.status(200).json({ ok: true, iscrizione: publicState(saved) })
  }

  if (section === 'profilo') {
    // Tutto facoltativo. "Salta questo passo" cancella le risposte date prima.
    const skipped = values.saltato === true
    const result = validateProfilo(skipped ? { saltato: true } : { ...values, saltato: false })
    if (!result.ok) {
      return res.status(400).json({ message: 'Controlla i campi segnati', errori: result.errors })
    }
    const saved = await saveProfilo(row.id, session.email, result.value, complete)
    if (!saved) return notVerified(res)
    await logEvent(row.id, 'sezione_salvata', ip, ua, { sezione: section, saltato: skipped })
    return res.status(200).json({ ok: true, iscrizione: publicState(saved) })
  }

  // L'email è quella verificata: non si cambia da qui.
  const result = validateChiSei({ ...values, email: session.email })
  if (!result.ok) {
    return res.status(400).json({ message: 'Completa i campi con l’asterisco', errori: result.errors })
  }

  const saved = await saveChiSei(row.id, session.email, result.value, complete)
  if (!saved) return notVerified(res)
  await logEvent(row.id, 'sezione_salvata', ip, ua, { sezione: section })

  try {
    await syncContact(session.email, result.value)
  } catch (error) {
    // L'iscrizione è salvata nel database: Brevo si riallinea alla firma.
    console.error('[Iscrizione] Aggiornamento contatto Brevo non riuscito:', error)
  }

  return res.status(200).json({ ok: true, iscrizione: publicState(saved) })
})
