import { enrollmentApi } from '@modules/enrollment/api'
import { countSignedByEdition } from '@modules/enrollment/db'

const KEY = /^[0-9a-f-]{36}:\d{4}-\d{2}-\d{2}$/

/**
 * Iscrizioni firmate per edizione, per mostrare i posti rimasti nei blocchi
 * corso del sito (posti dell'edizione meno iscritti). Solo numeri, nessun dato personale.
 */
export default enrollmentApi(['GET'], async (req, res) => {
  const raw = typeof req.query.chiavi === 'string' ? req.query.chiavi : ''
  const keys = Array.from(new Set(raw.split(',').map((k) => k.trim()).filter((k) => KEY.test(k)))).slice(0, 50)
  const iscritti = await countSignedByEdition(keys)
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return res.status(200).json({ iscritti: Object.fromEntries(keys.map((k) => [k, iscritti[k] || 0])) })
})
