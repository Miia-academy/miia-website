import type { NextApiRequest, NextApiResponse } from 'next'
import { BrevoError, getContact, upsertContact, trackEvent } from '@modules/brevo'
import {
  isBotSubmission,
  isSourceTrackingEnabled,
  attributionEventProperties,
  normalizeEmail,
  sanitizeAttribution,
  sanitizeAttributes,
  sanitizeEventName,
  sanitizeEventProperties,
  sanitizeLists,
} from '@modules/crm-form'
import { pickEventProperties, sourceEventProperties } from '@modules/brevo-events'
import { loadOpendayDetails } from '@modules/openday-details'

/**
 * Invio dei moduli pubblici del sito verso Brevo.
 *
 * Accetta solo POST. Non restituisce mai i dati del contatto al browser e non
 * permette di aggiornare un contatto per ID: il contatto è identificato solo
 * dall'email inserita nel modulo, e vengono scritti solo attributi e liste ammessi.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {}
  const { contact, event, fields, source } = body as {
    contact?: { email?: unknown; attributes?: unknown; listIds?: unknown }
    event?: { event_name?: unknown; event_properties?: unknown }
    fields?: unknown
    source?: unknown
  }

  const email = normalizeEmail(contact?.email)
  if (!email) {
    return res.status(400).json({ message: "L'indirizzo email non è valido" })
  }

  // Bot: rispondiamo come se fosse andato tutto bene, senza scrivere nulla.
  if (isBotSubmission(fields, contact?.attributes)) {
    return res.status(200).json({ success: true })
  }

  try {
    // Lettura lato server, solo per unire i valori a scelta multipla già presenti.
    let existing: Record<string, unknown> = {}
    let returning = false
    try {
      const current = await getContact({ identifier: email })
      existing = (current?.attributes as Record<string, unknown>) || {}
      returning = true
    } catch (error) {
      if (!(error instanceof BrevoError && error.status === 404)) throw error
    }

    const attributes: Record<string, unknown> = sanitizeAttributes(contact?.attributes, existing)
    if (isSourceTrackingEnabled()) {
      Object.assign(attributes, sanitizeAttribution(source, existing))
    }
    const listIds = sanitizeLists(contact?.listIds)
    // Nuova iscrizione a un open day: la presenza e il ritardo della volta prima non
    // valgono più (li segna di nuovo la pagina miia.it/open-day/accedi).
    if (attributes.OPENDAY) {
      attributes.PARTECIPAZIONE_OPENDAY = false
      attributes.OD_RITARDO = false
      // Date, start, teachers and prices of that open day, for the emails
      if (attributes.OD_CODICE) Object.assign(attributes, await loadOpendayDetails(attributes.OD_CODICE))
    }

    try {
      await upsertContact({ email, attributes, listIds })
    } catch (error) {
      // Se Brevo rifiuta un valore (per esempio un'opzione non prevista in un
      // attributo a scelta multipla), salviamo comunque il contatto con i dati
      // essenziali, così la richiesta non va persa. L'errore resta nei log.
      if (!(error instanceof BrevoError && error.status === 400)) throw error
      console.error('[CRM] Attributi rifiutati da Brevo, salvo i dati essenziali:', error.message)
      const essentials: Record<string, unknown> = {}
      for (const key of ['NOME', 'COGNOME', 'SMS']) {
        if (attributes[key] !== undefined) essentials[key] = attributes[key]
      }
      await upsertContact({ email, attributes: essentials, listIds })
    }

    const eventName = sanitizeEventName(event?.event_name)
    if (eventName) {
      await trackEvent({
        eventName,
        email,
        // Light event: only the fixed list of properties (see @modules/brevo-events)
        properties: pickEventProperties(eventName, {
          ...sanitizeEventProperties(event?.event_properties),
          ...(isSourceTrackingEnabled() ? sourceEventProperties(attributionEventProperties(source)) : {}),
        }),
      })
    }

    return res.status(200).json({ success: true, returning })
  } catch (error) {
    console.error('[CRM] Invio modulo non riuscito:', error)
    return res.status(502).json({ message: 'Si è verificato un errore, riprova più tardi' })
  }
}
