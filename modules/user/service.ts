import { upsertContact } from '@modules/brevo'

const BREVO_LIST_STUDENTI = Number(process.env.BREVO_STUDENT_LIST_ID) || 42
const BREVO_LIST_AZIENDE = Number(process.env.BREVO_BUSINESS_LIST_ID) || 43

export interface StudentBrevoAttributes {
  NOME: string
  COGNOME: string
  SMS: string
  TIPO_UTENTE: 'Studente'
  INDIRIZZO: string
  PROVINCIA: string
  RICERCA_ATTIVA: boolean
  AUTOMUNITO: boolean
  TRASFERTE: boolean
  COMPETENZE: string
  CV_URL: string
  PORTFOLIO_URL: string
}

export interface BusinessBrevoAttributes {
  AZIENDA?: string
  NOME_AZIENDA?: string
  REFERENTE: string
  SMS: string
  TELEFONO: string
  INDIRIZZO: string
  SITO_WEB: string
  DESCRIZIONE: string
  LOGO_URL: string
  TIPO_UTENTE: 'Azienda'
}

export class UserService {
  static async syncStudentToCrm(email: string, attributes: Omit<StudentBrevoAttributes, 'TIPO_UTENTE'>) {
    return upsertContact({
      email: email.trim().toLowerCase(),
      attributes: { ...attributes, TIPO_UTENTE: 'Studente' },
      listIds: [BREVO_LIST_STUDENTI],
    })
  }

  static async syncBusinessToCrm(email: string, attributes: Omit<BusinessBrevoAttributes, 'TIPO_UTENTE'>) {
    return upsertContact({
      email: email.trim().toLowerCase(),
      attributes: { ...attributes, TIPO_UTENTE: 'Azienda' },
      listIds: [BREVO_LIST_AZIENDE],
    })
  }
}