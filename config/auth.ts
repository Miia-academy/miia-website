// Durata complessiva della sessione (30 giorni)
export const AUTH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // in secondi per il cookie Max-Age
export const AUTH_JWT_EXPIRES_IN = '30d'             // in formato stringa per jsonwebtoken

// Soglia per il rinnovo automatico (es. se mancano meno di 10 giorni alla scadenza, rinnova)
export const AUTH_REFRESH_THRESHOLD = 10 * 24 * 60 * 60

// Durata temporanea del Magic Link inviato via email (es. per login.ts)
export const MAGIC_LINK_EXPIRES_IN = '15m'