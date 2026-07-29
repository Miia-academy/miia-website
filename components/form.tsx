import type { Form as FormBlok, Field as FieldBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import type {
  BrevoProps,
  FieldData,
  FormData,
  OptionProps,
} from '@props/types'
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerFooter,
  Spinner,
  Checkbox,
  Link,
  Alert,
} from '@heroui/react'
import { opendays, Opendays } from '@pages/[...slug]'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { fieldValidation } from '@modules/validations'
import { getCapitalize } from '@modules/formats'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'
import { tv } from 'tailwind-variants'
import { sendGTMEvent } from '@next/third-parties/google'
import { isStoryResolved } from '@modules/relations'

const dateFormat = {
  year: 'numeric' as const,
  month: '2-digit' as const,
  day: '2-digit' as const,
}

interface FormComponentProps {
  blok: FormBlok
  courses?: Array<OptionProps>
  openday?: FieldData
  variant?: 'solid' | 'ghost'
}

type FormStates = 'close' | 'open' | 'search' | 'send' | 'error' | 'done'

// Helper: Validate all fields immutably
function validateFields(data: FormData) {
  const updated = { ...data }
  Object.entries(updated).forEach(([name, field]) => {
    updated[name] = { ...field, error: fieldValidation(field) }
  })
  return updated
}

// Helper: Build event object
function buildEvent(data: FormData, tracking?: string) {
  const eventFilterData = [
    'email',
    'nome',
    'cognome',
    'sms',
    'newsletter',
    'validation',
  ]
  const properties: { [key: string]: Date | string } = {}
  const today = new Date()

  Object.entries(data)
    .filter(([name]) => !eventFilterData.includes(name))
    .forEach(([name, { value }]) => {
      if (typeof value === 'number') {
        properties[name] = value.toString()
      } else if (Array.isArray(value)) {
        if (name === 'area') {
          const opendayList = opendays[value[0] as keyof Opendays]
          const event = opendayList?.find((ev) => new Date(ev.date) >= today)
          if (event?.date) {
            properties['openday_data'] = new Date(event.date).toLocaleDateString(
              'it-IT',
              dateFormat
            )
          }
        }
        properties[name] = value.join(', ')
      } else if (typeof value === 'string' && value.trim() !== '') {
        const dateValue = new Date(value)
        if (!isNaN(dateValue.valueOf())) {
          properties[name] = dateValue
          properties[name + '_data'] = dateValue.toLocaleDateString(
            'it-IT',
            dateFormat
          )
        } else {
          properties[name] = value
        }
      } else if (typeof value === 'boolean') {
        properties[name] = value ? 'Si' : 'No'
      }
    })

  return {
    identifiers: { email_id: data.email?.value },
    event_name: `submit_${tracking || 'form'}`,
    event_properties: properties,
  }
}

// Helper: Build contact object
function buildContact(data: FormData, user: BrevoProps | null, list?: any[]) {
  const contactFilterData = ['email']
  return {
    id: user?.id,
    email: data.email?.value,
    listIds: list || [],
    attributes: Object.fromEntries(
      Object.entries(data)
        .filter(([name]) => !contactFilterData.includes(name))
        .map(([name, { value }]) => {
          const NAME = name.toUpperCase()
          let parsedValue = value

          if (user && typeof user.attributes[NAME] !== 'undefined') {
            const attribute = user.attributes[NAME]
            if (Array.isArray(attribute) && Array.isArray(parsedValue)) {
              parsedValue = [...new Set([...attribute, ...parsedValue])]
            }
          }
          if (name === 'sms' && parsedValue) parsedValue = '+39' + parsedValue
          return [NAME, parsedValue]
        })
    ),
  }
}

// Helper: Merge Form and deduplicate fields correctly
function mergeForm(blok: FormBlok, courses?: Array<OptionProps>): FormBlok {
  const alias = isStoryResolved<FormBlok>(blok.alias)
    ? (blok.alias as ISbStoryData<FormBlok>).content
    : null;

  if (!alias) return blok

  // Merge lists (array primitivi: string | number)
  const mergedList = Array.from(new Set([...(blok.list || []), ...(alias.list || [])]))

  // Merge fields (Array di oggetti: deduplicazione per ID univoco)
  const allFields = [...(alias.fields || []), ...(blok.fields || [])]
  const fieldsMap = new Map<string, FieldBlok>()

  allFields.forEach((field) => {
    const key = field.id || field._uid
    if (key && !fieldsMap.has(key)) {
      fieldsMap.set(key, field)
    }
  })

  let mergedFields = Array.from(fieldsMap.values())

  // Handle enroll field
  const enrollIndex = mergedFields.findIndex((field) => field.input === 'enroll')
  if (enrollIndex >= 0) {
    if (courses?.length) {
      mergedFields = mergedFields.map((field, idx) =>
        idx === enrollIndex ? { ...field, options: courses as any } : field
      )
    } else {
      mergedFields = mergedFields.filter((_, idx) => idx !== enrollIndex)
    }
  }

  return {
    ...blok,
    ...alias,
    list: mergedList as any,
    fields: mergedFields,
    title: alias.title || blok.title,
    label: alias.label || blok.label,
    message: [alias.message, blok.message].filter(Boolean).join('\n'),
    tracking: alias.tracking || blok.tracking,
    terms: alias.terms || blok.terms,
  }
}

