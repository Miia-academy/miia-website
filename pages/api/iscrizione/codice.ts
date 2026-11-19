import { normalizeEmail, isBotSubmission } from '@modules/crm-form'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { CODE_RESEND_SECONDS, CODE_TTL_MINUTES, generateCode, hashCode, sendWaitSeconds } from '@modules/enrollment/codes'
import { sendCodeEmail } from '@modules/enrollment/contact'
import { insertCode, recentCodeSends } from '@modules/enrollment/db'
import { clientIp, normalizeCourseSlug } from '@modules/enrollment/state'

/**
 * Passo 1: invia il codice di verifica all'email.
 * La risposta è la stessa per indirizzi noti e nuovi.
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const data = body(req)
  const email = normalizeEmail(data.email)
  if (!email) return res.status(400).json({ message: "L'indirizzo email non è valido", campo: 'email' })
  if (!normalizeCourseSlug(data.corso)) return res.status(400).json({ message: 'Corso non valido' })

  // Bot: risposta normale, nessuna email.
  if (isBotSubmission(data, {})) return res.status(200).json({ ok: true, attesa: CODE_RESEND_SECONDS })

  const ip = clientIp(req)
  const wait = sendWaitSeconds(await recentCodeSends(email, ip, 'email'))
  if (wait > 0) {
    return res.status(429).json({
      message:
        wait > CODE_RESEND_SECONDS
          ? 'Hai chiesto troppi codici. Riprova tra un’ora o scrivi a iscrizione@miia.it.'
          : `Puoi chiedere un nuovo codice tra ${wait} secondi.`,
      attesa: wait,
    })
  }

  const code = generateCode()
  await insertCode(email, 'email', hashCode(email, 'email', code), CODE_TTL_MINUTES, ip)
  await sendCodeEmail(email, code, CODE_TTL_MINUTES)

  return res.status(200).json({ ok: true, attesa: CODE_RESEND_SECONDS })
})
