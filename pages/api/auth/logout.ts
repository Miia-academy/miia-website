import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // Utilizziamo l'esatta logica di verifica del protocollo usata al login
  const protocol = req.headers['x-forwarded-proto'] || 'http'
  const isSecure = process.env.NODE_ENV === 'production' || protocol === 'https'

  const cookieOptions = `Path=/; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isSecure ? '; Secure' : ''}`

  res.setHeader('Set-Cookie', [
    `miia_auth_token=; HttpOnly; ${cookieOptions}`,
    `miia_user=; ${cookieOptions}`,
  ])

  return res.status(200).json({ message: 'Logout effettuato con successo' })
}