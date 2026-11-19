import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import { getJwtSecret } from '@modules/jwt-secret'
import { changeStatus, isTargetStatus } from '@modules/enrollment/status'

/**
 * La segreteria segna recesso, annullamento o iscrizione definitiva dopo aver
 * letto la richiesta (email a iscrizione@, PEC o raccomandata).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Metodo non consentito' })

  const token = req.cookies['miia_auth_token']
  if (!token) return res.status(401).json({ message: 'Non autenticato' })
  let admin: AuthPayload
  try {
    admin = jwt.verify(token, getJwtSecret()) as AuthPayload
  } catch {
    return res.status(401).json({ message: 'Non autenticato' })
  }
  if (admin.tipo_utente !== 'Admin') return res.status(403).json({ message: 'Accesso negato' })

  const { id, stato, canale, data, nota } = (req.body || {}) as Record<string, unknown>
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ message: 'Iscrizione non valida' })
  if (!isTargetStatus(stato)) return res.status(400).json({ message: 'Stato non valido' })

  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const result = await changeStatus(id, stato, admin.email, { canale: text(canale), data: text(data), nota: text(nota) })
  if (!result.ok) return res.status(result.status).json({ message: result.message })
  return res.status(200).json({ stato: result.row.stato })
}
