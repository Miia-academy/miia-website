import type { NextApiRequest, NextApiResponse } from 'next'
import { isEnrollmentEnabled } from './config'

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown>

/**
 * Regole comuni alle API dell'iscrizione: spente finché ENROLLMENT_ONLINE non
 * è "on", solo i metodi previsti, nessun dettaglio tecnico al browser in caso di errore.
 */
export function enrollmentApi(methods: string[], handler: Handler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!isEnrollmentEnabled()) return res.status(404).json({ message: 'Pagina non trovata' })
    if (!req.method || !methods.includes(req.method)) {
      res.setHeader('Allow', methods)
      return res.status(405).json({ message: 'Metodo non consentito' })
    }
    try {
      await handler(req, res)
    } catch (error) {
      console.error(`[Iscrizione] ${req.method} ${req.url}:`, error)
      if (!res.headersSent) {
        res.status(500).json({ message: 'Si è verificato un errore, riprova tra qualche minuto' })
      }
    }
  }
}

export function body(req: NextApiRequest): Record<string, unknown> {
  return req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
}
