export type AreaAttribute = 'interni' | 'moda'
export const interesse_area = ['interni', 'moda']

export type SedeAttribute = 'padova' | 'treviso' | 'bassano'
export const interesse_sede = ['padova', 'treviso', 'bassano']

export type FrequenzaAttribute = 'serale' | 'sabato'
export const interesse_frequenza = ['serale', 'sabato']

export type InizioAttribute = 'marzo' | 'ottobre'
export const interesse_inizio = ['marzo', 'ottobre']

export type FatturaAttribute = ['privato', 'azienda']
export const pagamento_fattura = ['privato', 'azienda']

export type InterventoAttribute = ['arredare', 'rinnovare', 'ristrutturare']
export const progetto_intervento = ['arredare', 'rinnovare', 'ristrutturare']

export type RichiestaAttribute = 'studenti' | 'commerciale' | 'formazione'
export const collaborazione_richiesta = [
  'studenti',
  'commerciale',
  'formazione',
]

export type BaseAttribute = {
  type: 'text' | 'date' | 'float' | 'boolean' | 'id' | 'user'
}

export type CategoryAttribute = {
  type: 'category'
  enumeration: Array<{ value: number; label: string }>
}

export type MultipleChoiceAttribute = {
  type: 'multiple-choice'
  multiCategoryOptions: Array<string>
}

export type AttributesTypes =
  | BaseAttribute
  | CategoryAttribute
  | MultipleChoiceAttribute

type Attributes = {
  [key: string]: AttributesTypes
}

export const attributes: Attributes = {
  // Azioni dell'utente
  conferma_contatto: {
    type: 'boolean',
  },
  download_materiale: {
    type: 'date',
  },
  partecipazione_openday: {
    type: 'date',
  },
  invio_iscrizione: {
    type: 'date',
  },
  iscrizione_newsletter: {
    type: 'boolean',
  },

  // Informazioni di interesse
  interesse_corso: {
    type: 'category',
    enumeration: [
      { value: 1, label: 'interni - primo livello' },
      { value: 2, label: 'interni - secondo livello' },
      { value: 3, label: 'moda - primo livello' },
      { value: 4, label: 'moda - secondo livello' },
    ],
  },
  interesse_area: {
    type: 'category',
    enumeration: [
      { value: 1, label: 'interni' },
      { value: 2, label: 'moda' },
    ],
  },
  interesse_sede: {
    type: 'multiple-choice',
    multiCategoryOptions: ['treviso', 'bassano', 'padova'],
  },
  interesse_frequenza: {
    type: 'multiple-choice',
    multiCategoryOptions: ['serale', 'sabato'],
  },
  interesse_inizio: {
    type: 'multiple-choice',
    multiCategoryOptions: ['marzo', 'ottobre'],
  },
  // interesse_scopo: {
  //   type: 'category',
  //   enumeration: [
  //     { value: 1, label: 'lavoro' },
  //     { value: 2, label: 'ruolo' },
  //     { value: 3, label: 'piacere' },
  //   ],
  // },
  interesse_openday: {
    type: 'date',
  },
  interesse_collaborazione: {
    type: 'category',
    enumeration: [
      { value: 1, label: 'personale' },
      { value: 2, label: 'progetti' },
      { value: 3, label: 'collaborazione' },
    ],
  },

  // Preferenze iscrizione
  iscrizione_corso: {
    type: 'text',
  },
  // iscrizione_fattura: {
  //   type: 'category',
  //   enumeration: [
  //     { value: 1, label: 'privato' },
  //     { value: 2, label: 'azienda' },
  //   ],
  // },
  // iscrizione_dilazione: {
  //   type: 'category',
  //   enumeration: [
  //     { value: 1, label: 'unica' },
  //     { value: 2, label: 'minime' },
  //     { value: 3, label: 'massime' },
  //   ],
  // },

  ///////////////////////////////////////
  // Informazioni di profilo
  // profilo_formazione: {
  //   type: 'text',
  // },
  // profilo_lavoro: {
  //   type: 'text',
  // },
  // profilo_presentazione: {
  //   type: 'text',
  // },

  ///////////////////////////////////////
  // Dati persona
  // persona_codice: {
  //   type: 'text',
  // },
  // persona_nascita: {
  //   type: 'date',
  // },
  // persona_luogo: {
  //   type: 'text',
  // },
  // persona_sesso: {
  //   type: 'category',
  //   enumeration: [
  //     { value: 1, label: 'maschio' },
  //     { value: 2, label: 'femmina' },
  //     { value: 3, label: 'altro' },
  //   ],
  // },
  // persona_indirizzo: {
  //   type: 'text',
  // },
  // persona_citta: {
  //   type: 'text',
  // },
  // persona_provincia: {
  //   type: 'text',
  // },

  ///////////////////////////////////////
  // Dati aziendali
  // azienda_nome: {
  //   type: 'text',
  // },
  // azienda_iva: {
  //   type: 'float',
  // },
  // azienda_indirizzo: {
  //   type: 'text',
  // },
  // azienda_citta: {
  //   type: 'text',
  // },
  // azienda_provincia: {
  //   type: 'text',
  // },

  ///////////////////////////////////////
  // Indicazioni progetto
  // progetto_intervento: {
  //   type: 'category',
  //   enumeration: [
  //     { value: 1, label: 'arredare' },
  //     { value: 2, label: 'rinnovare' },
  //     { value: 3, label: 'ristrutturare' },
  //   ],
  // },
  // progetto_immobile: {
  //   type: 'text',
  // },
  // progetto_budget: {
  //   type: 'float',
  // },
  // progetto_dimensione: {
  //   type: 'float',
  // },
}
