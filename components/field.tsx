import type { FieldProps, OptionProps, DataProps } from '@props/types'
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

interface FieldComponent {
  blok: FieldProps
  data: DataProps
  onChange: (e: any) => object
  onBlur: (e: any) => object
}

export default function Field(props: FieldComponent) {
  if (!props.blok.input) return null
  const Fields = fields[props.blok.input]
  if (!props?.data) return null
  return <Fields {...props} />
}

const TextField = ({ blok, data, onChange, onBlur }: FieldComponent) => (
  <Input
    id={blok.id}
    label={blok.label}
    placeholder={blok.placeholder}
    type={blok.input}
    isRequired={blok.required}
    errorMessage={data.error}
    isInvalid={!!data.error}
    value={data.value}
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

const AreaField = ({ blok, data, onChange }: FieldComponent) => (
  <Textarea
    label={blok.label}
    placeholder={blok.placeholder}
    isRequired={blok.required}
    value={data.value}
    errorMessage={data.error}
    isInvalid={!!data.error}
    hidden={blok.hidden}
    className={blok.hidden ? 'hidden' : ''}
    onValueChange={(value) => onChange({ ...data, value })}
  />
)

const getSliderOptions = (fieldOptions: string | Array<OptionProps>) =>
  fieldOptions && typeof fieldOptions === 'string'
    ? Object.fromEntries(
        fieldOptions.split('\n').map((option: string) => option.split(':'))
      )
    : null

const NumberField = ({ blok, data, onChange }: FieldComponent) => {
  const options = getSliderOptions(blok.options)
  const [number, setNumber] = useState(
    !Number.isNaN(blok.placeholder) ? Number(blok.placeholder) : 0
  )

  // debugger

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
        maxValue={Number(options?.max) || 100}
        minValue={Number(options?.min) || 0}
        size="sm"
        renderValue={() => (
          <div className="font-medium">
            {number} {options.unit}
          </div>
        )}
        step={Number(options?.step) || 1}
        onChange={(value) =>
          Array.isArray(value) ? value[0] : setNumber(value)
        }
        onChangeEnd={(value) =>
          onChange({
            ...data,
            value: Array.isArray(value) ? value[0] : value,
          })
        }
      />
      {data.error && <p className="text-danger text-xs">{data.error}</p>}
    </div>
  )
}

const CheckboxField = ({ blok, data, onChange }: FieldComponent) => (
  <Checkbox
    id={blok.id}
    isRequired={blok.required}
    color={!!data.error ? 'danger' : undefined}
    onValueChange={(value) => onChange({ ...data, value })}
    className={blok.id === 'validation' || blok.hidden ? 'hidden' : ''}
    isSelected={data.value}
    hidden={blok.hidden}
  >
    <p
      className={`text-sm ${!!data.error ? 'text-danger' : ''} ${
        blok.required
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

const DateField = ({ blok, data, onChange }: FieldComponent) => (
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

const SelectField = ({ blok, data, onChange }: FieldComponent) => {
  const options = getOptions(blok.options)

  const handleChange = (value: any) => {
    onChange({ ...data, value: Array.from(value) })
  }

  const CustomItem = ({ name }: any) => {
    if (typeof name === 'string') {
      return <span>{name}</span>
    } else {
      return (
        <div className="flex flex-col">
          <h6 className="text-small font-medium">{name.title}</h6>
          <p className="text-tiny">
            <span>{'Frequenza ' + name.days.join(' e ')}</span>
            <span> - </span>
            <span>{name.hours.join(' e ')}</span>
          </p>
        </div>
      )
    }
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
      selectedKeys={Array.isArray(data.value) ? data.value : [data.value]}
      items={options}
      className={blok.hidden ? 'hidden' : ''}
      classNames={{
        trigger: blok.input === 'enroll' ? 'h-20' : null,
        value: 'space-x-1',
        label:
          blok.input === 'enroll'
            ? 'group-data-[filled=true]:-translate-y-[calc(50%_+_theme(fontSize.small)/2)]'
            : null,
      }}
      selectionMode={blok.input === 'multiple' ? 'multiple' : 'single'}
      onSelectionChange={handleChange}
      renderValue={(items) =>
        items.map((item) => (
          <CustomItem key={item.key} name={item.data?.name} />
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
          <CustomItem name={option.name} />
        </SelectItem>
      )}
    </Select>
  )
}

const fields = {
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

const getOptions = (fieldOptions: string | Array<OptionProps>) => {
  if (typeof fieldOptions !== 'string') return fieldOptions
  const options: Array<{ name: string; value: string }> = []

  fieldOptions.split('\n').forEach((option) => {
    const [name, value] = option.split(':')
    if (name && value) {
      options.push({ name, value })
    }
  })

  return options
}
