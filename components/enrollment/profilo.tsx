import { useState, type FormEvent } from 'react'
import { Button, Checkbox, CheckboxGroup, Input, Select, SelectItem, cn } from '@heroui/react'
import type { EnrollmentState } from '@modules/enrollment/state'
import { COMPUTER_LABELS, ORE_LABELS, SOURCE_LABELS, TITOLO_LABELS } from '@modules/enrollment/profile'

const inputClasses = { inputWrapper: 'bg-[#F3F3F2]' }
const selectClasses = { trigger: 'bg-[#F3F3F2]' }

const pillCheckbox = {
  base: cn(
    'inline-flex m-0 max-w-none rounded-full border-2 border-neutral-200 bg-[#F3F3F2] px-4 py-2',
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
    anno_studi: str(p.anno_studi),
    ultima_formazione: str(p.ultima_formazione),
    anno_formazione: str(p.anno_formazione),
    occupazione: str(p.occupazione),
    ruolo: str(p.ruolo),
    ore_settimana: str(p.ore_settimana),
    computer: str(p.computer),
  })
  const [noWork, setNoWork] = useState(p.non_lavoro === true)
  const [sources, setSources] = useState<string[]>(Array.isArray(p.come_ci_hai_conosciuto) ? (p.come_ci_hai_conosciuto as string[]) : [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState<'save' | 'skip' | null>(null)

  const set = (key: string) => (v: string) => setValues((s) => ({ ...s, [key]: v }))
  const text = (key: string, label: string, extra: Record<string, unknown> = {}) => (
    <Input
      name={key}
      label={label}
      value={values[key]}
      onValueChange={set(key)}
      isInvalid={!!errors[key]}
      errorMessage={errors[key]}
      classNames={inputClasses}
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
      classNames={selectClasses}
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
          valori: skip ? { saltato: true } : { ...values, non_lavoro: noWork, come_ci_hai_conosciuto: sources },
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
        {year('anno_studi', 'Concluso nell’anno')}
        {text('ultima_formazione', 'Ultima formazione')}
        {year('anno_formazione', 'Conclusa nell’anno')}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 font-semibold">Lavoro</legend>
        <Checkbox isSelected={noWork} onValueChange={setNoWork} size="sm">
          Non lavoro ancora
        </Checkbox>
        {!noWork && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {text('occupazione', 'Ultima occupazione')}
            {text('ruolo', 'Ruolo')}
          </div>
        )}
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
          <Button type="submit" color="primary" className="h-12 font-bold px-8" isLoading={loading === 'save'} isDisabled={!!loading}>
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
