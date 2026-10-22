import type { Form as FormBlok, Field as FieldBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { Drawer, DrawerContent, DrawerBody, DrawerHeader, DrawerFooter, Spinner, Checkbox, Link, Alert } from '@heroui/react'
import { Button } from '@components/ui/button'
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
import { getAttribution, refreshAttributionStorage } from '@modules/attribution'
import { tracciaModulo } from '@modules/tracking'
import { acceptAllCookies, COOKIE_POLICY_URL, needsCookieConsent } from '@modules/consent'
import { findOpendayByDate, getDocentiNames, joinNames } from '@modules/events'
import { formEventName, normalizeTracking, pickEventProperties } from '@modules/brevo-events'

export interface FieldData {
  id: string
  value: any
  required: boolean
  error?: string | null
}

export type FormData = Record<string, FieldData>

export interface OptionProps {
  name: string | { title: string; days?: string[]; hours?: string[] } | any
  value: string
}

const dateFormat = {
  year: 'numeric' as const,
  month: '2-digit' as const,
  day: '2-digit' as const,
}

export type ExtendedFormBlok = FormBlok & {
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

/** Sostituisce {{campo}} con i valori del modulo (date in formato italiano). */
export function parseText(text: string, currentData: FormData) {
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
}

// Indirizzo per cui un modulo si è già aperto da solo con ?modulo=apri.
let apertoPer: string | null = null

/**
 * Con ?modulo=apri nell'indirizzo (link degli avvisi dei banner) si apre da solo
 * il primo modulo della pagina, una volta sola.
 */
function apriDaIndirizzo(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).get('modulo') !== 'apri') return false
  if (apertoPer === window.location.href) return false
  apertoPer = window.location.href
  return true
}

export function validateFields(data: FormData) {
  const updated = { ...data }
  Object.entries(updated).forEach(([name, field]) => {
    if (!field || typeof field !== 'object') return
    updated[name] = { ...field, error: fieldValidation(field as any) }
  })
  return updated
}

export function buildEvent(
  data: FormData,
  globalEvents: ProcessedEvent[],
  tracking?: string
) {
  const properties: Record<string, string | number | boolean> = {}
  const today = new Date()

  const rawArea =
    data['area']?.value ||
    data['area_disciplinare']?.value ||
    data['enroll']?.value ||
    data['corso']?.value

  let selectedArea: string | null = null

  if (Array.isArray(rawArea) && rawArea.length > 0) {
    selectedArea = String(rawArea[0]).toLowerCase()
  } else if (typeof rawArea === 'string' && rawArea.trim() !== '') {
    selectedArea = rawArea.toLowerCase()
  }

  let opendayEvent: ProcessedEvent | undefined

  if (data['openday']?.value) {
    const directDate = new Date(data['openday'].value)
    if (!isNaN(directDate.valueOf())) {
      properties['openday'] = directDate.toISOString()
      properties['openday_data'] = directDate.toLocaleDateString(
        'it-IT',
        dateFormat
      )
      opendayEvent = findOpendayByDate(globalEvents, directDate.toISOString())
    }
  } else if (selectedArea) {
    const areaKeywordsMap: Record<string, string[]> = {
      interior: ['interior', 'interni'],
      interni: ['interior', 'interni'],
      fashion: ['fashion', 'moda'],
      moda: ['fashion', 'moda'],
    }

    const keywords = areaKeywordsMap[selectedArea] || [selectedArea]

    const matchingEvent = globalEvents
      .filter((ev) => {
        if (!ev.date || !ev.isOpenday) return false

        const nameMatch = keywords.some((kw) =>
          ev.name?.toLowerCase().includes(kw)
        )
        const opendayMatch = keywords.some((kw) =>
          ev.openday?.toLowerCase().includes(kw)
        )
        const pageUrlMatch = keywords.some((kw) =>
          ev.page?.cached_url?.toLowerCase().includes(kw)
        )

        return nameMatch || opendayMatch || pageUrlMatch
      })
      .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
      .find((ev) => new Date(ev.date!) >= today)

    if (matchingEvent?.date) {
      opendayEvent = matchingEvent
      const nextEventDate = new Date(matchingEvent.date)
      properties['openday'] = nextEventDate.toISOString()
      properties['openday_data'] = nextEventDate.toLocaleDateString(
        'it-IT',
        dateFormat
      )
    }
  }

  // Codice dell'open day per la pagina miia.it/open-day/accedi/<codice>
  if (opendayEvent?.slug) properties['openday_codice'] = opendayEvent.slug

  // Docenti dell'open day (campo "Docenti" dell'evento in Storyblok), per le email
  const docenti = joinNames(getDocentiNames(opendayEvent))
  if (docenti) properties['openday_docenti'] = docenti

  // Light event: only the data of this action (area, level, course); the rest of
  // the form goes to the contact attributes.
  for (const [property, ids] of Object.entries(EVENT_FIELDS)) {
    const value = ids.map((id) => data[id]?.value).find((v) => fieldText(v))
    if (value !== undefined) properties[property] = fieldText(value)
  }

  const name = formEventName(tracking)
  return {
    identifiers: { email_id: data.email?.value },
    event_name: name,
    event_properties: pickEventProperties(name, properties),
  }
}

