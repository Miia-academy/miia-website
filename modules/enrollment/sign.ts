/**
 * Controlli prima della firma (passo 6), uguali per l'invio del codice e per la
 * firma: passi completi, testi delle condizioni ancora quelli accettati,
 * edizione scelta ancora aperta e con posti.
 */
import { getConditions, type Conditions } from './conditions'
import { loadOffer } from './load-offer'
import { openEditions, type EditionOption } from './offer'
import type { Enrollment, SectionId } from './types'
import { canSaveSection } from './validation'

export type SignCheck =
  | { ok: true; conditions: Conditions; edition: EditionOption; quota_esame: number | null }
  | { ok: false; status: number; message: string; passo?: SectionId }

export async function checkReadyToSign(row: Enrollment, corso: string): Promise<SignCheck> {
  if (!canSaveSection('firma', row.sezioni_complete)) {
    return { ok: false, status: 409, message: 'Completa prima i passi precedenti' }
  }
  const conditions = await getConditions()
  if (!conditions) {
    return { ok: false, status: 503, message: 'Le condizioni non sono disponibili in questo momento, riprova più tardi.' }
  }
  if (row.consensi?.impronta !== conditions.impronta) {
    return { ok: false, status: 409, message: 'Le condizioni sono state aggiornate: rileggile e conferma di nuovo.', passo: 'consensi' }
  }
  const offer = await loadOffer(corso, row.email)
  const open = openEditions(offer)
  const edition = offer.edizioni.find((e) => e.chiave === row.edizione_chiave)
  if (!edition || !open.includes(edition.chiave)) {
    return {
      ok: false,
      status: 409,
      message: 'L’edizione che hai scelto non ha più posti o non è più disponibile: scegline un’altra.',
      passo: 'corso',
    }
  }
  return { ok: true, conditions, edition, quota_esame: offer.quota_esame }
}

/** "+39 333 ••• 4567": abbastanza per riconoscere il numero, senza mostrarlo tutto. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\s/g, '')
  if (digits.length < 7) return digits
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ••• ${digits.slice(-4)}`
}
