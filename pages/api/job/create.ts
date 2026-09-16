import type { NextApiRequest, NextApiResponse } from 'next'
import { createJob } from '@modules/jobs/db'
import { withApiAuth } from '@modules/api-wrapper'
import type { AuthPayload } from '@modules/auth'

async function createJobHandler(req: NextApiRequest, res: NextApiResponse, authData: AuthPayload) {
  const {
    title,
    description,
    provincie,
    tipo_contratto,
    ral,
    orari_lavoro,
    trasferte,
    grado_esperienza,
    competenze,
    lingue,
  } = req.body

  if (!title || !description) {
    return res.status(400).json({ message: 'I campi titolo e descrizione sono obbligatori' })
  }

  // Normalizzazione array provincie (Triveneto)
  const provincieArray = Array.isArray(provincie)
    ? provincie.map((p: string) => String(p).trim().toUpperCase()).filter((p) => p.length === 2)
    : []

  if (provincieArray.length === 0) {
    return res.status(400).json({ message: 'Seleziona almeno una provincia del Triveneto' })
  }

  const competenzeArray = Array.isArray(competenze)
    ? competenze.map((c: string) => String(c).trim()).filter(Boolean)
    : []

  const lingueArray = Array.isArray(lingue)
    ? lingue.map((l: string) => String(l).trim()).filter(Boolean)
    : []

  const newJob = await createJob({
    company_email: authData.email, // Estratto in modo sicuro dalla sessione
    title: String(title).trim(),
    description: String(description).trim(),
    provincie: provincieArray,
    tipo_contratto: tipo_contratto || 'indeterminato',
    ral: ral ? String(ral).trim() : '',
    orari_lavoro: orari_lavoro || 'full_time',
    trasferte: trasferte || 'no',
    grado_esperienza: grado_esperienza || 'prima_esperienza',
    competenze: competenzeArray,
    lingue: lingueArray,
    status: 'attiva',
  })

  return res.status(201).json({
    message: 'Annuncio pubblicato con successo!',
    job: newJob,
  })
}

export default withApiAuth({ allowedMethods: ['POST'], allowedRoles: ['Azienda'] }, createJobHandler)