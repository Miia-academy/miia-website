import { getCourseEditions, getPriceList } from './catalog'
import { offerDeadline } from './contact'
import { countSignedByEdition } from './db'
import { buildOffer, type CourseOffer } from './offer'

function orNull<T>(what: string, promise: Promise<T>): Promise<T | null> {
  return promise.catch((error) => {
    console.error(`[Iscrizione] ${what} non riuscita:`, error)
    return null
  })
}

/**
 * Legge Storyblok, Neon e Brevo e prepara l'offerta del passo 2 per quella persona.
 * Se Brevo non risponde si mostra il prezzo pieno; se manca il listino il passo non si completa.
 */
export async function loadOffer(corso: string, email: string): Promise<CourseOffer> {
  const [editions, list, scadenza] = await Promise.all([
    getCourseEditions(corso),
    orNull('Lettura del listino', getPriceList()),
    orNull('Lettura di OFFERTA_SCADENZA_DATA', offerDeadline(email)),
  ])
  const signed = await countSignedByEdition(editions.map((e) => e.chiave))
  return buildOffer(editions, signed, list, scadenza)
}
