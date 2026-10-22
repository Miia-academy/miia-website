import { useRef, useState, type FormEvent } from 'react'
import { Button, Checkbox, Input, Radio, RadioGroup, Switch, cn } from '@heroui/react'
import type { EnrollmentState } from '@modules/enrollment/state'
import { SLOT_LABELS, requiredSlots, type DocumentSlot } from '@modules/enrollment/documents'
import { uploadDocument } from './document-upload'
import { DocumentNumber } from './documento'
import { documentFormat, partialPattern } from '@modules/enrollment/document-number'

export { DOCUMENT_LABELS } from '@modules/enrollment/labels'
import { DOCUMENT_LABELS } from '@modules/enrollment/labels'

const inputClasses = { label: 'after:text-secondary', inputWrapper: 'bg-surface' }

const pillRadio = {
  base: cn(
    'inline-flex m-0 rounded-full border-2 border-neutral-200 bg-surface px-4 py-2',
    'data-[selected=true]:border-primary data-[selected=true]:bg-white cursor-pointer'
  ),
  wrapper: 'hidden',
  labelWrapper: 'ms-0',
  label: 'text-sm',
}

type Values = Record<string, string>
type Company = Record<string, string>

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** Una foto: "Scatta foto" (fotocamera posteriore da telefono) o "Scegli file", poi anteprima e "Sostituisci". */
function PhotoSlot({ corso, slot, uploaded, onUploaded }: { corso: string; slot: DocumentSlot; uploaded: boolean; onUploaded: (slot: DocumentSlot) => void }) {
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError('')
    const result = await uploadDocument(corso, slot, file)
    setBusy(false)
    if (!result.ok) return setError(result.message)
    setPreview(file.type.startsWith('image/') && !/hei[cf]/.test(file.type) ? URL.createObjectURL(file) : null)
    onUploaded(slot)
  }

  const done = uploaded || !!preview
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border-2 p-3', done ? 'border-primary' : 'border-dashed border-neutral-300')}>
      <span className="text-sm font-semibold">{SLOT_LABELS[slot]}</span>
      {preview && <img src={preview} alt={SLOT_LABELS[slot]} className="h-24 w-full rounded-lg object-cover" />}
      {done && !preview && <span className="text-sm text-primary font-medium">Caricato</span>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="flat" isLoading={busy} onPress={() => camera.current?.click()} className="sm:hidden">
          {done ? 'Sostituisci' : 'Scatta foto'}
        </Button>
        <Button size="sm" variant="flat" isLoading={busy} onPress={() => picker.current?.click()}>
          {done ? 'Sostituisci' : 'Scegli file'}
        </Button>
      </div>
      {error && <p className="text-xs text-secondary">{error}</p>}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={picker} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}

interface DatiProps {
  corso: string
  state: EnrollmentState
  onSaved: (state: EnrollmentState) => void
}

