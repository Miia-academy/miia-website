import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeEmail } from '@modules/crm-form'
import { fase, loadOpenday, normalizeCodice } from '@modules/openday-accesso'
import { accessoPer, attributiContatto, loadModuloAccesso } from '@modules/openday-domande'

/**
 * POST { codice, email }: le domande da fare prima di entrare, per chi scrive l'email a mano
 * (con l'email nel link la pagina le calcola già sul server).
 *
 * Restituisce solo testi e domande, mai i valori del contatto. Per un'email che non è in Brevo
 * risponde come per un contatto senza risposte, così la risposta non dice chi è iscritto.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Metodo non consentito' })
  }
  res.setHeader('Cache-Control', 'no-store')

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const codice = normalizeCodice((body as { codice?: unknown }).codice)
  const email = normalizeEmail((body as { email?: unknown }).email)
  if (!codice) return res.status(400).json({ message: 'Open day non trovato.' })
  if (!email) return res.status(400).json({ message: "Scrivi l'email con cui ti sei iscritto." })

  try {
    const evento = (await loadOpenday()).find((e) => e.codice === codice)
    if (!evento || fase(evento.inizio) === 'finito') return res.status(200).json({ titolo: '', testo: '', domande: [] })
    const modulo = await loadModuloAccesso(evento.modulo)
    return res.status(200).json(accessoPer(modulo, await attributiContatto(email)))
  } catch (error) {
    // Senza domande la persona entra lo stesso
    console.error('[Open day] Domande di accesso non disponibili:', error)
    return res.status(200).json({ titolo: '', testo: '', domande: [] })
  }
}
