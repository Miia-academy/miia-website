import type { Field as FieldBlok } from '@types'
import {
  Input,
  Select,
  SelectItem,
  Checkbox,
  DatePicker,
  Textarea,
  Slider,
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
  const FieldRenderer = fields[props.blok.input]
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
  openday: () => null,
  hidden: () => null,
}