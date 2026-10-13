export type PaymentMode = 'unica' | '5_rate' | '10_rate'

export const PAYMENT_MODES: readonly PaymentMode[] = ['unica', '5_rate', '10_rate']

export type EnrollmentStatus = 'bozza' | 'firmata' | 'recesso' | 'definitiva' | 'annullata'

/** Sezioni della pagina, nell'ordine in cui si aprono. */
export type SectionId = 'chi_sei' | 'corso' | 'dati' | 'profilo' | 'consensi' | 'firma'

export const SECTIONS: readonly SectionId[] = ['chi_sei', 'corso', 'dati', 'profilo', 'consensi', 'firma']

/** Listino del corso, in euro (da Storyblok). */
export interface PriceList {
  /** Soluzione unica a prezzo pieno */
  unica: number
  /** Importo di ciascuna delle 5 rate a prezzo pieno */
  rata5: number
  /** Importo di ciascuna delle 10 rate a prezzo pieno */
  rata10: number
  /** Prezzo totale con l'offerta open day, uguale per tutte le modalità */
  offerta: number
  /** Contributo d'esame, IVA inclusa, a parte */
  esame: number
}

export interface Quote {
  modalita: PaymentMode
  rate: number
  /** Importo di ciascuna rata (la prima può avere qualche centesimo in più) */
  rata: number
  prima_rata: number
  totale: number
  /** Totale a prezzo pieno, da mostrare barrato quando c'è l'offerta */
  totale_pieno: number
  offerta: boolean
}

export interface Enrollment {
  id: string
  email: string
  corso: string
  canale: 'sito' | 'sede'
  stato: EnrollmentStatus
  sezioni_complete: SectionId[]
  nome: string | null
  cognome: string | null
  telefono: string | null
  edizione_chiave: string | null
  pagamento_modalita: PaymentMode | null
  pagamento_rata: string | null
  pagamento_totale: string | null
  offerta_open_day: boolean
  dati: Record<string, unknown>
  profilo: Record<string, unknown>
  consensi: Record<string, unknown>
  documenti: Record<string, unknown>
  firmata_il: string | null
  fine_recesso: string | null
  creata_il: string
  aggiornata_il: string
}
