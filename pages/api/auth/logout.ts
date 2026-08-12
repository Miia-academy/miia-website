// pages/api/auth/logout.ts
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const isProd = process.env.NODE_ENV === 'production'

  // Impostiamo Max-Age=0 ed una data nel passato per distruggere istantaneamente entrambi i cookie
  res.setHeader('Set-Cookie', [
    `miia_auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${isProd ? 'Secure;' : ''}`,
    `miia_user=; Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${isProd ? 'Secure;' : ''}`,
  ])

  return res.status(200).json({ message: 'Logout effettuato con successo' })
}