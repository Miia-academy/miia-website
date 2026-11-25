import type { ReactNode } from 'react'

/**
 * "Nascondi da mobile" di ogni blocco: sotto i 480px (come "Nascondi mobile" del Testo)
 * il blocco non si vede. Il contenitore usa display: contents, quindi su tablet e desktop
 * il blocco resta un elemento diretto della griglia o del Contenitore (colonne invariate).
 */
export function HideMobile({ blok, children }: { blok: { hide_mobile?: unknown }; children: ReactNode }) {
  if (!blok?.hide_mobile) return <>{children}</>
  return <div className="contents max-sm:hidden">{children}</div>
}
