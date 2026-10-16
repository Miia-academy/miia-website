/**
 * Email con il contratto firmato, costruita sul layout "servizio" approvato per
 * le email del funnel (funnel/email_layout/layout_servizio.html): fascia scura con
 * il logo, fondo bianco, dettagli con la linea verde, footer con i dati legali.
 *
 * Ogni email contiene il numero del contratto e il riepilogo dell'iscrizione:
 * così due email non sono mai identiche e Gmail non nasconde il testo con i "…".
 */
import { ACADEMY, withdrawalSentence } from './withdrawal'

export interface ContractEmailInput {
  nome: string
  corso: string
  numero: string
  /** Titolo dell'edizione (es. "Corso Interior Design - Treviso") e sede. */
  edizione: string
  sede: string
  giorniOrari: string
  inizio: string
  pagamento: string
  firmataIl: string
  fineRecesso: string
  /** "Cosa succede adesso", un passo per riga; vuoto finché non c'è un testo approvato. */
  dopo?: string[]
}

const LOGO = 'https://a.storyblok.com/f/311109/fb5036203a/email-logo-scuro.png'
const BAND = 'https://a.storyblok.com/f/311109/d3344d199e/email-fascia-scura.png'
const SITE = 'https://www.miia.it/?utm_source=brevo&amp;utm_medium=email&amp;utm_campaign=iscrizione_firmata'
const FONT = 'font-family:Arial, Helvetica, sans-serif;'
const INK = '#1E1E1C'
const MUTED = '#5E6362'
const LINK = '#00703A'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const p = (html: string, { size = 16, line = 25, color = INK, cls = 'tx', margin = '0 0 16px 0' } = {}) =>
  `<p class="${cls}" style="margin:${margin};${FONT}font-size:${size}px;line-height:${line}px;color:${color};">${html}</p>`

/** Righe "etichetta / valore" dentro il blocco con la linea a sinistra; quelle vuote si saltano. */
function details(rows: Array<[string, string]>, border: string): string {
  const body = rows
    .filter(([, v]) => v)
    .map(
      ([label, value]) =>
        `<tr><td class="tx-muted stack" valign="top" style="padding:6px 16px 6px 0;${FONT}font-size:14px;line-height:20px;color:${MUTED};width:120px;">${esc(label)}</td>` +
        `<td class="tx stack" valign="top" style="padding:6px 0;${FONT}font-size:16px;line-height:22px;color:${INK};font-weight:bold;">${esc(value)}</td></tr>`
    )
    .join('')
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid ${border};margin:4px 0 24px 0;">` +
    `<tr><td style="padding:2px 0 2px 16px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0">${body}</table></td></tr></table>`
  )
}

const rule = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="bd" style="border-top:1px solid #E1E4E2;font-size:0;line-height:0;height:1px;">&nbsp;</td></tr></table>`

export function contractEmailSubject(input: Pick<ContractEmailInput, 'corso' | 'numero'>): string {
  return `Iscrizione firmata: ${input.corso} (contratto n. ${input.numero})`
}

export function contractEmailHtml(input: ContractEmailInput): string {
  const sentence = withdrawalSentence(input.corso, input.sede)
  const dopo = input.dopo || []
  const steps = dopo.length
    ? p('<strong>Cosa succede adesso</strong>', { margin: '0 0 8px 0' }) +
      `<ul class="tx" style="margin:0 0 24px 0;padding-left:20px;${FONT}font-size:16px;line-height:25px;color:${INK};">${dopo
        .map((s) => `<li style="margin:0 0 6px 0;">${esc(s)}</li>`)
        .join('')}</ul>`
    : ''
  const preheader = `Contratto n. ${input.numero} in allegato. Puoi ripensarci senza costi fino al ${input.fineRecesso}.`

  return `<!DOCTYPE html>
