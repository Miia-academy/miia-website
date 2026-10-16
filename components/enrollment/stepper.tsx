import type { ReactNode } from 'react'
import { Button } from '@heroui/react'
import type { SectionId } from '@modules/enrollment/types'

export const SECTION_TITLES: Record<SectionId, string> = {
  chi_sei: 'Chi sei',
  corso: 'Corso e pagamento',
  dati: 'Dati e documenti',
  profilo: 'Il tuo profilo',
  consensi: 'Consensi',
  firma: 'Riepilogo e firma',
}

export type SectionState = 'open' | 'done' | 'locked'

export interface StepItem {
  id: SectionId
  state: SectionState
  /** Contenuto della sezione aperta. */
  content?: ReactNode
  /** Riepilogo delle scelte fatte, per la sezione completata. */
  summary?: ReactNode
  /** Mostra "Si apre dopo il passo precedente" (solo il primo passo chiuso). */
  hint?: boolean
}

/**
 * Stepper verticale dell'iscrizione: pallini collegati da una linea verde fino
 * all'ultimo passo completato, una sezione aperta alla volta, nessun riquadro.
 */
export function EnrollmentStepper({ items, onEdit }: { items: StepItem[]; onEdit: (id: SectionId) => void }) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const last = index === items.length - 1
        const lineGreen = item.state === 'done' && items[index + 1]?.state !== 'locked'
        return (
          <li key={item.id} id={`passo-${item.id}`} className="relative flex gap-4 scroll-mt-24">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[9px] sm:left-[12px] top-6 sm:top-7 bottom-0 w-0.5 ${lineGreen ? 'bg-primary' : 'bg-neutral-200'}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 mt-0.5 flex h-5 w-5 sm:h-[26px] sm:w-[26px] shrink-0 items-center justify-center rounded-full text-[11px] sm:text-xs font-bold ${
                item.state === 'locked'
                  ? 'bg-neutral-100 text-neutral-400 border border-neutral-200'
                  : 'bg-primary text-white'
              }`}
            >
              {item.state === 'done' ? <i className="iconoir-check" /> : index + 1}
            </span>
            <div className={`flex-1 pb-8 ${last ? '' : 'border-b border-neutral-200 mb-6'}`}>
              <div className="flex items-baseline justify-between gap-4">
                <h2 className={`text-lg sm:text-xl font-bold ${item.state === 'locked' ? 'text-neutral-400' : 'text-neutral-900'}`}>
                  {SECTION_TITLES[item.id]}
                </h2>
                {item.state === 'done' && (
                  <Button size="sm" variant="light" color="primary" className="font-semibold" onPress={() => onEdit(item.id)}>
                    Modifica
                  </Button>
                )}
              </div>
              {item.state === 'locked' && item.hint && (
                <p className="mt-1 text-sm text-neutral-500">Si apre dopo il passo precedente</p>
              )}
              {item.state === 'done' && item.summary && <div className="mt-3">{item.summary}</div>}
              {item.state === 'open' && <div className="mt-4">{item.content}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Riepilogo a due colonne di una sezione completata. */
export function Summary({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-neutral-500">{label}</dt>
          <dd className="font-medium text-neutral-900 break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
