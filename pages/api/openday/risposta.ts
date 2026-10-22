import type { NextApiRequest, NextApiResponse } from 'next'
import jwt from 'jsonwebtoken'
import { trackEvent, upsertContact } from '@modules/brevo'
import { EVENTS, pickEventProperties } from '@modules/brevo-events'
import { normalizeEmail } from '@modules/crm-form'
import { getJwtSecret } from '@modules/jwt-secret'

/**
 * One-click choices in the open day emails: the questions of "Cosa vedrai"
 * (tipo "domanda", saved in OD_DOMANDA) and the requests of the day after
 * (tipo "richiesta", saved in OD_RICHIESTA).
 *
 * GET is the link in the email: it only remembers the choice in a signed cookie
 * and opens /conferma, so a link opened by a preview or an antivirus writes
 * nothing. The /conferma page then calls POST, which saves the choice on the
 * contact and sends the submit_answer_form event.
 *
 * Email link: /api/openday/risposta?email={{ contact.EMAIL }}&tipo=domanda&d=costi
 */

const COOKIE_NAME = 'miia_openday_risposta'
const COOKIE_MAX_AGE = 30 * 60
const ATTRIBUTE: Record<string, string> = { domanda: 'OD_DOMANDA', richiesta: 'OD_RICHIESTA' }
// Value of the choice: the entry name in the Storyblok "Domande open day" datasource
const VALUE = /^[a-z][a-z0-9_-]{0,39}$/

interface Answer {
  email: string
  tipo: string
  valore: string
}

export function parseAnswer(raw: Record<string, unknown>): Answer | null {
  const email = normalizeEmail(raw.email)
  const tipo = typeof raw.tipo === 'string' ? raw.tipo.trim() : ''
  const valore = typeof raw.d === 'string' ? raw.d.trim().toLowerCase() : ''
  if (!email || !ATTRIBUTE[tipo] || !VALUE.test(valore)) return null
  return { email, tipo, valore }
}

function cookie(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function handleLink(req: NextApiRequest, res: NextApiResponse) {
  const answer = parseAnswer(req.query as Record<string, unknown>)
  if (!answer) return res.redirect(302, '/')
  const token = jwt.sign({ purpose: 'risposta', ...answer }, getJwtSecret(), { expiresIn: COOKIE_MAX_AGE })
  res.setHeader('Set-Cookie', cookie(token, COOKIE_MAX_AGE))
  const target = new URLSearchParams({ type: answer.tipo, d: answer.valore })
  return res.redirect(302, `/conferma?${target.toString()}`)
}

function readAnswer(req: NextApiRequest): Answer | null {
  const token = req.cookies[COOKIE_NAME]
  if (!token) return null
  try {
    const d = jwt.verify(token, getJwtSecret()) as Record<string, unknown>
    return d.purpose === 'risposta' ? parseAnswer({ email: d.email, tipo: d.tipo, d: d.valore }) : null
  } catch {
    return null
  }
}

async function handleSave(req: NextApiRequest, res: NextApiResponse) {
  const answer = readAnswer(req)
  if (!answer) return res.status(400).json({ ok: false, message: 'Richiesta scaduta o non valida.' })

  try {
    await upsertContact({ email: answer.email, attributes: { [ATTRIBUTE[answer.tipo]]: answer.valore } })
    await trackEvent({
      eventName: EVENTS.answer,
      email: answer.email,
      properties: pickEventProperties(EVENTS.answer, { tipo: answer.tipo, valore: answer.valore }),
    })
  } catch (error) {
    console.error('[Open day] Answer not saved in Brevo:', error)
    return res.status(502).json({ ok: false, message: 'Non siamo riusciti a salvare la scelta.' })
  }

  // The choice is saved: the cookie is no longer needed
  res.setHeader('Set-Cookie', cookie('', 0))
  return res.status(200).json({ ok: true })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return handleLink(req, res)
  if (req.method === 'POST') return handleSave(req, res)
  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ message: 'Metodo non consentito' })
}
