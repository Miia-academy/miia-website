/**
 * I corsi e i loro indirizzi.
 *
 * `codice` è il nome interno del corso: lo usano iscrizioni, contratti, Brevo e le email
 * già inviate, e non cambia mai. `indirizzo` è il nome della cartella del corso in Storyblok,
 * direttamente sotto corsi/: la pagina è /corsi/<indirizzo>, le sedi /corsi/<indirizzo>/<sede>,
 * l'iscrizione /iscrizione/<indirizzo>.
 *
 * Un corso che non è in tabella resta come prima: cartella corsi/<area>/<codice>.
 */

export type Area = 'interior-design' | 'fashion-design'
export type Livello = 'primo' | 'secondo'

export interface Corso {
  codice: string
  indirizzo: string
  area: Area
  livello: Livello
}

export const CORSI: readonly Corso[] = [
  { codice: 'corso-interior-design-primo-livello', indirizzo: 'interior-design-arredo', area: 'interior-design', livello: 'primo' },
  { codice: 'corso-interior-design-secondo-livello', indirizzo: 'interior-design-cantiere', area: 'interior-design', livello: 'secondo' },
  { codice: 'corso-fashion-design-primo-livello', indirizzo: 'fashion-design-modellista', area: 'fashion-design', livello: 'primo' },
]

/** Nomi brevi delle aree, come nei campi di Storyblok e Brevo ("interni - primo livello"). */
export const AREA_BREVE: Record<Area, string> = { 'interior-design': 'interni', 'fashion-design': 'moda' }

/** Sedi con una pagina propria del corso. */
export const SEDI = ['treviso', 'padova', 'bassano'] as const

/**
 * Redirect permanenti dai vecchi indirizzi (corsi/<area>/<codice>, le sue sedi e
 * /iscrizione/<codice>) ai nuovi. Li legge next.config.ts.
 */
export function redirectCorsi() {
  return CORSI.flatMap(({ codice, indirizzo, area }) => [
    { source: `/corsi/${area}/${codice}-:sede(${SEDI.join('|')})`, destination: `/corsi/${indirizzo}/:sede`, permanent: true },
    { source: `/corsi/${area}/${codice}/:path*`, destination: `/corsi/${indirizzo}/:path*`, permanent: true },
    { source: `/iscrizione/${codice}`, destination: `/iscrizione/${indirizzo}`, permanent: true },
  ])
}