// Form fields that fill the event properties, in order of preference.
const EVENT_FIELDS: Record<string, string[]> = {
  area: ['area', 'area_disciplinare'],
  programma: ['programma'],
  corso: ['corso', 'enroll'],
}

function fieldText(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ')
  if (typeof value === 'number') return String(value)
  return typeof value === 'string' ? value.trim() : ''
}

// Il contatto viene identificato solo dall'email. Prefisso del telefono e unione
// dei valori già presenti in Brevo vengono gestiti dal server (/api/crm).
export function buildContact(data: FormData, list?: any[]) {
  const contactFilterData = ['email']
  return {
    email: data.email?.value,
    listIds: list || [],
    attributes: Object.fromEntries(
      Object.entries(data)
        .filter(([name]) => !contactFilterData.includes(name))
        .map(([name, field]) => [name.toUpperCase(), field ? field.value : ''])
    ),
  }
}

/**
 * Data e codice dell'open day da salvare sul contatto: solo dal modulo di
 * iscrizione all'open day. Gli altri moduli (brochure, richiesta iscrizione)
 * calcolano il prossimo open day solo per l'evento Brevo, che lo usa nelle email
 * come invito (proprietà openday_data): se finisse nel contatto, le automazioni
 * dell'open day tratterebbero la persona come iscritta.
 */
export function opendayAttributes(
  properties: Record<string, string | number | boolean>,
  tracking?: string
): Record<string, string> {
  if (normalizeTracking(tracking) !== 'openday' || !properties['openday']) return {}
  return {
    OPENDAY: String(properties['openday']),
    ...(properties['openday_codice'] ? { OD_CODICE: String(properties['openday_codice']) } : {}),
  }
}

/**
 * Invia un modulo già controllato: Brevo (tramite /api/crm), evento GTM e profilo.
 * Usata dal modulo nella pagina e da quello dentro i banner.
 */
export async function inviaModulo(
  form: ExtendedFormBlok,
  newData: FormData,
  globalEvents: ProcessedEvent[],
  cookieConsent: boolean
): Promise<{ ok: true; returning: boolean } | { ok: false; error: string }> {
  // Consenso dato con la casella del modulo: lo registra Iubenda, come dal banner.
  if (cookieConsent && acceptAllCookies()) {
    refreshAttributionStorage()
    window.setTimeout(refreshAttributionStorage, 1000)
  }

  const event = buildEvent(newData, globalEvents, form.tracking)
  const contact = buildContact(newData, form.list)

  const rawFieldValues = Object.fromEntries(
    Object.entries(newData).map(([key, field]) => [key, field?.value])
  )

  if (event.event_properties['openday']) {
    rawFieldValues.openday = String(event.event_properties['openday'])
    rawFieldValues.openday_data = String(event.event_properties['openday_data'])
  }
  contact.attributes = {
    ...contact.attributes,
    ...opendayAttributes(event.event_properties, form.tracking),
  }

  const payload = {
    contact,
    event,
    fields: rawFieldValues,
    company:
      rawFieldValues.azienda ||
      rawFieldValues.company ||
      '',
    title: rawFieldValues.titolo || rawFieldValues.title || '',
    description:
      rawFieldValues.messaggio || rawFieldValues.description || '',
    location: rawFieldValues.citta || rawFieldValues.location || '',
    area: Array.isArray(rawFieldValues.area)
      ? rawFieldValues.area[0]
      : rawFieldValues.area || '',
    email: newData.email?.value,
    source: getAttribution(),
  }

  try {
    const response = await fetch('/api/crm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      const result = await response.json().catch(() => null)
      sendGTMEvent({ event: event.event_name })
      tracciaModulo(normalizeTracking(form.tracking), event.event_properties['openday'] ? String(event.event_properties['openday']) : undefined)
      return { ok: true, returning: !!result?.returning }
    }
    const errRes = await response.json().catch(() => null)
    return { ok: false, error: errRes?.message || errors.default }
  } catch (e) {
    console.error('[Form Submit Error]', e)
    return { ok: false, error: errors.default }
  }
}

