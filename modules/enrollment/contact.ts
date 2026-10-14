/**
 * Contatto Brevo della persona che si iscrive. Si legge solo dopo la verifica
 * dell'email, così il sito non rivela a nessuno se un indirizzo è già noto.
 */
import { BrevoError, brevoFetch, getContact, upsertContact } from '@modules/brevo'
import { normalizePhone } from '@modules/crm-form'
import type { ChiSei } from './validation'

export interface Prefill {
  nome: string
  cognome: string
  telefono: string
}

const EMPTY: Prefill = { nome: '', cognome: '', telefono: '' }

export async function contactPrefill(email: string): Promise<Prefill & { trovato: boolean }> {
  try {
    const contact = await getContact({ identifier: email })
    const attrs = (contact?.attributes || {}) as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    return {
      trovato: true,
      nome: str(attrs.NOME || attrs.FIRSTNAME),
      cognome: str(attrs.COGNOME || attrs.LASTNAME),
      telefono: normalizePhone(attrs.SMS || attrs.TELEFONO) || '',
    }
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return { ...EMPTY, trovato: false }
    throw error
  }
}

/** Salva nome, cognome e cellulare nel contatto (lo crea se è nuovo). */
export async function syncContact(email: string, value: ChiSei) {
  try {
    await upsertContact({ email, attributes: { NOME: value.nome, COGNOME: value.cognome, SMS: value.telefono } })
  } catch (error) {
    // Brevo rifiuta un cellulare già usato da un altro contatto: salviamo il resto.
    if (!(error instanceof BrevoError && error.status === 400)) throw error
    console.error('[Iscrizione] Cellulare rifiutato da Brevo, salvo nome e cognome:', error.message)
    await upsertContact({ email, attributes: { NOME: value.nome, COGNOME: value.cognome } })
  }
}

const SENDER = {
  email: process.env.ENROLLMENT_SENDER_EMAIL || 'iscrizione@miia.it',
  name: 'Iscrizione - Made in Italy Academy',
}

/** Email transazionale con il codice: parte subito dal sito, non da un'automazione. */
export async function sendCodeEmail(email: string, code: string, minutes: number) {
  const text =
    `Il tuo codice per l'iscrizione è ${code}.\n` +
    `Vale ${minutes} minuti. Se non hai chiesto tu di iscriverti, ignora questa email.\n\n` +
    'Made in Italy Academy'
  const html = `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#F3F3F2;font-family:Montserrat,Arial,sans-serif;color:#232325">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 16px;font-size:16px">Ecco il codice per continuare l'iscrizione:</p>
<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px;color:#008C45">${code}</p>
<p style="margin:0 0 24px;font-size:14px;color:#686D6C">Vale ${minutes} minuti. Se non hai chiesto tu di iscriverti, ignora questa email.</p>
<p style="margin:0;font-size:14px">Made in Italy Academy</p>
</td></tr></table></body></html>`

  await brevoFetch('/smtp/email', {
    method: 'POST',
    body: {
      sender: SENDER,
      to: [{ email }],
      subject: `${code} è il tuo codice per l'iscrizione`,
      htmlContent: html,
      textContent: text,
      tags: ['iscrizione_codice'],
    },
  })
}

/** Scadenza dell'offerta open day del contatto (attributo SCADENZA_OFFERTA), o null. */
export async function offerDeadline(email: string): Promise<string | null> {
  try {
    const contact = await getContact({ identifier: email })
    const value = (contact?.attributes as Record<string, unknown> | undefined)?.SCADENZA_OFFERTA
    return typeof value === 'string' && value ? value.slice(0, 10) : null
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return null
    throw error
  }
}
