import type { Field as FieldBlok } from '@types'
import {
  Input,
  Select,
  SelectItem,
  Checkbox,
  DatePicker,
  Textarea,
  Slider,
  Button,
  Spinner,
} from '@heroui/react'
import { useState } from 'react'
import { storyblokEditable } from '@storyblok/react'

export interface DataProps {
  value?: any
  error?: string | null
}

export interface OptionProps {
  name: string | { title: string; days?: string[]; hours?: string[] } | any
  value: string
}

interface FieldComponentProps {
  blok: FieldBlok
  data: DataProps
  onChange: (data: DataProps) => void
  onBlur: (data: DataProps) => void
}

export default function Field(props: FieldComponentProps) {
  if (!props.blok.input) return null

  // Riconoscimento dinamico: se l'input è 'text' ma nelle opzioni su Storyblok contiene 'type:file'
  // oppure se l'ID del campo è un nome riservato agli allegati (es. logo, file, cv, documento)
  const isFileField =
    props.blok.input === 'text' &&
    ((typeof props.blok.options === 'string' &&
      props.blok.options.includes('type:file')) ||
      ['logo', 'file', 'cv', 'documento', 'allegato', 'pdf'].some((k) =>
        props.blok.id.toLowerCase().includes(k)
      ))

  const FieldRenderer = isFileField ? FileField : fields[props.blok.input]
  if (!FieldRenderer || !props.data) return null

  return (
    <div {...storyblokEditable(props.blok as any)}>
      <FieldRenderer {...props} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                SUB-COMPONENTS                              */
/* -------------------------------------------------------------------------- */

const TextField = ({ blok, data, onChange, onBlur }: FieldComponentProps) => (
  <Input
    id={blok.id}
    label={blok.label}
    placeholder={blok.placeholder}
    type={blok.input}
    isRequired={blok.required}
    errorMessage={data.error}
    isInvalid={!!data.error}
    value={data.value || ''}
    className={
      blok.hidden ? 'hidden' : blok.id === 'email' ? 'relative z-30' : ''
    }
    hidden={blok.hidden}
    startContent={
      blok.input === 'tel' && (
        <div className="pointer-events-none flex items-center">
          <span className="text-small text-neutral-400">+39</span>
        </div>
      )
    }
    onValueChange={(value) => onChange({ ...data, value })}
    onBlur={() => (blok.id === 'email' ? onBlur({ ...data }) : null)}
  />
)

const AreaField = ({ blok, data, onChange }: FieldComponentProps) => (
  <Textarea
    label={blok.label}
    placeholder={blok.placeholder}
    isRequired={blok.required}
    value={data.value || ''}
    errorMessage={data.error}
    isInvalid={!!data.error}
    hidden={blok.hidden}
    className={blok.hidden ? 'hidden' : ''}
    onValueChange={(value) => onChange({ ...data, value })}
  />
)

const NumberField = ({ blok, data, onChange }: FieldComponentProps) => {
  const options = getSliderOptions(blok.options)
  const initialValue =
    blok.placeholder && !isNaN(Number(blok.placeholder))
      ? Number(blok.placeholder)
      : 0

  const [number, setNumber] = useState<number>(initialValue)

  return (
    <div>
      <Slider
        classNames={{
          trackWrapper: 'my-2',
          labelWrapper: 'text-sm justify-start gap-3',
        }}
        color="foreground"
        defaultValue={number}
        label={blok.label}
        maxValue={options?.max ?? 100}
        minValue={options?.min ?? 0}
        size="sm"
        renderValue={() => (
          <div className="font-medium">
            {number} {options?.unit || ''}
          </div>
        )}
        step={options?.step ?? 1}
        onChange={(value) => {
          const val = Array.isArray(value) ? value[0] : value
          setNumber(val)
        }}
        onChangeEnd={(value) => {
          const val = Array.isArray(value) ? value[0] : value
          onChange({
            ...data,
            value: val,
          })
        }}
      />
      {data.error && <p className="text-danger text-xs">{data.error}</p>}
    </div>
  )
}

const CheckboxField = ({ blok, data, onChange }: FieldComponentProps) => (
  <Checkbox
    id={blok.id}
    isRequired={blok.required}
    color={!!data.error ? 'danger' : undefined}
    onValueChange={(value) => onChange({ ...data, value })}
    className={blok.id === 'validation' || blok.hidden ? 'hidden' : ''}
    isSelected={!!data.value}
    hidden={blok.hidden}
  >
    <p
      className={`text-sm ${!!data.error ? 'text-danger' : ''} ${blok.required
        ? "after:content-['*'] after:text-danger after:ms-0.5"
        : ''
        }`}
    >
      {blok.label}
    </p>
    {!!data.error && (
      <small className="text-xs text-danger">{data.error}</small>
    )}
  </Checkbox>
)

const DateField = ({ blok, data, onChange }: FieldComponentProps) => (
  <DatePicker
    id={blok.id}
    label={blok.label}
    isRequired={blok.required}
    value={data.value || null}
    showMonthAndYearPickers
    errorMessage={data.error}
    isInvalid={!!data.error}
    hidden={blok.hidden}
    className={blok.hidden ? 'hidden' : ''}
    onChange={(value) => onChange({ ...data, value })}
  />
)

const SelectField = ({ blok, data, onChange }: FieldComponentProps) => {
  const options = getOptions(blok.options)

  const handleChange = (keys: any) => {
    onChange({ ...data, value: Array.from(keys) })
  }

  return (
    <Select
      id={blok.id}
      title={blok.id}
      label={blok.label}
      placeholder={blok.placeholder}
      isRequired={blok.required}
      errorMessage={data.error}
      isInvalid={!!data.error}
      hidden={blok.hidden}
      selectedKeys={
        Array.isArray(data.value)
          ? data.value
          : data.value
            ? [data.value]
            : []
      }
      items={options}
      className={blok.hidden ? 'hidden' : ''}
      classNames={{
        trigger: blok.input === 'enroll' ? 'h-20' : undefined,
        value: 'space-x-1',
        label:
          blok.input === 'enroll'
            ? 'group-data-[filled=true]:-translate-y-[calc(50%_+_theme(fontSize.small)/2)]'
            : undefined,
      }}
      selectionMode={blok.input === 'multiple' ? 'multiple' : 'single'}
      onSelectionChange={handleChange}
      renderValue={(items) =>
        items.map((item) => (
          <CustomSelectItem key={item.key} name={item.data?.name} />
        ))
      }
    >
      {(option) => (
        <SelectItem
          className="data-[selectable=true]:focus:bg-neutral-100 data-[selectable=true]:focus:text-neutral-900 data-[selectable=true]:focus:font-medium"
          key={option.value}
          textValue={
            typeof option.name === 'string' ? option.name : option.name.title
          }
        >
          <CustomSelectItem name={option.name} />
        </SelectItem>
      )}
    </Select>
  )
}

/**
 * NUOVO: FileField per gestione di Upload Immagini, Logo o Documenti PDF
 */
const FileField = ({ blok, data, onChange }: FieldComponentProps) => {
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const acceptOptions = getFileAcceptOptions(blok.options)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setFileName(file.name)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error("Errore durante il caricamento dell'allegato")
      }

      const responseData = await res.json()

      // Impostiamo come valore del campo l'URL dell'asset o filename restituito dall'API
      onChange({ ...data, value: responseData.url || responseData.filename, error: null })
    } catch (err: any) {
      console.error('[FileField Upload Error]', err)
      onChange({ ...data, error: 'Upload non riuscito. Riprova.' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`flex flex-col gap-1.5 ${blok.hidden ? 'hidden' : ''}`}>
      <label className="text-small font-medium text-foreground">
        {blok.label}
        {blok.required && <span className="ml-0.5 text-danger">*</span>}
      </label>

      <div className="flex items-center gap-3">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept={acceptOptions}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <Button
            as="span"
            variant="flat"
            color={data.error ? 'danger' : 'primary'}
            isDisabled={uploading}
            size="sm"
            className="font-medium"
          >
            {uploading ? (
              <div className="flex items-center gap-2">
                <Spinner size="sm" color="current" />
                <span>Caricamento...</span>
              </div>
            ) : fileName ? (
              'Cambia file'
            ) : (
              'Seleziona File'
            )}
          </Button>
        </label>

        {fileName && !uploading && (
          <span className="max-w-[200px] truncate text-xs text-neutral-500 dark:text-neutral-400">
            {fileName}
          </span>
        )}
      </div>

      {data.value && typeof data.value === 'string' && !uploading && (
        <span className="text-tiny font-medium text-success">
          ✓ Allegato caricato correttamente
        </span>
      )}

      {data.error && <p className="text-xs text-danger">{data.error}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

const CustomSelectItem = ({ name }: { name: any }) => {
  if (!name) return null
  if (typeof name === 'string') {
    return <span>{name}</span>
  }
  return (
    <div className="flex flex-col">
      <h6 className="text-small font-medium">{name.title}</h6>
      <p className="text-tiny">
        {name.days && <span>{'Frequenza ' + name.days.join(' e ')}</span>}
        {name.hours && <span>{' - ' + name.hours.join(' e ')}</span>}
      </p>
    </div>
  )
}

const getSliderOptions = (fieldOptions?: string | Array<OptionProps>) => {
  if (!fieldOptions || typeof fieldOptions !== 'string') return null

  const parsed = Object.fromEntries(
    fieldOptions.split('\n').map((option: string) => option.split(':'))
  )

  return {
    min: parsed.min ? Number(parsed.min) : undefined,
    max: parsed.max ? Number(parsed.max) : undefined,
    step: parsed.step ? Number(parsed.step) : undefined,
    unit: parsed.unit || '',
  }
}

const getOptions = (fieldOptions?: string | Array<OptionProps>) => {
  if (!fieldOptions) return []
  if (typeof fieldOptions !== 'string') return fieldOptions

  const options: Array<{ name: string; value: string }> = []

  fieldOptions.split('\n').forEach((option) => {
    const [name, value] = option.split(':')
    if (name && value) {
      options.push({ name: name.trim(), value: value.trim() })
    }
  })

  return options
}

const getFileAcceptOptions = (fieldOptions?: string | Array<OptionProps>) => {
  if (!fieldOptions || typeof fieldOptions !== 'string') {
    return '.pdf,.jpg,.jpeg,.png'
  }
  const found = fieldOptions.split('\n').find((opt) => opt.startsWith('accept:'))
  return found ? found.replace('accept:', '').trim() : '.pdf,.jpg,.jpeg,.png'
}

const fields: Record<string, React.FC<FieldComponentProps>> = {
  text: TextField,
  number: NumberField,
  email: TextField,
  tel: TextField,
  date: DateField,
  checkbox: CheckboxField,
  area: AreaField,
  select: SelectField,
  multiple: SelectField,
  enroll: SelectField,
  file: FileField,
  openday: () => null,
  hidden: () => null,
}