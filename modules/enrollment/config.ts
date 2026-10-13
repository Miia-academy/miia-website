/**
 * Interruttore dell'iscrizione online: finché ENROLLMENT_ONLINE non è "on"
 * la pagina e le API dell'iscrizione non rispondono, così develop si può
 * rilasciare in main anche con il lavoro a metà.
 */
export function isEnrollmentEnabled(): boolean {
  return process.env.ENROLLMENT_ONLINE === 'on'
}
