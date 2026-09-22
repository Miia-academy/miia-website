import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // Supporto esteso alle chiavi env usate nel progetto
  const token =
    process.env.STORYBLOK_TOKEN ||
    process.env.NEXT_PUBLIC_STORYBLOK_TOKEN ||
    process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW ||
    process.env.STORYBLOK_MANAGEMENT

  if (!token) {
    return res.status(500).json({ message: 'Token Storyblok non trovato nelle variabili d environment' })
  }

  try {
    const response = await fetch(
      `https://api.storyblok.com/v2/cdn/datasource_entries?datasource=competenze&token=${token}`
    )

    if (!response.ok) {
      throw new Error(`Storyblok API Error: ${response.statusText}`)
    }

    const data = await response.json()

    const skills = (data.datasource_entries || []).map((entry: any) => ({
      name: entry.name,
      value: entry.value || entry.name,
    }))

    return res.status(200).json(skills)
  } catch (error) {
    console.error('[API Skills Storyblok Error]', error)
    return res.status(500).json({ message: 'Impossibile recuperare le competenze' })
  }
}