import { enrollmentApi } from '@modules/enrollment/api'
import { getConditions } from '@modules/enrollment/conditions'

/** Passo 5: testi delle condizioni da mostrare, con versione e impronta. Sono testi pubblici. */
export default enrollmentApi(['GET'], async (_req, res) => {
  const conditions = await getConditions()
  if (!conditions) {
    return res.status(503).json({ message: 'Le condizioni non sono disponibili in questo momento, riprova più tardi.' })
  }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  return res.status(200).json(conditions)
})
