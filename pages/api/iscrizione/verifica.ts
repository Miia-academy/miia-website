import { attributionEventProperties, normalizeEmail } from '@modules/crm-form'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { CODE_MAX_ATTEMPTS, codeMatches, normalizeCode } from '@modules/enrollment/codes'
import { contactPrefill } from '@modules/enrollment/contact'
import { isNewDraft, syncEnrollmentStart } from '@modules/enrollment/brevo-sync'
import { courseTitle } from '@modules/enrollment/courses'
import { EVENTS } from '@modules/brevo-events'
import { latestActiveCode, logEvent, markCodeUsed, openDraft, takeCodeAttempt } from '@modules/enrollment/db'
import { sessionCookie, signSession } from '@modules/enrollment/session'
import { clientIp, normalizeCourseSlug, publicState, userAgent } from '@modules/enrollment/state'

const EXPIRED = 'Il codice è scaduto o non è più valido. Chiedine uno nuovo.'

/**
 * Passo 1: verifica il codice. Se è giusto apre (o riprende) la bozza,
 * imposta il cookie dell'iscrizione e solo ora legge i dati già noti in Brevo.
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const data = body(req)
  const email = normalizeEmail(data.email)
  const corso = normalizeCourseSlug(data.corso)
  const code = normalizeCode(data.codice)
  if (!email || !corso) return res.status(400).json({ message: 'Richiesta non valida' })
  if (!code) return res.status(400).json({ message: 'Il codice è di 6 cifre', campo: 'codice' })

  const active = await latestActiveCode(email, 'email')
  if (!active) return res.status(400).json({ message: EXPIRED, campo: 'codice' })
  if (!(await takeCodeAttempt(active.id, CODE_MAX_ATTEMPTS))) {
    return res.status(400).json({ message: 'Troppi tentativi. Chiedi un nuovo codice.', campo: 'codice' })
  }
  if (!codeMatches(active.codice_hash, email, 'email', code)) {
    const left = CODE_MAX_ATTEMPTS - active.tentativi - 1
    return res.status(400).json({
      message: left > 0 ? `Il codice non è corretto. Tentativi rimasti: ${left}.` : 'Troppi tentativi. Chiedi un nuovo codice.',
      campo: 'codice',
    })
  }
  if (!(await markCodeUsed(active.id))) return res.status(400).json({ message: EXPIRED, campo: 'codice' })

  const draft = await openDraft(email, corso, attributionEventProperties(data.provenienza))
  await logEvent(draft.id, 'email_verificata', clientIp(req), userAgent(req), { corso })
  res.setHeader('Set-Cookie', sessionCookie(signSession({ id: draft.id, email, corso }), req))

  // First verification for this course: the online enrollment has started
  const started = isNewDraft(draft)
  if (started) {
    try {
      await syncEnrollmentStart(draft, courseTitle(corso), new Date())
    } catch (error) {
      // The enrollment goes on: Brevo only misses the start date and the event.
      console.error('[Iscrizione] Brevo enrollment start not saved:', error)
    }
  }

  const state = publicState(draft)
  // Prima volta: proponiamo i dati che Brevo conosce già. Poi valgono quelli salvati nella bozza.
  let trovato = false
  if (!state.sezioni_complete.includes('chi_sei')) {
    try {
      const prefill = await contactPrefill(email)
      trovato = prefill.trovato
      state.chi_sei = {
        nome: state.chi_sei.nome || prefill.nome,
        cognome: state.chi_sei.cognome || prefill.cognome,
        telefono: state.chi_sei.telefono || prefill.telefono,
      }
    } catch (error) {
      // Senza Brevo si prosegue con i campi vuoti.
      console.error('[Iscrizione] Lettura contatto Brevo non riuscita:', error)
    }
  }

  // The page sends the GTM event only for a new enrollment, like Brevo
  return res.status(200).json({
    ok: true,
    trovato,
    iscrizione: state,
    ...(started ? { evento: { event: EVENTS.enrollment, course: corso } } : {}),
  })
})
