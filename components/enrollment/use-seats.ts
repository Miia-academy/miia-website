import { useEffect, useState } from 'react'
import { editionAvailability, editionKey } from '@modules/enrollment/editions'

/**
 * Posti rimasti delle edizioni mostrate in pagina: "posti" di Storyblok meno le
 * iscrizioni firmate in Neon, chiesti al server a ogni visita.
 * Finché la risposta non arriva (o se l'iscrizione online è spenta) resta il valore di Storyblok.
 */
export function useSignedCounts(keys: Array<string | null>): Record<string, number> | null {
  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const query = Array.from(new Set(keys.filter((k): k is string => !!k))).sort().join(',')

  useEffect(() => {
    if (!query) return
    let active = true
    fetch(`/api/iscrizione/posti?chiavi=${encodeURIComponent(query)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => active && data?.iscritti && setCounts(data.iscritti))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [query])

  return counts
}

/** Testo da mostrare per i posti di un'edizione. */
export function seatsLabel(
  seats: unknown,
  key: string | null,
  counts: Record<string, number> | null
): string | null {
  if (seats === undefined || seats === null || seats === '') return null
  if (!key || !counts || !(key in counts)) return String(seats)
  const capacity = Number(String(seats).trim())
  if (!Number.isFinite(capacity)) return String(seats)
  const { stato, posti_liberi } = editionAvailability(capacity, counts[key])
  return stato === 'completa' ? 'completo' : String(posti_liberi)
}

export { editionKey }
