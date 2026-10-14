import type { NextApiRequest, NextApiResponse } from 'next'
import { body } from './api'
import { getEnrollment } from './db'
import { readSession, type EnrollmentSession } from './session'
import { normalizeCourseSlug } from './state'
import type { Enrollment } from './types'

/**
 * La bozza di chi ha verificato l'email per quel corso, o null dopo aver
 * risposto 401 (cookie mancante, di un altro corso, o iscrizione già firmata).
 */
export async function requireDraft(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ session: EnrollmentSession; corso: string; row: Enrollment } | null> {
  const session = readSession(req)
  const corso = normalizeCourseSlug(req.method === 'GET' ? req.query.corso : body(req).corso)
  const row = session && corso && session.corso === corso ? await getEnrollment(session.id, session.email) : null
  if (!session || !corso || !row || row.stato !== 'bozza') {
    res.status(401).json({ message: 'Verifica di nuovo la tua email per continuare.' })
    return null
  }
  return { session, corso, row }
}
