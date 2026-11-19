import { enrollmentApi } from '@modules/enrollment/api'
import { CODE_RESEND_SECONDS, CODE_TTL_MINUTES, generateCode, hashCode, sendWaitSeconds } from '@modules/enrollment/codes'
import { sendSignatureSms } from '@modules/enrollment/contact'
import { insertCode, logEvent, recentCodeSends } from '@modules/enrollment/db'
import { requireDraft } from '@modules/enrollment/draft'
import { checkReadyToSign, maskPhone } from '@modules/enrollment/sign'
import { clientIp, userAgent } from '@modules/enrollment/state'

/**
 * Passo 6: invia via SMS il codice per firmare, al cellulare del passo 1.
 * Prima controlla che si possa firmare davvero (condizioni, posti).
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const draft = await requireDraft(req, res)
  if (!draft) return
  const { row, session, corso } = draft

  const check = await checkReadyToSign(row, corso)
  if (!check.ok) return res.status(check.status).json({ message: check.message, passo: check.passo })
  if (!row.telefono) return res.status(409).json({ message: 'Manca il cellulare: aggiungilo nel primo passo.', passo: 'chi_sei' })

  const ip = clientIp(req)
  const wait = sendWaitSeconds(await recentCodeSends(session.email, ip, 'firma'))
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
  await insertCode(session.email, 'firma', hashCode(session.email, 'firma', code), CODE_TTL_MINUTES, ip)
  await sendSignatureSms(row.telefono, code, CODE_TTL_MINUTES)
  await logEvent(row.id, 'codice_firma_inviato', ip, userAgent(req), { telefono: maskPhone(row.telefono) })

  return res.status(200).json({ ok: true, attesa: CODE_RESEND_SECONDS, telefono: maskPhone(row.telefono) })
})
