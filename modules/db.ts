import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL mancante')
}

// Esportiamo la funzione sql per usarla ovunque nel progetto
export const sql = neon(process.env.DATABASE_URL)