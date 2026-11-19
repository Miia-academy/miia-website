import type { NextApiRequest, NextApiResponse } from 'next'
import { TRACKING } from '@config/tracking'
import { COOKIE_PROFILO, pulisciRiassunto, scriviCookie } from '@modules/profilo'

/**
 * Riceve dal browser il riassunto del profilo e lo restituisce come cookie
 * `miia_profilo`, scritto dal server perché duri i giorni previsti anche su Safari.
 *
 * Non salva nulla e non parla con Brevo: controlla i valori e scrive il cookie.
 * Il browser lo chiama solo con il consenso marketing.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // sendBeacon può arrivare come testo: lo leggiamo in entrambi i casi.
  let body: unknown = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = null
    }
  }

  const riassunto = pulisciRiassunto(body)
  if (!riassunto) return res.status(400).json({ message: 'Profilo non valido' })

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_PROFILO}=${scriviCookie(riassunto)}; Path=/; Max-Age=${TRACKING.durataGiorni * 86400}; SameSite=Lax${secure}`
  )
  res.setHeader('Cache-Control', 'no-store')
  return res.status(204).end()
}
