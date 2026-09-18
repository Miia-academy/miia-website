import type { NextApiRequest, NextApiResponse } from 'next'
import { generateMagicLink, AuthPayload } from '@modules/auth'
import { getContact, upsertContact, trackEvent, BrevoError } from '@modules/brevo'

const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || 30
const BREVO_LIST_STUDENTI = Number(process.env.BREVO_STUDENT_LIST_ID) || 42

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' })
  }

  // Accetta sia 'redirect' che 'redirectUrl' per garantire massima compatibilità dal frontend
  const { email, tipo_utente = 'Studente', redirect, redirectUrl } = req.body
  const targetRedirect = redirect || redirectUrl || '/'

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ message: 'L\'indirizzo email è obbligatorio' })
  }

  const cleanEmail = email.trim().toLowerCase()
  const isAzienda = tipo_utente === 'Azienda'

  try {
    // 1. Recupero contatto da Brevo
    let contact: any
    try {
      contact = await getContact({ identifier: cleanEmail })
    } catch (e: any) {
      if (e instanceof BrevoError && e.status === 404) {
        const errorMsg = isAzienda
          ? 'Azienda non trovata. Effettua prima la registrazione.'
          : 'Email non autorizzata. Riservato agli studenti diplomati MIIA.'
        return res.status(403).json({ message: errorMsg })
      }
      throw e
    }

    const currentListIds: number[] = Array.isArray(contact?.listIds) ? contact.listIds : []

    // 2. Controllo d'accesso rigoroso in base al ruolo
    if (!isAzienda) {
      const isDiplomato = currentListIds.includes(BREVO_LIST_STUDENTI)
      if (!isDiplomato) {
        return res.status(403).json({
          message: 'Accesso negato: questa email non risulta presente tra gli studenti diplomati.',
        })
      }
    } else {
      if (!currentListIds.includes(BREVO_LIST_AZIENDE)) {
        await upsertContact({
          email: cleanEmail,
          listIds: [BREVO_LIST_AZIENDE],
        })
      }
    }

    // 3. Estrazione dei dati anagrafici canonici dal CRM
    const attributes = contact?.attributes || {}

    // Normalizzazione array Competenze da CSV Brevo con tipizzazione esplicita
    const competenzeArray = typeof attributes.COMPETENZE === 'string'
      ? attributes.COMPETENZE.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

    const payload: AuthPayload = {
      email: cleanEmail,
      tipo_utente: isAzienda ? 'Azienda' : 'Studente',

      // Dati Base / Studente
      nome: attributes.NOME || '',
      cognome: attributes.COGNOME || '',
      provincia: attributes.PROVINCIA || '',
      ricerca_attiva: Boolean(attributes.RICERCA_ATTIVA),
      automunito: Boolean(attributes.AUTOMUNITO),
      trasferte: Boolean(attributes.TRASFERTE),
      competenze: competenzeArray,
      cv_url: attributes.CV_URL || '',
      portfolio_url: attributes.PORTFOLIO_URL || '',

      // Dati Azienda
      azienda: attributes.AZIENDA || '',
      referente: attributes.REFERENTE || '',
      sms: attributes.SMS || '',
      indirizzo: attributes.INDIRIZZO || '',
      sito_web: attributes.SITO_WEB || '',
      descrizione: attributes.DESCRIZIONE || '',
      logo_url: attributes.LOGO_URL || '',
    }

    // 4. Generazione del Magic Link contenente l'URL di destinazione finale
    const magicLinkUrl = generateMagicLink(req, payload, targetRedirect)

    // 5. Trigger evento per l'invio dell'email transazionale tramite Brevo
    await trackEvent({
      eventName: 'magic_link_requested',
      email: cleanEmail,
      properties: {
        magic_link: magicLinkUrl,
        tipo_utente,
        redirect_url: targetRedirect,
      },
    })

    return res.status(200).json({
      message: 'Magic Link inviato con successo! Controlla la tua casella di posta.',
    })

  } catch (error: any) {
    console.error('[API Auth Login Error]', error)
    if (error instanceof BrevoError) {
      return res.status(error.status).json({ message: error.message })
    }
    return res.status(500).json({ message: 'Errore interno durante l\'invio del Magic Link' })
  }
}