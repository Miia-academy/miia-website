/**
 * Passo 4 "Il tuo profilo": voci delle scelte e "Come ci hai conosciuto"
 * suggerito dalla provenienza registrata dal sito.
 */
import type {
  AREE_STUDIO,
  COME_CI_HAI_CONOSCIUTO,
  LIVELLI_COMPUTER,
  ORE_SETTIMANA,
  SETTORI_LAVORO,
  SITUAZIONI_LAVORO,
  TITOLI_STUDIO,
} from './validation'

type Source = (typeof COME_CI_HAI_CONOSCIUTO)[number]

export const TITOLO_LABELS: Record<(typeof TITOLI_STUDIO)[number], string> = {
  licenza_media: 'Licenza media',
  diploma: 'Diploma',
  laurea_triennale: 'Laurea triennale',
  laurea_magistrale: 'Laurea magistrale',
  altro: 'Altro',
}

export const AREA_LABELS: Record<(typeof AREE_STUDIO)[number], string> = {
  artistica: 'Artistica (arte, design, architettura)',
  linguistica: 'Linguistica',
  umanistica: 'Umanistica',
  economica: 'Economica',
  scientifica: 'Scientifica',
  tecnologica: 'Tecnologica',
  salute: 'Salute',
  agroalimentare: 'Agroalimentare',
  turismo: 'Turismo',
  altro: 'Altro',
}

export const SITUAZIONE_LABELS: Record<(typeof SITUAZIONI_LAVORO)[number], string> = {
  studente: 'Studio',
  disoccupato: 'Cerco lavoro',
  operativo: 'Lavoro operativo',
  tecnico: 'Lavoro tecnico',
  impiegato: 'Impiego d’ufficio',
  freelance: 'Libera professione',
  quadro: 'Quadro',
  dirigente: 'Dirigenza',
  imprenditore: 'Ho un’impresa',
  altro: 'Altro',
}

export const SETTORE_LABELS: Record<(typeof SETTORI_LAVORO)[number], string> = {
  arredamento_design: 'Arredamento e design',
  edilizia_architettura: 'Edilizia e architettura',
  moda: 'Moda',
  commercio_vendita: 'Commercio e vendita',
  marketing_comunicazione: 'Marketing e comunicazione',
  industria_produzione: 'Industria e produzione',
  servizi: 'Servizi',
  pa_scuola: 'Pubblica amministrazione e scuola',
  sanita: 'Sanità',
  turismo_ristorazione: 'Turismo e ristorazione',
  altro: 'Altro',
}

export const ORE_LABELS: Record<(typeof ORE_SETTIMANA)[number], string> = {
  almeno_6: 'Almeno 6 ore',
  tra_6_e_9: 'Tra 6 e 9 ore',
  tutto_il_necessario: 'Tutto il tempo necessario',
}

export const COMPUTER_LABELS: Record<(typeof LIVELLI_COMPUTER)[number], string> = {
  base: 'Base',
  buona: 'Buona',
  ottima: 'Ottima',
}

export const SOURCE_LABELS: Record<Source, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  google: 'Ricerca Google',
  pubblicita_internet: 'Pubblicità su internet',
  spotify_radio: 'Spotify / radio',
  amico: 'Tramite un amico',
  locandine: 'Locandine / volantini',
  azienda: 'In azienda',
}

const PAID = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|display|banner|cpm)$/

/** Una provenienza (sorgente e mezzo) tradotta nella voce di "Come ci hai conosciuto", se c'è. */
function sourceOf(source: string, medium: string): Source | null {
  const s = source.toLowerCase()
  const m = medium.toLowerCase()
  if (/instagram|^ig$/.test(s)) return 'instagram'
  if (/facebook|^fb$|^meta$/.test(s)) return 'facebook'
  if (/spotify|radio/.test(s)) return 'spotify_radio'
  if (/google/.test(s)) return PAID.test(m) ? 'pubblicita_internet' : 'google'
  if (PAID.test(m)) return 'pubblicita_internet'
  return null
}

/** Voci già spuntate al passo 4, dalla prima e dall'ultima provenienza registrate. */
export function suggestedSources(provenienza: Record<string, unknown> | null | undefined): Source[] {
  const p = provenienza || {}
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const found = [
    sourceOf(str('origine_sorgente'), str('origine_mezzo')),
    sourceOf(str('ultima_sorgente'), str('ultima_mezzo')),
  ].filter((s): s is Source => !!s)
  return Array.from(new Set(found))
}
