import type { GetServerSideProps } from 'next'
import { BrevoError, getContact } from '@modules/brevo'
import { normalizeEmail } from '@modules/crm-form'
import { loadOpenday, normalizeCodice, stasera } from '@modules/openday-accesso'

/**
 * miia.it/open-day/accedi senza codice (per esempio scritto a mano).
 * Con l'email nel link usa l'open day a cui la persona è iscritta (OD_CODICE);
 * altrimenti, se stasera c'è un solo open day, porta a quello. Nei casi dubbi
 * porta alla pagina con un codice sconosciuto, che rimanda all'ultima email.
 */
export const getServerSideProps: GetServerSideProps = async ({ query, res }) => {
  res.setHeader('Cache-Control', 'no-store')
  const email = normalizeEmail(query.email)
  const suffix = email ? `?email=${encodeURIComponent(email)}` : ''

  if (email) {
    try {
      const contact = await getContact({ identifier: email })
      const codice = normalizeCodice((contact as { attributes?: Record<string, unknown> })?.attributes?.OD_CODICE)
      if (codice)
        return {
          redirect: {
            destination: `/open-day/accedi/${codice}${suffix}`,
            permanent: false,
          },
        }
    } catch (error) {
      if (!(error instanceof BrevoError && error.status === 404)) {
        console.error('[Open day] Lettura del contatto non riuscita:', error)
      }
    }
  }

  const oggi = await loadOpenday()
    .then((eventi) => stasera(eventi))
    .catch(() => [])
  const destinazione = oggi.length === 1 ? oggi[0].codice : 'non-trovato'
  return {
    redirect: {
      destination: `/open-day/accedi/${destinazione}${suffix}`,
      permanent: false,
    },
  }
}

export default function AccediSenzaCodice() {
  return null
}