export function mergeForm(blok: ExtendedFormBlok, courses?: Array<OptionProps>): ExtendedFormBlok {
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

export const getData = (fields: Array<FieldBlok> = []) => {
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
  const [agreement, setAgreement] = useState(!form.terms)
  // Casella facoltativa per i cookie: compare solo se non sono già accettati.
  const [askCookies, setAskCookies] = useState(false)
  const [cookieConsent, setCookieConsent] = useState(false)
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

  useEffect(() => {
    if (state === 'open') setAskCookies(needsCookieConsent())
  }, [state])

  useEffect(() => {
    if (apriDaIndirizzo()) setState('open')
  }, [])

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
    setError(null)
    setState((prev) => (prev === 'error' ? 'open' : prev))
  }, [])

  const handleSubmit = async () => {
    const newData = validateFields(data)
    const hasError = Object.values(newData).some((f) => !!f?.error)

    if (hasError) {
      setState('error')
      setData(newData)
      setError('Verifica i campi evidenziati prima di procedere.')
      return
    }

    if (!agreement) {
      setState('error')
      setError(errors.agreement)
      return
    }

    setState('send')
    setError(null)

    const esito = await inviaModulo(form, newData, globalEvents, askCookies && cookieConsent)
    if (esito.ok) {
      setMessage({
        title: parseText(titles[esito.returning ? 'user' : 'new'], newData),
        body: parseText(form.message || '', newData),
      })
      setState('done')
    } else {
      setState('error')
      setError(esito.error)
    }
  }

  const handleClear = useCallback(() => {
    const newData = getData(form.fields)
    if (openday) newData.openday = openday
    setData(newData)
  }, [form.fields, openday])

  const handleReset = useCallback(() => {
    handleClear()
    setMessage(null)
    setError(null)
    setAgreement(!form.terms)
    setCookieConsent(false)
    setState('close')
  }, [form.terms, handleClear])


  const { button, close, spinner, label } = classes()

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
        onOpenChange={(isOpen) => {
          if (!isOpen) handleReset()
        }}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
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


            {state === 'done' &&
              message?.title &&
              compiler(message.title, {
                wrapper: null,
                overrides: Typography({}),
              })}

            {state !== 'done' &&
              visibleFields.map((field) => {
                if (!field.id) return null

                return (
                  <StoryblokComponent
                    blok={field}
                    data={
                      data[field.id] || {
                        id: field.id,
                        required: !!field.required,
                        value: '',
                      }
                    }
                    onChange={handleChange}
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
                    if (value) {
                      setError(null)
                      setState((prev) => (prev === 'error' ? 'open' : prev))
                    } else {
                      setError(errors.agreement)
                      setState('error')
                    }
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

            {state !== 'done' && askCookies && (
              <div className="mt-2 flex items-start gap-2 text-sm">
                <Checkbox
                  aria-label="Consenso ai cookie facoltativi"
                  isSelected={cookieConsent}
                  onValueChange={setCookieConsent}
                />
                <div>
                  <span>Accetto anche i cookie facoltativi. </span>
                  <Link
                    href={COOKIE_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-sm underline underline-offset-1"
                  >
                    Cookie policy
                  </Link>
                  <p className="mt-0.5 text-xs italic text-neutral-500">
                    Funzionalità, esperienza, misurazione e marketing, per contenuti più
                    utili su sito e social. Puoi cambiare idea quando vuoi.
                  </p>
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
                  isDisabled={state === 'send' || state === 'search'}
                  isLoading={state === 'send'}
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

export const titles = {
  new: '###Benvenuto {{nome}}!',
  user: '###Bentornato {{nome}}!',
  done: '###Grazie {{nome}}!',
}

export const errors = {
  default: 'Si è verificato un errore, riprova più tardi',
  agreement: 'Devi accettare l’informativa privacy per procedere',
}

const classes = tv({
  slots: {
    button:
      'text-medium col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3',
    close: 'text-xl hover:bg-transparent active:bg-transparent',
    spinner:
      'absolute inset-0 flex items-center justify-center z-20 bg-opacity-30 bg-background backdrop-blur-sm',
    label: 'text-neutral-500',
    clear: 'font-medium underline text-sm cursor-pointer text-primary',
  },
})