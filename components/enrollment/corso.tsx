import { useEffect, useState, type FormEvent } from 'react'
import { Button, Radio, RadioGroup, Spinner, cn } from '@heroui/react'
import type { EnrollmentState } from '@modules/enrollment/state'
import type { CourseOffer, EditionOption } from '@modules/enrollment/offer'
import type { PaymentMode } from '@modules/enrollment/types'
import { getLongDate, getShortDate } from '@modules/formats'

export { SCOPO_LABELS, MODE_LABELS, euro } from '@modules/enrollment/labels'
import { SCOPO_LABELS, MODE_LABELS, euro } from '@modules/enrollment/labels'

export function editionLine(e: Pick<EditionOption, 'sede' | 'giorni' | 'orari'>) {
  return [e.sede, e.giorni.join(' e '), e.orari.join(', ')].filter(Boolean).join(' · ')
}

/** Scheda selezionabile per RadioGroup (stile del design: bordo verde quando scelta). */
const cardRadio = {
  base: cn(
    'inline-flex m-0 max-w-full w-full items-start rounded-xl border-2 border-neutral-200 bg-white p-4',
    'data-[selected=true]:border-primary data-[disabled=true]:opacity-50 cursor-pointer'
  ),
  wrapper: 'mt-0.5',
  labelWrapper: 'ms-3 w-full',
}

const pillRadio = {
  base: cn(
    'inline-flex m-0 rounded-full border-2 border-neutral-200 bg-[#F3F3F2] px-4 py-2',
    'data-[selected=true]:border-primary data-[selected=true]:bg-white cursor-pointer'
  ),
  wrapper: 'hidden',
  labelWrapper: 'ms-0',
  label: 'text-sm',
}

export interface CourseChoice {
  edizione: string
  modalita: string
}

interface CorsoProps {
  corso: string
  state: EnrollmentState
  /** Offerta letta dalla pagina (edizioni, posti, importi), o null mentre carica. */
  offer: CourseOffer | null
  loadError?: string
  onSaved: (state: EnrollmentState) => void
  /** Aggiorna subito il riepilogo laterale, prima di "Continua". */
  onChange?: (choice: CourseChoice) => void
  /** Edizione arrivata dal pulsante "Iscriviti online" del sito (?edizione=...), scelta in partenza se è aperta. */
  preselect?: string
}

/** Passo 2: edizione, scopo del corso e modalità di pagamento. */
export function Corso({ corso, state, offer, loadError, onSaved, onChange, preselect }: CorsoProps) {
  const [edizione, setEdizione] = useState(state.corso_pagamento.edizione || '')
  const [scopo, setScopo] = useState(state.corso_pagamento.scopo || '')
  const [modalita, setModalita] = useState<string>(state.corso_pagamento.modalita || '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (edizione || !preselect || !offer) return
    if (offer.edizioni.some((e) => e.chiave === preselect && e.stato !== 'completa')) setEdizione(preselect)
  }, [edizione, preselect, offer])

  useEffect(() => {
    onChange?.({ edizione, modalita })
  }, [edizione, modalita, onChange])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await fetch('/api/iscrizione/bozza', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso, sezione: 'corso', valori: { edizione, scopo, modalita } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.message || 'Completa le scelte del passo')
        setErrors(data.errori || {})
        return
      }
      onSaved(data.iscrizione as EnrollmentState)
    } catch {
      setMessage('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (loadError) return <p className="text-sm text-secondary">{loadError}</p>
  if (!offer) return <Spinner color="primary" size="sm" />
  if (!offer.edizioni.length) {
    return (
      <p className="text-sm text-neutral-600">
        Al momento non ci sono edizioni in partenza per questo corso. Scrivici a iscrizione@miia.it e ti avvisiamo appena apre la prossima.
      </p>
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8" noValidate>
      <RadioGroup
        label="Scegli l'edizione"
        value={edizione}
        onValueChange={setEdizione}
        isInvalid={!!errors.edizione}
        errorMessage={errors.edizione}
        classNames={{ label: 'font-semibold text-neutral-900', wrapper: 'grid grid-cols-1 sm:grid-cols-2 gap-3' }}
      >
        {offer.edizioni.map((e) => (
          <Radio key={e.chiave} value={e.chiave} isDisabled={e.stato === 'completa'} classNames={cardRadio}>
            <span className="flex flex-col gap-0.5 text-sm">
              <span className="font-bold text-base text-neutral-900">{e.titolo || e.sede}</span>
              <span className="text-neutral-600">{editionLine(e)}</span>
              <span className="text-neutral-600">
                Dal {getLongDate(e.inizio)}
                {e.fine ? ` al ${getShortDate(e.fine)}` : ''}
              </span>
              {e.stato === 'completa' && <span className="font-semibold text-neutral-500">Completa</span>}
              {e.stato === 'ultimi_posti' && (
                <span className="font-semibold text-secondary">
                  {e.posti_liberi === 1 ? 'Ultimo posto' : `Ultimi ${e.posti_liberi} posti`}
                </span>
              )}
            </span>
          </Radio>
        ))}
      </RadioGroup>

      <RadioGroup
        label="Cosa ti aspetti dal corso?"
        value={scopo}
        onValueChange={setScopo}
        isInvalid={!!errors.scopo}
        errorMessage={errors.scopo}
        orientation="horizontal"
        classNames={{ label: 'font-semibold text-neutral-900', wrapper: 'gap-2' }}
      >
        {Object.entries(SCOPO_LABELS).map(([value, label]) => (
          <Radio key={value} value={value} classNames={pillRadio}>
            {label}
          </Radio>
        ))}
      </RadioGroup>

      {offer.prezzi ? (
        <RadioGroup
          label="Come preferisci pagare?"
          value={modalita}
          onValueChange={setModalita}
          isInvalid={!!errors.modalita}
          errorMessage={errors.modalita}
          description={offer.quota_esame ? `Contributo d'esame di ${euro(offer.quota_esame)} IVA inclusa, a parte.` : undefined}
          classNames={{ label: 'font-semibold text-neutral-900', wrapper: 'grid grid-cols-1 sm:grid-cols-3 gap-3' }}
        >
          {(Object.keys(MODE_LABELS) as PaymentMode[]).map((mode) => {
            const q = offer.prezzi![mode]
            return (
              <Radio key={mode} value={mode} classNames={cardRadio}>
                <span className="flex flex-col gap-0.5 text-sm">
                  <span className="font-bold text-base text-neutral-900">{MODE_LABELS[mode]}</span>
                  <span className="text-lg font-bold text-neutral-900">
                    {q.rate > 1 ? `${q.rate} × ${euro(q.rata)}` : euro(q.totale)}
                  </span>
                  <span className="text-neutral-600">
                    Totale {euro(q.totale)}
                    {q.offerta && q.totale_pieno > q.totale && (
                      <span className="ms-1 line-through text-neutral-400">{euro(q.totale_pieno)}</span>
                    )}
                  </span>
                </span>
              </Radio>
            )
          })}
        </RadioGroup>
      ) : (
        <p className="text-sm text-secondary">I prezzi non sono disponibili in questo momento, riprova più tardi.</p>
      )}

      {offer.offerta && offer.scadenza_offerta && (
        <p className="text-sm font-semibold text-secondary">Prezzo open day fino al {getLongDate(offer.scadenza_offerta)}</p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" color="primary" className="h-12 font-bold self-start px-8" isLoading={loading} isDisabled={!offer.prezzi}>
          Continua
        </Button>
        {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
      </div>
    </form>
  )
}