const getData = (fields: Array<FieldBlok> = []) => {
  const data: FormData = {}
  fields.forEach(({ id, input, placeholder = '', required, hidden: isHidden }) => {
    if (!id) return
    let value: any
    if (isHidden) {
      value =
        input === 'select' || input === 'multiple' || input === 'enroll'
          ? placeholder.split(',').map((v) => v.trim()).filter(Boolean)
          : placeholder
    } else {
      switch (input) {
        case 'checkbox':
          value = !!placeholder
          break
        case 'enroll':
        case 'select':
        case 'multiple':
          value = []
          break
        default:
          value = ''
          break
      }
    }
    data[id] = { id, value, required: !!required, error: null }
  })
  return data
}

export default function Form({
  blok,
  courses,
  openday,
  variant,
}: FormComponentProps) {
  // Merge alias to root form
  const form = useMemo(() => mergeForm(blok, courses), [blok, courses])

  // Init Data
  const [data, setData] = useState(() => getData(form.fields))
  const [user, setUser] = useState<BrevoProps | null>(null)
  const [agreement, setAgreement] = useState(!form.terms)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<FormStates>('close')
  const [message, setMessage] = useState<{ title: string; body: string } | null>(null)

  // Sincronizza i dati locali se i campi cambiano dall'Editor Visuale di Storyblok
  useEffect(() => {
    setData((prev) => {
      const updatedData = getData(form.fields)
      return { ...updatedData, ...prev }
    })
  }, [form.fields])

  useEffect(() => {
    if (openday) {
      setData((prev) => ({ ...prev, openday }))
    }
  }, [openday])

  const visibleFields = useMemo(
    () => (form.fields || []).filter((f) => !f.hidden),
    [form.fields]
  )

  const handleChange = useCallback((field: FieldData) => {
    field.error = fieldValidation(field)
    if (field.id === 'nome' || field.id === 'cognome') {
      field.value = getCapitalize(field.value)
    }
    setData((prev) => ({ ...prev, [field.id]: field }))
  }, [])

  const handleUser = async (field: FieldData) => {
    if (!field.error && field.value) {
      setState('search')
      try {
        const response = await fetch('/api/send-brevo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact: { email: field.value } }),
        })

        const responseUser = response.ok ? await response.json() : null
        setUser(responseUser)

        setData((prev) => ({
          ...prev,
          email: {
            ...prev.email,
            value: responseUser?.email || field.value,
            error: field.error,
          },
          nome: { ...prev.nome, value: responseUser?.attributes?.NOME || '' },
          cognome: { ...prev.cognome, value: responseUser?.attributes?.COGNOME || '' },
          sms: {
            ...prev.sms,
            value: responseUser?.attributes?.SMS
              ? responseUser.attributes.SMS.toString().substring(2)
              : '',
          },
        }))
      } catch (e) {
        console.error('Errore recupero contatto Brevo:', e)
      } finally {
        setState('open')
      }
    }
  }

  const handleSubmit = async () => {
    const newData = validateFields(data)
    const hasError = Object.values(newData).some((f) => !!f.error)

    if (!hasError) {
      setState(!agreement ? 'error' : 'open')
      setError(!agreement ? errors.agreement : null)
      if (!agreement) return

      setState('send')
      const event = buildEvent(newData, form.tracking)
      const contact = buildContact(newData, user, form.list)

      try {
        const response = await fetch('/api/send-brevo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contact, event }),
        })

        if (response.ok) {
          setMessage({
            title: parseText(titles[user ? 'user' : 'new'], newData),
            body: parseText(form.message || '', newData),
          })
          setState('done')
          sendGTMEvent({ event: `submit_${form.tracking || 'form'}_form` })
        } else {
          setState('error')
          setError(errors.default)
        }
      } catch (e) {
        setState('error')
        setError(errors.default)
      }
    } else {
      setState('error')
      setData(newData)
    }
  }

  const handleClear = useCallback(() => {
    setUser(null)
    const newData = getData(form.fields)
    if (openday) newData.openday = openday
    setData(newData)
  }, [form.fields, openday])

  const handleReset = useCallback(() => {
    handleClear()
    setMessage(null)
    setError(null)
    setAgreement(!form.terms)
    setState('close')
  }, [form.terms, handleClear])

  const parseText = useCallback((text: string, currentData: FormData) => {
    const keys = text.match(/{{(.*?)}}/g)
    if (keys && keys.length) {
      keys.forEach((string) => {
        const key = string.replace('{{', '').replace('}}', '')
        if (!currentData[key]?.value) return
        let value = currentData[key].value
        if (typeof value === 'string' && !Number.isNaN(new Date(value).valueOf())) {
          value = new Date(value).toLocaleDateString('it-IT')
        }
        text = text.replace(string, value)
      })
    }
    return text
  }, [])

  const { button, close, spinner, label, clear } = classes()
  const hiddenUserFields = ['nome', 'cognome', 'sms', 'email']

  return (
    <>
      <Button
        size="md"
        color="primary"
        variant={variant || 'solid'}
        className={button()}
        onPress={() => setState('open')}
        {...storyblokEditable(blok as any)}
      >
        {form.label || 'Compila il modulo'}
      </Button>

      <Drawer
        size="lg"
        isOpen={state !== 'close'}
        onOpenChange={handleReset}
        classNames={{ closeButton: close() }}
      >
        <DrawerContent>
          <DrawerHeader>{form.title || 'Titolo del modulo'}</DrawerHeader>

          <DrawerBody className="relative">
            {(state === 'search' || state === 'send') && (
              <div className={spinner()}>
                <Spinner
                  label={state === 'search' ? 'Ricerca contatto' : 'Invio modulo'}
                  classNames={{ label: label() }}
                />
              </div>
            )}

            {state !== 'done' && user && (
              <div className="mb-4">
                <h4 className="font-semibold text-xl capitalize">
                  Bentornato {user.attributes.NOME?.toString()}{' '}
                  {user.attributes.COGNOME?.toString()}!
                </h4>
                <p>
                  Abbiamo recuperato i tuoi dati, se vuoi cambiarli consulta
                  l'email di benvenuto.
                </p>
                <span className={clear()} onClick={handleClear}>
                  Non sono io
                </span>
              </div>
            )}

            {state === 'done' &&
              message?.title &&
              compiler(message.title, {
                wrapper: null,
                overrides: Typography({}),
              })}

            {state !== 'done' &&
              visibleFields.map((field) => {
                if (!field.id || (user && hiddenUserFields.includes(field.id))) return null
                return (
                  <StoryblokComponent
                    blok={field}
                    data={data[field.id]}
                    onChange={handleChange}
                    onBlur={handleUser}
                    key={field._uid || field.id}
                  />
                )
              })}

            {state !== 'done' && form.terms && (
              <div className="mt-2 text-sm flex items-start gap-2">
                <Checkbox
                  isRequired={true}
                  isSelected={agreement}
                  onValueChange={(value) => {
                    setAgreement(value)
                    setError(!value ? errors.agreement : null)
                    setState(!value ? 'error' : 'open')
                  }}
                />
                <div>
                  <span>Dichiaro di aver letto </span>
                  <Link
                    href={form.terms}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-1 text-sm inline-block"
                  >
                    l'informativa Privacy
                  </Link>
                  .
                </div>
              </div>
            )}

            {state === 'done' &&
              message?.body &&
              compiler(message.body, {
                wrapper: null,
                overrides: Typography({}),
              })}

            {state === 'error' && !!error && (
              <div className="w-full flex items-center">
                <Alert color="danger" hideIcon variant="faded" title={error} />
              </div>
            )}
          </DrawerBody>

          <DrawerFooter className="justify-start">
            {state !== 'done' ? (
              <>
                <Button color="primary" onPress={handleSubmit} isDisabled={state === 'error'}>
                  Invia
                </Button>
                <Button color="default" onPress={handleReset}>
                  Annulla
                </Button>
              </>
            ) : (
              <Button color="primary" onPress={handleReset}>
                Chiudi
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}

const titles = {
  new: '###Benvenuto {{nome}}!',
  user: '###Bentornato {{nome}}!\nAbbiamo recuperato i tuoi dati.',
  done: '###Grazie {{nome}}!',
}

const errors = {
  default: 'Si è verificato un errore, riprova più tardi',
  agreement: 'Devi accettare l’informativa privacy per procedere',
}

const classes = tv({
  slots: {
    button:
      'font-medium text-medium col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3',
    close: 'text-xl hover:bg-transparent active:bg-transparent',
    spinner:
      'absolute inset-0 flex items-center justify-center z-20 bg-opacity-30 bg-background backdrop-blur-sm',
    label: 'text-neutral-500',
    clear: 'font-medium underline text-sm cursor-pointer text-primary',
  },
})