/** Passo 3: dati per il contratto, documento e foto, fatturazione come azienda. */
export function Dati({ corso, state, onSaved }: DatiProps) {
  const d = state.dati || {}
  const [values, setValues] = useState<Values>({
    data_nascita: str(d.data_nascita),
    luogo_nascita: str(d.luogo_nascita),
    codice_fiscale: str(d.codice_fiscale),
    via: str(d.via),
    comune: str(d.comune),
    provincia: str(d.provincia),
    cap: str(d.cap),
    documento_tipo: str(d.documento_tipo),
    documento_numero: str(d.documento_numero),
    documento_paese: str(d.documento_paese),
  })
  const [estero, setEstero] = useState(d.documento_estero === true)
  const savedCompany = (d.azienda && typeof d.azienda === 'object' ? d.azienda : null) as Company | null
  const [isCompany, setIsCompany] = useState(!!savedCompany)
  const [company, setCompany] = useState<Company>(savedCompany || {})
  const [later, setLater] = useState(d.documenti === 'dopo')
  const [uploaded, setUploaded] = useState<string[]>(state.foto_caricate || [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (key: string) => (v: string) => setValues((s) => ({ ...s, [key]: v }))
  const setC = (key: string) => (v: string) => setCompany((s) => ({ ...s, [key]: v }))
  const field = (key: string, label: string, extra: Record<string, unknown> = {}) => (
    <Input
      name={key}
      label={label}
      isRequired
      value={values[key]}
      onValueChange={set(key)}
      isInvalid={!!errors[key]}
      errorMessage={errors[key]}
      classNames={inputClasses}
      {...extra}
    />
  )
  const companyField = (key: string, label: string, required = true) => (
    <Input
      name={`azienda.${key}`}
      label={label}
      isRequired={required}
      value={company[key] || ''}
      onValueChange={setC(key)}
      isInvalid={!!errors[`azienda.${key}`]}
      errorMessage={errors[`azienda.${key}`]}
      classNames={inputClasses}
    />
  )

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await fetch('/api/iscrizione/bozza', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corso,
          sezione: 'dati',
          valori: { ...values, documento_estero: estero, documenti_dopo: later, fatturazione_azienda: isCompany, azienda: isCompany ? company : null },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.message || 'Completa i campi con l’asterisco')
        setErrors(data.errori || {})
        const first = Object.keys(data.errori || {})[0]
        if (first) document.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
        return
      }
      onSaved(data.iscrizione as EnrollmentState)
    } catch {
      setMessage('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  // Cambiando tipo o paese si tiene il numero solo se va bene anche per il nuovo formato.
  const keepNumber = (tipo: string, foreign: boolean) => {
    const format = documentFormat(tipo, foreign)
    if (format && !new RegExp(partialPattern(format)).test(values.documento_numero)) set('documento_numero')('')
  }
  const chooseType = (tipo: string) => {
    set('documento_tipo')(tipo)
    keepNumber(tipo, estero)
  }
  const chooseForeign = (value: boolean) => {
    setEstero(value)
    keepNumber(values.documento_tipo, value)
  }

  const slots = requiredSlots(values.documento_tipo || 'carta_identita_elettronica')

  return (
    <form onSubmit={save} className="flex flex-col gap-8" noValidate>
      <fieldset className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <legend className="mb-3 font-semibold">Nascita e codice fiscale</legend>
        {field('data_nascita', 'Data di nascita', { type: 'date', placeholder: ' ' })}
        {field('luogo_nascita', 'Luogo di nascita')}
        {field('codice_fiscale', 'Codice fiscale', {
          autoCapitalize: 'characters',
          onValueChange: (v: string) => set('codice_fiscale')(v.toUpperCase()),
        })}
      </fieldset>

      <fieldset className="grid grid-cols-1 sm:grid-cols-6 gap-5">
        <legend className="mb-3 font-semibold">Residenza</legend>
        <div className="sm:col-span-6">{field('via', 'Via e numero civico', { autoComplete: 'street-address' })}</div>
        <div className="sm:col-span-3">{field('comune', 'Comune', { autoComplete: 'address-level2' })}</div>
        <div className="sm:col-span-1">
          {field('provincia', 'Prov.', { maxLength: 2, onValueChange: (v: string) => set('provincia')(v.toUpperCase()) })}
        </div>
        <div className="sm:col-span-2">{field('cap', 'CAP', { inputMode: 'numeric', autoComplete: 'postal-code', maxLength: 5 })}</div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 font-semibold">Documento d’identità</legend>
        <RadioGroup
          aria-label="Tipo di documento"
          value={values.documento_tipo}
          onValueChange={chooseType}
          isInvalid={!!errors.documento_tipo}
          errorMessage={errors.documento_tipo}
          orientation="horizontal"
          classNames={{ wrapper: 'gap-2' }}
        >
          {Object.entries(DOCUMENT_LABELS).map(([value, label]) => (
            <Radio key={value} value={value} classNames={pillRadio}>
              {label}
            </Radio>
          ))}
        </RadioGroup>
        <DocumentNumber
          tipo={values.documento_tipo}
          numero={values.documento_numero}
          estero={estero}
          paese={values.documento_paese}
          errors={errors}
          onNumero={set('documento_numero')}
          onEstero={chooseForeign}
          onPaese={set('documento_paese')}
        />

        {!later && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {slots.map((slot) => (
              <PhotoSlot
                key={slot}
                corso={corso}
                slot={slot}
                uploaded={uploaded.includes(slot)}
                onUploaded={(s) => setUploaded((u) => Array.from(new Set([...u, s])))}
              />
            ))}
          </div>
        )}
        <Checkbox isSelected={later} onValueChange={setLater} size="sm">
          Li carico dopo: ti mandiamo un promemoria via email
        </Checkbox>
        {errors.documenti && <p className="text-sm text-secondary">{errors.documenti}</p>}
        <p className="text-xs text-neutral-500">Le foto restano in un archivio protetto, visibile solo alla segreteria.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <Switch isSelected={isCompany} onValueChange={setIsCompany} size="sm">
          Fatturazione come azienda
        </Switch>
        {isCompany && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {companyField('ragione_sociale', 'Ragione sociale')}
            {companyField('via', 'Via e numero civico')}
            {companyField('cap', 'CAP')}
            {companyField('partita_iva', 'Partita IVA')}
            {companyField('codice_fiscale', 'Codice fiscale azienda', false)}
            {companyField('pec', 'PEC', false)}
            {companyField('sdi', 'Codice SDI', false)}
          </div>
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button type="submit" color="primary" className="h-12 font-bold self-start px-8" isLoading={loading}>
          Continua
        </Button>
        {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
      </div>
    </form>
  )
}
