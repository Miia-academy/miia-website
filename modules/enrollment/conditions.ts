/**
 * Consensi del passo 5, da Storyblok: una storia "term_condition" per consenso
 * nella cartella "iscrizione/condizioni", nell'ordine della cartella. Il nome
 * della storia (slug) è la chiave con cui si salva il consenso.
 *
 * L'impronta (SHA-256 di tutti i testi) si salva con i consensi: alla firma si
 * controlla che nessun testo sia cambiato, aggiunto o tolto dopo l'accettazione.
 * Testo semplice: paragrafi separati da una riga vuota, così lo stesso testo va
 * nella pagina e nel PDF.
 */
import { createHash } from 'node:crypto'
import { cdn } from './catalog'

export const CONDITIONS_FOLDER = 'iscrizione/condizioni/'

export type ConsentKind = 'spunta' | 'si_no'

export interface ConditionItem {
  chiave: string
  titolo: string
  riferimento: string
  descrizione: string
  testo_completo: string
  tipo: ConsentKind
  /** Testo della casella, o della scelta "Sì". */
  etichetta: string
  etichetta_no: string
  nota_no: string
  obbligatorio: boolean
}

export interface Conditions {
  /** Versione leggibile dei testi: le prime cifre dell'impronta. */
  versione: string
  impronta: string
  voci: ConditionItem[]
}

interface StoryLike {
  slug?: string
  position?: number
  content?: Record<string, unknown>
}

const text = (content: Record<string, unknown>, key: string) =>
  typeof content[key] === 'string' ? (content[key] as string).replace(/\r\n/g, '\n').trim() : ''

/** Una voce senza titolo o senza testo della casella non si mostra: non si accetta un consenso vuoto. */
export function parseConditionItem(story: StoryLike): ConditionItem | null {
  const c = story.content || {}
  const chiave = typeof story.slug === 'string' ? story.slug : ''
  const titolo = text(c, 'titolo')
  const etichetta = text(c, 'etichetta')
  if (!/^[a-z0-9-]+$/.test(chiave) || !titolo || !etichetta) return null
  const tipo: ConsentKind = c.tipo === 'si_no' ? 'si_no' : 'spunta'
  return {
    chiave,
    titolo,
    riferimento: text(c, 'riferimento'),
    descrizione: text(c, 'descrizione'),
    testo_completo: text(c, 'testo_completo'),
    tipo,
    etichetta,
    etichetta_no: tipo === 'si_no' ? text(c, 'etichetta_no') || 'No' : '',
    nota_no: tipo === 'si_no' ? text(c, 'nota_no') : '',
    obbligatorio: c.obbligatorio === true,
  }
}

/** Null se non c'è nessuna voce valida: senza consensi non si firma. */
export function parseConditions(stories: StoryLike[] | null | undefined): Conditions | null {
  const voci = [...(stories || [])]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(parseConditionItem)
    .filter((v): v is ConditionItem => !!v)
  if (!voci.length) return null
  const impronta = createHash('sha256').update(JSON.stringify(voci)).digest('hex').slice(0, 16)
  return { versione: impronta.slice(0, 8), impronta, voci }
}

export async function getConditions(): Promise<Conditions | null> {
  try {
    const data = await cdn<{ stories?: StoryLike[] }>('stories', {
      starts_with: CONDITIONS_FOLDER,
      content_type: 'term_condition',
      sort_by: 'position:asc',
      per_page: '100',
    })
    return parseConditions(data.stories)
  } catch (error) {
    console.error('[Iscrizione] Condizioni non disponibili da Storyblok:', error)
    return null
  }
}