<html lang="it" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>La tua iscrizione è firmata</title>
<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  @media screen and (max-width:620px) {
    .container { width:100% !important; }
    .px { padding-left:16px !important; padding-right:16px !important; }
    .outer { padding:8px 0 !important; }
    .h1 { font-size:22px !important; line-height:28px !important; }
    .stack { display:block !important; width:100% !important; padding:2px 0 !important; }
  }
  @media (prefers-color-scheme: dark) {
    .bg-page, .bg-card { background:#1C1F1E !important; }
    .tx { color:#ECEDEC !important; }
    .tx-muted { color:#B3B8B6 !important; }
    .tx-link { color:#5FD08F !important; }
    .bd { border-color:#2E3432 !important; }
  }
  [data-ogsc] .tx { color:#ECEDEC !important; }
  [data-ogsc] .tx-muted { color:#B3B8B6 !important; }
  [data-ogsc] .tx-link { color:#5FD08F !important; }
  [data-ogsb] .bg-page, [data-ogsb] .bg-card { background:#1C1F1E !important; }
</style>
</head>
<body id="body" class="bg-page" style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background:#FFFFFF;">
<tr><td align="center" bgcolor="#1E1E1C" background="${BAND}" style="background-color:#1E1E1C;background-image:url(${BAND});background-repeat:repeat;border-top:4px solid #008C45;padding:20px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;"><tr><td class="px" style="padding:0 40px;"><a href="${SITE}&amp;utm_content=logo" style="text-decoration:none;"><img src="${LOGO}" width="171" height="45" alt="Made in Italy Academy" style="display:block;width:171px;height:45px;${FONT}font-size:16px;font-weight:bold;color:#F3F3F2;"></a></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
<tr><td align="center" class="outer" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td class="bg-card px" style="background:#ffffff;padding:8px 40px 32px 40px;">
<h1 class="h1 tx" style="margin:16px 0 16px 0;${FONT}font-size:26px;line-height:32px;font-weight:bold;color:${INK};">La tua iscrizione è firmata</h1>
${p(`Ciao ${esc(input.nome)},`)}
${p(`grazie per aver scelto Made in Italy Academy. La tua iscrizione al corso <strong>${esc(input.corso)}</strong> è firmata. In allegato trovi il contratto in PDF: conservalo, è la tua copia.`)}
${details(
  [
    ['Contratto n.', input.numero],
    ['Corso', input.corso],
    ['Edizione', input.edizione],
    ['Giorni e orari', input.giorniOrari],
    ['Inizio', input.inizio],
    ['Pagamento', input.pagamento],
    ['Firmato il', input.firmataIl],
  ],
  '#008C45'
)}
${steps}
${rule}
<br>
${p('<strong>Se cambi idea</strong>', { margin: '0 0 8px 0' })}
${p(`Puoi annullare l’iscrizione senza costi fino al <strong>${esc(input.fineRecesso)}</strong> compreso. Rispondi a questa email scrivendo:`, { margin: '0 0 12px 0' })}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-left:4px solid #B3B8B6;margin:0 0 12px 0;"><tr><td class="tx" style="padding:4px 16px;${FONT}font-size:16px;line-height:24px;color:${INK};font-style:italic;">${esc(sentence)}</td></tr></table>
${p(`In alternativa puoi usare la PEC (${ACADEMY.pec}) o una raccomandata a ${ACADEMY.ragione_sociale}, ${ACADEMY.indirizzo}.`, { size: 14, line: 21, color: MUTED, cls: 'tx-muted', margin: '0 0 24px 0' })}
${p(`Per qualsiasi domanda rispondi a questa email o scrivici su <a class="tx-link" href="https://wa.me/393484463000" style="color:${LINK};text-decoration:underline;">WhatsApp</a>.`, { size: 15, line: 23, color: MUTED, cls: 'tx-muted', margin: '0' })}
</td></tr>
<tr><td class="px" style="padding:0 40px;">${rule}</td></tr>
<tr><td class="px" style="padding:24px 40px 8px 40px;">
${p('<strong>Made in Italy Academy</strong> · fashion &amp; interior design', { size: 13, line: 20, color: MUTED, cls: 'tx-muted', margin: '0 0 6px 0' })}
${p(`Telefono e WhatsApp <a class="tx-link" href="https://wa.me/393484463000" style="color:${MUTED};text-decoration:underline;">348 446 3000</a> · Numero verde 800 913 149 · <a class="tx-link" href="${SITE}&amp;utm_content=footer" style="color:${MUTED};text-decoration:underline;">miia.it</a>`, { size: 13, line: 20, color: MUTED, cls: 'tx-muted', margin: '0 0 6px 0' })}
${p(`${ACADEMY.ragione_sociale} · ${ACADEMY.indirizzo} · P. IVA ${ACADEMY.partita_iva}`, { size: 13, line: 20, color: MUTED, cls: 'tx-muted', margin: '0 0 14px 0' })}
${p('Ricevi questa email perché hai firmato l’iscrizione a un corso di Made in Italy Academy.', { size: 12, line: 19, color: MUTED, cls: 'tx-muted', margin: '0' })}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`
}

export function contractEmailText(input: ContractEmailInput): string {
  const dopo = input.dopo || []
  const rows = [
    ['Contratto n.', input.numero],
    ['Corso', input.corso],
    ['Edizione', input.edizione],
    ['Giorni e orari', input.giorniOrari],
    ['Inizio', input.inizio],
    ['Pagamento', input.pagamento],
    ['Firmato il', input.firmataIl],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
  return (
    `Ciao ${input.nome},\n\n` +
    `grazie per aver scelto Made in Italy Academy. La tua iscrizione al corso ${input.corso} è firmata. ` +
    `In allegato trovi il contratto in PDF: conservalo, è la tua copia.\n\n${rows}\n\n` +
    (dopo.length ? `Cosa succede adesso:\n${dopo.map((s) => `- ${s}`).join('\n')}\n\n` : '') +
    `Se cambi idea\nPuoi annullare l'iscrizione senza costi fino al ${input.fineRecesso} compreso. Rispondi a questa email scrivendo:\n` +
    `"${withdrawalSentence(input.corso, input.sede)}"\n` +
    `In alternativa puoi usare la PEC (${ACADEMY.pec}) o una raccomandata a ${ACADEMY.ragione_sociale}, ${ACADEMY.indirizzo}.\n\n` +
    `Per qualsiasi domanda rispondi a questa email o scrivici su WhatsApp al 348 446 3000.\n\n` +
    `Made in Italy Academy\n${ACADEMY.ragione_sociale} · ${ACADEMY.indirizzo} · P. IVA ${ACADEMY.partita_iva}`
  )
}
