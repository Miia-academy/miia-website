import { useState, type FormEvent } from 'react'
import { Checkbox, CheckboxGroup, Input, Select, SelectItem, cn } from '@heroui/react'
import { Button } from '@components/ui/button'
import type { EnrollmentState } from '@modules/enrollment/state'
import {
  AREA_LABELS,
  COMPUTER_LABELS,
  ORE_LABELS,
  SETTORE_LABELS,
  SITUAZIONE_LABELS,
  SOURCE_LABELS,
  TITOLO_LABELS,
} from '@modules/enrollment/profile'
import { SENZA_LAVORO } from '@modules/enrollment/validation'
import { surfaceInput, surfaceSelect } from '@components/ui/fields'


const pillCheckbox = {
  base: cn(
    'inline-flex m-0 max-w-none rounded-full border-2 border-neutral-200 bg-surface px-4 py-2',
    'data-[selected=true]:border-primary data-[selected=true]:bg-white cursor-pointer'
  ),
  wrapper: 'hidden',
  label: 'text-sm ms-0',
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')

interface ProfiloProps {
  corso: string
  state: EnrollmentState
  onSaved: (state: EnrollmentState) => void
}

/** Passo 4, tutto facoltativo: "Continua" o "Salta questo passo". */
export function Profilo({ corso, state, onSaved }: ProfiloProps) {
  const p = state.profilo || {}
  const [values, setValues] = useState<Record<string, string>>({
    titolo_studi: str(p.titolo_studi),
    area_studi: str(p.area_studi),
    istituto: str(p.istituto),
    anno_studi: str(p.anno_studi),
    ultima_formazione: str(p.ultima_formazione),
    anno_formazione: str(p.anno_formazione),
    situazione_lavoro: str(p.situazione_lavoro),
    settore: str(p.settore),
    azienda: str(p.azienda),
    ruolo: str(p.ruolo),
    ore_settimana: str(p.ore_settimana),
    computer: str(p.computer),
  })
  const [sources, setSources] = useState<string[]>(Array.isArray(p.come_ci_hai_conosciuto) ? (p.come_ci_hai_conosciuto as string[]) : [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState<'save' | 'skip' | null>(null)

  const working = !SENZA_LAVORO.includes(values.situazione_lavoro)
  const set = (key: string) => (v: string) => setValues((s) => ({ ...s, [key]: v }))
  const text = (key: string, label: string, extra: Record<string, unknown> = {}) => (
    <Input
      name={key}
      label={label}
      value={values[key]}
      onValueChange={set(key)}
      isInvalid={!!errors[key]}
      errorMessage={errors[key]}
      classNames={surfaceInput}
      {...extra}
    />
  )
  const year = (key: string, label: string) => text(key, label, { inputMode: 'numeric', maxLength: 4, placeholder: ' ' })
  const select = (key: string, label: string, options: Record<string, string>) => (
    <Select
      name={key}
      label={label}
      placeholder="Scegli"
      selectedKeys={values[key] ? [values[key]] : []}
      onSelectionChange={(keys) => set(key)(String(Array.from(keys)[0] ?? ''))}
      isInvalid={!!errors[key]}
      errorMessage={errors[key]}
      classNames={surfaceSelect}
    >
      {Object.entries(options).map(([value, label]) => (
        <SelectItem key={value}>{label}</SelectItem>
      ))}
    </Select>
  )

  const send = async (skip: boolean) => {
    setLoading(skip ? 'skip' : 'save')
    setMessage('')
    setErrors({})
    try {
      const res = await fetch('/api/iscrizione/bozza', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corso,
          sezione: 'profilo',
          valori: skip ? { saltato: true } : { ...values, come_ci_hai_conosciuto: sources },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.message || 'Controlla i campi segnati')
        setErrors(data.errori || {})
        return
      }
      onSaved(data.iscrizione as EnrollmentState)
    } catch {
      setMessage('Errore di connessione. Riprova.')
    } finally {
      setLoading(null)
    }
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    send(false)
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-8" noValidate>
      <p className="text-neutral-600">Ci aiuta a preparare il corso sulle persone che lo frequentano. Non cambia nulla nell’iscrizione.</p>

      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <legend className="mb-3 font-semibold">Studi</legend>
        {select('titolo_studi', 'Titolo di studi', TITOLO_LABELS)}
        {select('area_studi', 'Area', AREA_LABELS)}
        {text('istituto', 'Scuola o università')}
        {year('anno_studi', 'Concluso nell’anno')}
        {text('ultima_formazione', 'Ultimo corso o formazione')}
        {year('anno_formazione', 'Concluso nell’anno')}
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <legend className="mb-3 font-semibold">Lavoro</legend>
        {select('situazione_lavoro', 'Oggi', SITUAZIONE_LABELS)}
        {working && select('settore', 'Settore', SETTORE_LABELS)}
        {working && text('azienda', 'Azienda')}
        {working && text('ruolo', 'Ruolo')}
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <legend className="mb-3 font-semibold">Tempo e strumenti</legend>
        {select('ore_settimana', 'Ore a settimana per esercitarti', ORE_LABELS)}
        {select('computer', 'Familiarità con il computer', COMPUTER_LABELS)}
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-semibold">Come ci hai conosciuto?</legend>
        <CheckboxGroup aria-label="Come ci hai conosciuto" value={sources} onValueChange={setSources} orientation="horizontal" classNames={{ wrapper: 'gap-2' }}>
          {Object.entries(SOURCE_LABELS).map(([value, label]) => (
            <Checkbox key={value} value={value} classNames={pillCheckbox}>
              {label}
            </Checkbox>
          ))}
        </CheckboxGroup>
      </fieldset>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <Button size="lg" type="submit" color="primary" isLoading={loading === 'save'} isDisabled={!!loading}>
            Continua
          </Button>
          <Button variant="light" className="underline text-neutral-600" isLoading={loading === 'skip'} isDisabled={!!loading} onPress={() => send(true)}>
            Salta questo passo
          </Button>
        </div>
        {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
      </div>
    </form>
  )
}
