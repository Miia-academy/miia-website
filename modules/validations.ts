interface Validation {
  id: string
  value: string
  required: boolean
}

export function fieldValidation({ id, value, required }: Validation) {
  if (Array.isArray(value) ? value.length === 0 : !value && required)
    return 'Il campo è obbligatorio'
  const validation = validations[id]
  if (value && validation) return validation(value)

  return null
}

type Validations = {
  [key: string]: (value: string) => string | null
}

export const validations: Validations = {
  nome: (value: string) => {
    if (!min_length(value, 3))
      return 'Il nome deve essere di almeno 3 caratteri'
    if (has_number(value)) return 'Il nome non può includere numeri'
    return null
  },
  cognome: (value: string) => {
    if (!min_length(value, 2))
      return 'Il cognome deve essere di almeno 2 caratteri'
    if (has_number(value)) return 'Il cognome non può includere numeri'
    return null
  },
  nome_completo: (value: string) => {
    if (!min_words(value, 1))
      return 'Nome e cognome devono essere staccati da uno spazio'
    if (has_number(value)) return 'Nome e cognome non possono includere numeri'
    return null
  },
  data_nascita: (value: string) => {
    const age = new Date().getFullYear() - new Date(value).getFullYear()
    if (age < 18) return 'Le iscrizioni sono aperte solo a studenti maggiorenni'
    return null
  },
  email: (value: string) => {
    if (!email_format(value))
      return "Il formato dell'indirizzo email non è valido"
    return null
  },
  azienda_email: (value: string) => {
    if (!email_format(value))
      return "Il formato dell'indirizzo email non è valido"
    return null
  },
  azienda_pec: (value: string) => {
    if (!email_format(value))
      return "Il formato dell'indirizzo pec non è valido"
    return null
  },
  sms: (value: string) => {
    if (!phone_format(value))
      return 'Il formato del numero di telefono non è valido'
    return null
  },
  carta_identita: (value: string) => {
    value = value.replace(/\s/g, '').toUpperCase()
    if (!equal_length(value, 9))
      return `Il numero della carta d'identità deve essere di 9 caratteri, risultano ${value.length}`
    const europeanFormat = european_identity_format(value)
    const italianFormat = italian_identity_format(value)
    if (![europeanFormat, italianFormat].some((res) => res === true))
      return "Il formato del numero della carta d'identità non è valido"
    return null
  },
  codice_fiscale: (value: string) => {
    value = value.replace(/\s/g, '').toUpperCase()
    if (!equal_length(value, 16))
      return `Il codice fiscale deve essere di 16 caratteri, risultano ${value.length}`
    if (!fiscal_format(value))
      return 'Il formato del codice fiscale non è valido'
    return null
  },
}

const min_length = (value: string, num: number) => value.length > num
const equal_length = (value: string, num: number) => value.length === num
const min_words = (value: string, num: number) => value.split(' ').length > num
const has_number = (value: string) => /[0-9]/.test(value)
const email_format = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.toLowerCase())
const phone_format = (value: string) =>
  /^(\+\d{1,3}(\s?[\(\)-]?)?)?\d{10}$/.test(value)
const european_identity_format = (value: string) =>
  /^[A-Z]{2}[0-9]{5}[A-Z]{2}/.test(value)
const italian_identity_format = (value: string) =>
  /^[A-Z]{2}[0-9]{7}/.test(value)
const fiscal_format = (value: string) =>
  /^[A-Z]{6}[0-9]{2}[A-E,H,L,M,P,R-T][0-9]{2}[A-Z0-9]{5}/.test(value)
