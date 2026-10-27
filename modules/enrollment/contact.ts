/**
 * Contatto Brevo della persona che si iscrive. Si legge solo dopo la verifica
 * dell'email, così il sito non rivela a nessuno se un indirizzo è già noto.
 */
import { BrevoError, brevoFetch, getContact, upsertContact } from '@modules/brevo'
import { normalizePhone } from '@modules/crm-form'
import type { ChiSei } from './validation'
import { contractEmailHtml, contractEmailSubject, contractEmailText, type ContractEmailInput } from './contract-email'

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

/**
 * Scadenza dell'offerta open day del contatto (attributo OFFERTA_SCADENZA_DATA), o null.
 * SCADENZA_OFFERTA è il nome di prima del 26/10: resta in Brevo finché non si cancella.
 */
export async function offerDeadline(email: string): Promise<string | null> {
  try {
    const contact = await getContact({ identifier: email })
    const attributes = (contact?.attributes as Record<string, unknown> | undefined) || {}
    const value = attributes.OFFERTA_SCADENZA_DATA || attributes.SCADENZA_OFFERTA
    return typeof value === 'string' && value ? value.slice(0, 10) : null
  } catch (error) {
    if (error instanceof BrevoError && error.status === 404) return null
    throw error
  }
}

/** Mittente degli SMS: massimo 11 caratteri, va abilitato in Brevo. */
const SMS_SENDER = (process.env.ENROLLMENT_SMS_SENDER || 'MIIA').slice(0, 11)

/** Codice per la firma (passo 6), via SMS transazionale Brevo al cellulare del passo 1. */
export async function sendSignatureSms(phone: string, code: string, minutes: number) {
  await brevoFetch('/transactionalSMS/sms', {
    method: 'POST',
    body: {
      type: 'transactional',
      sender: SMS_SENDER,
      recipient: phone.replace(/^\+/, ''),
      content: `${code} è il codice per firmare l'iscrizione a Made in Italy Academy. Vale ${minutes} minuti. Non condividerlo con nessuno.`,
      tag: 'iscrizione_firma',
    },
  })
}

/** Copia della segreteria per ogni contratto firmato. */
const OFFICE_COPY = process.env.ENROLLMENT_OFFICE_EMAIL || 'iscrizione@miia.it'

/** Email con il contratto firmato in allegato, alla persona e in copia nascosta alla segreteria. */
export async function sendContractEmail(input: ContractEmailInput & { email: string; pdf: Uint8Array; fileName: string }) {
  await brevoFetch('/smtp/email', {
    method: 'POST',
    body: {
      sender: SENDER,
      to: [{ email: input.email, name: input.nome }],
      bcc: [{ email: OFFICE_COPY }],
      replyTo: { email: OFFICE_COPY },
      subject: contractEmailSubject(input),
      htmlContent: contractEmailHtml(input),
      textContent: contractEmailText(input),
      attachment: [{ name: input.fileName, content: Buffer.from(input.pdf).toString('base64') }],
      tags: ['iscrizione_firmata'],
    },
  })
}
