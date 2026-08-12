import type { Form as FormBlok, Field as FieldBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
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
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { fieldValidation } from '@modules/validations'
import { getCapitalize } from '@modules/formats'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { compiler } from 'markdown-to-jsx'
import { Typography } from './typography'
import { tv } from 'tailwind-variants'
import { sendGTMEvent } from '@next/third-parties/google'
import { isStoryResolved } from '@modules/relations'
import { useDataContext } from '@modules/context'
import type { ProcessedEvent } from '@modules/cache'

export interface FieldData {
  id: string
  value: any
  required: boolean
  error?: string | null
}

export type FormData = Record<string, FieldData>

export interface BrevoProps {
  id?: string | number
  email?: string
  attributes: Record<string, any>
}

export interface OptionProps {
  name: string | { title: string; days?: string[]; hours?: string[] } | any
  value: string
}

const dateFormat = {
  year: 'numeric' as const,
  month: '2-digit' as const,
  day: '2-digit' as const,
}

// Estensione del tipo generato da Storyblok per supportare la prop dinamica endpoint / action
type ExtendedFormBlok = FormBlok & {
  action?: string
  endpoint?: string
}

interface FormComponentProps {
  blok: ExtendedFormBlok
  courses?: Array<OptionProps>
  openday?: FieldData
  variant?: 'solid' | 'ghost'
}

type FormStates = 'close' | 'open' | 'search' | 'send' | 'error' | 'done'

function validateFields(data: FormData) {
  const updated = { ...data }
  Object.entries(updated).forEach(([name, field]) => {
    updated[name] = { ...field, error: fieldValidation(field as any) }
  })
  return updated
}

function buildEvent(
  data: FormData,
  globalEvents: ProcessedEvent[],
  tracking?: string
) {
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
        if (name === 'area' && value.length > 0) {
          const selectedArea = String(value[0]).toLowerCase()

          const matchingEvent = globalEvents
            .filter((ev) => {
              if (!ev.date) return false
              return ev.name?.toLowerCase().includes(selectedArea)
            })
            .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
            .find((ev) => new Date(ev.date!) >= today)

          if (matchingEvent?.date) {
            properties['openday_data'] = new Date(
              matchingEvent.date
            ).toLocaleDateString('it-IT', dateFormat)
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

function mergeForm(blok: ExtendedFormBlok, courses?: Array<OptionProps>): ExtendedFormBlok {
  const alias = isStoryResolved<ExtendedFormBlok>(blok.alias)
    ? (blok.alias as ISbStoryData<ExtendedFormBlok>).content
    : null

  if (!alias) return blok

  const mergedList = Array.from(
    new Set([...(blok.list || []), ...(alias.list || [])])
  )

  const allFields = [...(alias.fields || []), ...(blok.fields || [])]
  const fieldsMap = new Map<string, FieldBlok>()

  allFields.forEach((field) => {
    const key = field.id || field._uid
    if (key && !fieldsMap.has(key)) {
      fieldsMap.set(key, field)
    }
  })

  let mergedFields = Array.from(fieldsMap.values())

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
    action: alias.action || blok.action,
    endpoint: alias.endpoint || blok.endpoint,
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
  const { events: globalEvents } = useDataContext()

  const form = useMemo(() => mergeForm(blok, courses), [blok, courses])

  const [data, setData] = useState(() => getData(form.fields))
  const [user, setUser] = useState<BrevoProps | null>(null)
  const [agreement, setAgreement] = useState(!form.terms)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<FormStates>('close')
  const [message, setMessage] = useState<{ title: string; body: string } | null>(
    null
  )

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
    field.error = fieldValidation(field as any)
    if (field.id === 'nome' || field.id === 'cognome') {
      field.value = getCapitalize(field.value)
    }
    setData((prev) => ({ ...prev, [field.id]: field }))
  }, [])

  const handleUser = async (field: FieldData) => {
    if (!field.error && field.value) {
      setState('search')
      try {
        const response = await fetch('/api/crm', {
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
          cognome: {
            ...prev.cognome,
            value: responseUser?.attributes?.COGNOME || '',
          },
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

  /**
   * Determinazione dinamica e agnostica dell'endpoint di destinazione
   */
  const targetEndpoint = useMemo(() => {
    // 1. Se impostato da Storyblok tramite il campo 'endpoint' o 'action'
    if (form.endpoint && form.endpoint.trim() !== '') return form.endpoint
    if (form.action && form.action.trim() !== '') return form.action

    // 2. Mappatura legacy di sicurezza basata sullo scope/tracking
    if (form.tracking === 'recruit' || form.tracking === 'partnership') {
      return '/api/jobs'
    }

    // 3. Fallback predefinito per la lead generation standard su Brevo
    return '/api/crm'
  }, [form.endpoint, form.action, form.tracking])

  const handleSubmit = async () => {
    const newData = validateFields(data)
    const hasError = Object.values(newData).some((f) => !!f.error)

    if (!hasError) {
      setState(!agreement ? 'error' : 'open')
      setError(!agreement ? errors.agreement : null)
      if (!agreement) return

      setState('send')

      const event = buildEvent(newData, globalEvents, form.tracking)
      const contact = buildContact(newData, user, form.list)

      // Estrazione dinamica di tutte le coppie id: value
      const rawFieldValues = Object.fromEntries(
        Object.entries(newData).map(([key, field]) => [key, field.value])
      )

      // Payload universale da inviare alle API
      const payload = {
        contact,
        event,
        fields: rawFieldValues,
        company: rawFieldValues.azienda || rawFieldValues.company || user?.attributes?.AZIENDA || '',
        title: rawFieldValues.titolo || rawFieldValues.title || '',
        description: rawFieldValues.messaggio || rawFieldValues.description || '',
        location: rawFieldValues.citta || rawFieldValues.location || '',
        area: Array.isArray(rawFieldValues.area) ? rawFieldValues.area[0] : rawFieldValues.area || '',
        email: newData.email?.value,
      }

      try {
        // Chiamata all'endpoint selezionato da Storyblok
        const response = await fetch(targetEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        // Se l'endpoint non è crm, registriamo il contatto in modo asincrono anche sul CRM
        if (targetEndpoint !== '/api/crm') {
          fetch('/api/crm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, event }),
          }).catch((e) => console.error('[Async Brevo Sync Error]', e))
        }

        if (response.ok) {
          setMessage({
            title: parseText(titles[user ? 'user' : 'new'], newData),
            body: parseText(form.message || '', newData),
          })
          setState('done')
          sendGTMEvent({ event: `submit_${form.tracking || 'form'}_form` })
        } else {
          const errRes = await response.json().catch(() => null)
          setState('error')
          setError(errRes?.message || errors.default)
        }
      } catch (e) {
        console.error('[Form Submit Error]', e)
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
        if (
          typeof value === 'string' &&
          !Number.isNaN(new Date(value).valueOf())
        ) {
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
                  label={
                    state === 'search' ? 'Ricerca contatto' : 'Invio modulo'
                  }
                  classNames={{ label: label() }}
                />
              </div>
            )}

            {state !== 'done' && user && (
              <div className="mb-4">
                <h4 className="text-xl font-semibold capitalize">
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
                if (!field.id || (user && hiddenUserFields.includes(field.id)))
                  return null
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
              <div className="mt-2 flex items-start gap-2 text-sm">
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
                    className="inline-block text-sm underline underline-offset-1"
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
              <div className="flex w-full items-center">
                <Alert color="danger" hideIcon variant="faded" title={error} />
              </div>
            )}
          </DrawerBody>

          <DrawerFooter className="justify-start">
            {state !== 'done' ? (
              <>
                <Button
                  color="primary"
                  onPress={handleSubmit}
                  isDisabled={state === 'error'}
                >
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
  new: '###Bentornato {{nome}}!',
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