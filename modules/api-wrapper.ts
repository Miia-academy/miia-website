import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { BrevoError } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

type ApiHandlerWithAuth = (
  req: NextApiRequest,
  res: NextApiResponse,
  authData: AuthPayload & { iat?: number; exp?: number }
) => Promise<void | NextApiResponse>

interface WrapperOptions {
  allowedMethods: string[]
  allowedRoles?: Array<'Studente' | 'Azienda' | 'Admin'>
}

export function withApiAuth(options: WrapperOptions, handler: ApiHandlerWithAuth) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // 1. Controllo Metodo HTTP
    if (!req.method || !options.allowedMethods.includes(req.method)) {
      return res.status(405).json({ message: `Metodo ${req.method} non consentito` })
    }

    // 2. Controllo Sessione JWT
    const token = req.cookies.miia_auth_token
    if (!token) {
      return res.status(401).json({ message: 'Non autorizzato: effettua prima il login' })
    }

    let authData: AuthPayload & { iat?: number; exp?: number }
    try {
      authData = jwt.verify(token, JWT_SECRET) as any
    } catch {
      return res.status(401).json({ message: 'Sessione scaduta o non valida' })
    }

    // 3. Guardia di Ruolo (Case-insensitive per tolleranza vecchi cookie)
    if (options.allowedRoles && options.allowedRoles.length > 0) {
      const userRole = String(authData.tipo_utente || '').toLowerCase().trim()
      const isAuthorized = options.allowedRoles.some(
        (allowedRole) => allowedRole.toLowerCase() === userRole
      )

      if (!isAuthorized) {
        return res.status(403).json({
          message: 'Accesso negato: rotta non autorizzata per questo ruolo',
        })
      }
    }

    // 4. Esecuzione Handler con Error Boundary unificato
    try {
      await handler(req, res, authData)
    } catch (error: any) {
      console.error(`[API Error] ${req.url}:`, error)

      if (error instanceof BrevoError) {
        return res.status(error.status).json({ message: error.message })
      }

      return res.status(500).json({
        message: error?.message || 'Errore interno del server',
      })
    }
  }
}