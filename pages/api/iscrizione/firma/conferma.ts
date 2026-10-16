import { uploadFile } from '@modules/google'
import { body, enrollmentApi } from '@modules/enrollment/api'
import { CODE_MAX_ATTEMPTS, codeMatches, normalizeCode } from '@modules/enrollment/codes'
import { sendContractEmail } from '@modules/enrollment/contact'
import { syncSignedContact } from '@modules/enrollment/brevo-sync'
import { buildContractPdf } from '@modules/enrollment/contract'
import { courseTitle } from '@modules/enrollment/courses'
import { latestActiveCode, logEvent, markCodeUsed, signEnrollment, takeCodeAttempt } from '@modules/enrollment/db'
import { withdrawalEnd } from '@modules/enrollment/dates'
import { requireDraft } from '@modules/enrollment/draft'
import { MODE_LABELS, euro, longDate, paymentStart, romeDateTime } from '@modules/enrollment/labels'
import { checkReadyToSign } from '@modules/enrollment/sign'
import { clientIp, publicState, userAgent } from '@modules/enrollment/state'
import { signedEvent } from '@modules/enrollment/tracking'
import { contractNumber } from '@modules/enrollment/withdrawal'

const EXPIRED = 'Il codice è scaduto o non è più valido. Chiedine uno nuovo.'

/**
 * Passo 6: firma con il codice SMS. Si ricontrolla tutto, si genera il PDF,
 * lo si salva nel bucket privato, la bozza diventa "firmata" e il contratto
 * parte per email (alla persona e in copia alla segreteria).
 */
export default enrollmentApi(['POST'], async (req, res) => {
  const draft = await requireDraft(req, res)
  if (!draft) return
  const { row, session, corso } = draft
  const code = normalizeCode(body(req).codice)
  if (!code) return res.status(400).json({ message: 'Il codice è di 6 cifre', campo: 'codice' })

  const active = await latestActiveCode(session.email, 'firma')
  if (!active) return res.status(400).json({ message: EXPIRED, campo: 'codice' })
  if (!(await takeCodeAttempt(active.id, CODE_MAX_ATTEMPTS))) {
    return res.status(400).json({ message: 'Troppi tentativi. Chiedi un nuovo codice.', campo: 'codice' })
  }
  if (!codeMatches(active.codice_hash, session.email, 'firma', code)) {
    const left = CODE_MAX_ATTEMPTS - active.tentativi - 1
    return res.status(400).json({
      message: left > 0 ? `Il codice non è corretto. Tentativi rimasti: ${left}.` : 'Troppi tentativi. Chiedi un nuovo codice.',
      campo: 'codice',
    })
  }

  // Tra l'invio del codice e la firma possono cambiare testi o posti: si ricontrolla.
  const check = await checkReadyToSign(row, corso)
  if (!check.ok) return res.status(check.status).json({ message: check.message, passo: check.passo })
  if (!(await markCodeUsed(active.id))) return res.status(400).json({ message: EXPIRED, campo: 'codice' })

  const ip = clientIp(req)
  const ua = userAgent(req)
  const now = new Date()
  const fine_recesso = withdrawalEnd(now)
  const { edition, conditions } = check
  const edizione = {
    chiave: edition.chiave,
    titolo: edition.titolo,
    sede: edition.sede,
    giorni: edition.giorni,
    orari: edition.orari,
    inizio: edition.inizio,
    fine: edition.fine,
  }

  const { bytes, sha256 } = await buildContractPdf({
    corso,
    row,
    edizione,
    quota_esame: check.quota_esame,
    condizioni: conditions,
    firma: { ora: now, telefono: row.telefono || '', ip, fine_recesso },
  })
  const fileName = `contratto-${now.getTime()}.pdf`
  const uploaded = await uploadFile({
    fileBuffer: Buffer.from(bytes),
    fileName,
    mimeType: 'application/pdf',
    folderPath: `iscrizioni/${row.id}`,
  })

  const signed = await signEnrollment(row.id, session.email, {
    edizione: { ...edizione, condizioni: { versione: conditions.versione, impronta: conditions.impronta } },
    firmata_il: now,
    fine_recesso,
    pdf_percorso: uploaded.id,
    pdf_sha256: sha256,
  })
  // Due firme insieme: la seconda non trova più la bozza.
  if (!signed) return res.status(409).json({ message: 'Questa iscrizione è già stata firmata.' })
  await logEvent(row.id, 'firmata', ip, ua, {
    codice_id: active.id,
    telefono: row.telefono,
    condizioni_versione: conditions.versione,
    condizioni_impronta: conditions.impronta,
    pdf_sha256: sha256,
    edizione: edition.chiave,
  })

  try {
    await syncSignedContact(row, edition, courseTitle(corso), now)
    await logEvent(row.id, 'brevo_aggiornato', ip, ua, {})
  } catch (error) {
    // La firma resta valida: i dati in Brevo si possono ricopiare da Neon.
    console.error('[Iscrizione] Aggiornamento del contatto Brevo non riuscito:', error)
    await logEvent(row.id, 'brevo_non_aggiornato', ip, ua, {})
  }

  try {
    const total = row.pagamento_totale === null ? null : Number(row.pagamento_totale)
    const rata = row.pagamento_rata === null ? null : Number(row.pagamento_rata)
    const mode = row.pagamento_modalita
    const pagamento =
      mode && total !== null
        ? mode === 'unica' || rata === null
          ? `${MODE_LABELS[mode]}, ${euro(total)}`
          : `${MODE_LABELS[mode]} da ${euro(rata)}, totale ${euro(total)}`
        : ''
    await sendContractEmail({
      email: session.email,
      nome: row.nome || '',
      corso: courseTitle(corso),
      numero: contractNumber(row.id, now),
      edizione: edition.titolo || edition.sede,
      sede: edition.sede,
      giorniOrari: [edition.giorni.join(' e '), edition.orari.join(', ')].filter(Boolean).join(', '),
      inizio: longDate(edition.inizio),
      pagamento,
      dopo: [paymentStart(edition.inizio)],
      firmataIl: romeDateTime(now),
      fineRecesso: longDate(fine_recesso),
      pdf: bytes,
      fileName: `Contratto ${contractNumber(row.id, now)} - ${courseTitle(corso)}.pdf`,
    })
    await logEvent(row.id, 'email_inviata', ip, ua, { pdf_sha256: sha256 })
  } catch (error) {
    // La firma è valida e il PDF è nell'archivio: la segreteria lo rimanda a mano.
    console.error('[Iscrizione] Invio del contratto non riuscito:', error)
    await logEvent(row.id, 'email_non_inviata', ip, ua, {})
  }

  return res.status(200).json({ ok: true, iscrizione: publicState(signed), evento: signedEvent(row, edizione) })
})
