import type { NextApiRequest, NextApiResponse } from 'next'
import { BrevoError, getContact, trackEvent, upsertContact } from '@modules/brevo'
import { EVENTS, pickEventProperties, siNo } from '@modules/brevo-events'
import { normalizeEmail } from '@modules/crm-form'
import {
  fase,
  inRitardo,
  loadOpenday,
  normalizeCodice,
  romeDay,
  scadenzaOfferta,
  scadenzaTesto,
} from '@modules/openday-accesso'

// Area dell'evento (interni, moda) → valore negli eventi, come nella brochure: corso-{area}-design-{programma}-livello
const AREA_EVENTO: Record<string, string> = { interni: 'interior', moda: 'fashion' }

/**
 * POST { codice, email }: la persona ha premuto "Entra nell'open day".
 *
 * Nell'orario di apertura restituisce il link della call e, se l'email è già un
 * contatto Brevo, segna la presenza. Non crea contatti nuovi. Serve il clic (POST):
 * un link aperto da un'anteprima o da un antivirus non segna nessuno come presente.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const codice = normalizeCodice((body as { codice?: unknown }).codice)
  const email = normalizeEmail((body as { email?: unknown }).email)
  if (!codice) return res.status(400).json({ message: 'Open day non trovato.' })
  if (!email) return res.status(400).json({ message: "Scrivi l'email con cui ti sei iscritto." })

  let evento
  try {
    evento = (await loadOpenday()).find((e) => e.codice === codice)
  } catch (error) {
    console.error('[Open day] Lettura degli eventi da Storyblok non riuscita:', error)
    return res.status(502).json({ message: 'Si è verificato un errore, riprova tra un momento.' })
  }
  if (!evento) return res.status(404).json({ message: 'Open day non trovato.' })

  const now = new Date()
  const stato = fase(evento.inizio, now)
  if (stato !== 'aperto') return res.status(409).json({ fase: stato })
  if (!evento.link) {
    console.error(`[Open day] Manca il link della call nell'evento ${codice}`)
    return res.status(503).json({
      message: 'Il link non è ancora pronto: riprova tra un minuto o scrivici.',
    })
  }

  try {
    const contact = await getContact({ identifier: email })
    const existing = ((contact as { attributes?: Record<string, unknown> })?.attributes || {}) as Record<
      string,
      unknown
    >
    const ritardo = inRitardo(evento.inizio, now)
    const area = AREA_EVENTO[evento.area.toLowerCase()]
    const programma = /^(primo|secondo)$/.test(evento.livello) ? evento.livello : undefined
    const attributes: Record<string, unknown> = {
      OPENDAY_PRESENTE: true,
      OPENDAY_RITARDO: ritardo,
      OPENDAY_PRESENZA_DATA: romeDay(now),
      OFFERTA_SCADENZA_TESTO: scadenzaTesto(evento.inizio),
    }
    // Il prezzo riservato (letto dall'iscrizione online) a chi entra, anche in ritardo: il prezzo
    // si presenta alla fine dell'open day (decisione del 30/10). Solo se l'open day lo prevede
    // (OPENDAY_VALIDO; OD_VALIDO per chi si è iscritto prima del 26/10).
    if ((existing.OPENDAY_VALIDO ?? existing.OD_VALIDO) === true) {
      attributes.OFFERTA_SCADENZA_DATA = scadenzaOfferta(evento.inizio)
    }
    await upsertContact({ email, attributes })
    // Event for the automations: who entered which open day, and whether late
    await trackEvent({
      eventName: EVENTS.presence,
      email,
      properties: pickEventProperties(EVENTS.presence, {
        openday: romeDay(evento.inizio),
        openday_codice: codice,
        // "si"/"no": Brevo mostra i booleani degli eventi come "0"/"1", e "0" nelle condizioni vale vero
        ritardo: siNo(ritardo),
        // Il corso dell'open day, per il pulsante "Iscriviti online" nelle email del dopo open day
        area,
        programma,
        corso: area && programma ? `corso-${area}-design-${programma}-livello` : undefined,
      }),
    })
  } catch (error) {
    // Email sconosciuta o Brevo non raggiungibile: la persona entra lo stesso.
    if (!(error instanceof BrevoError && error.status === 404)) {
      console.error('[Open day] Presenza non segnata in Brevo:', error)
    }
  }

  return res.status(200).json({ ok: true, link: evento.link })
}
