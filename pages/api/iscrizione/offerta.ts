import { enrollmentApi } from '@modules/enrollment/api'
import { loadOffer } from '@modules/enrollment/load-offer'
import { readSession } from '@modules/enrollment/session'
import { normalizeCourseSlug } from '@modules/enrollment/state'

/**
 * Passo 2: edizioni del corso con i posti rimasti e gli importi per chi ha
 * verificato l'email (l'offerta open day dipende dal contatto).
 */
export default enrollmentApi(['GET'], async (req, res) => {
  const session = readSession(req)
  const corso = normalizeCourseSlug(req.query.corso)
  if (!session || !corso || session.corso !== corso) {
    return res.status(401).json({ message: 'Verifica di nuovo la tua email per continuare.' })
  }
  const offer = await loadOffer(corso, session.email)
  return res.status(200).json({ ok: true, ...offer })
})
