import { normalizeTracking } from '@modules/brevo-events'
import type { Field as FieldBlok } from '@types'
import { Alert, Checkbox, Link } from '@heroui/react'
import { Button } from '@components/ui/button'
import { StoryblokComponent } from '@storyblok/react'
import { compiler } from 'markdown-to-jsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BANNER } from '@config/tracking'
import { COOKIE_POLICY_URL, needsCookieConsent } from '@modules/consent'
import { useDataContext } from '@modules/context'
import { getCapitalize } from '@modules/formats'
import { fieldValidation } from '@modules/validations'
import {
  errors,
  getData,
  inviaModulo,
  mergeForm,
  parseText,
  titles,
  validateFields,
  type ExtendedFormBlok,
  type FieldData,
  type FormData,
} from '@components/form'
import { Typography } from '../typography'

interface BannerFormProps {
  form: ExtendedFormBlok
  // Area the visitor is interested in (interni / moda), sent with the form as a hidden field.
  area?: string
  dark?: boolean
  onSent: () => void
  onClose: () => void
}

type Status = 'filling' | 'sending' | 'error' | 'done'

/**
 * The form as it goes in the banner: only the chosen fields and, when needed, hidden area and level.
 * Same fields, Brevo lists and tracking as the form in the page.
 */
export function formForBanner(blok: ExtendedFormBlok, area?: string): ExtendedFormBlok {
  const form = mergeForm(blok)
  const kept = BANNER.bannerFields[normalizeTracking(form.tracking) || '']
  if (!kept) return form
  const fields = (form.fields || []).filter((f) => kept.includes(f.id))
  const value = area === 'moda' ? 'fashion' : area === 'interni' ? 'interior' : null
  if (value && !fields.some((f) => f.id === 'area')) {
    const hidden = (id: string, placeholder: string) =>
      ({ id, _uid: `banner-${id}`, component: 'field', input: 'multiple', label: id, hidden: true, required: false, placeholder }) as FieldBlok
    fields.push(hidden('area', value), hidden('programma', 'primo'))
  }
  return { ...form, fields }
}

/**
 * The Storyblok form inside the banner, in a compact version (decision of 20/10):
 * first the email, then the rest. A short form, like the newsletter, has one step only.
 */
export default function BannerForm({ form: blok, area, dark, onSent, onClose }: BannerFormProps) {
  const { events: globalEvents } = useDataContext()
  const form = useMemo(() => formForBanner(blok, area), [blok, area])
  // Fields to show; the ones with type "hidden" are not visible but are sent with the form.
  const visible = useMemo(
    () => (form.fields || []).filter((f) => !f.hidden && f.id && (f.input as string) !== 'hidden'),
    [form.fields]
  )
  const email = visible.find((f) => f.id === 'email')
  const toFill = visible.filter((f) => f.id !== 'email' && f.input !== 'checkbox').length
  const twoSteps = !!email && toFill > BANNER.oneStepFields

  const [data, setData] = useState<FormData>(() => getData(form.fields))
  const [step, setStep] = useState<1 | 2>(1)
  const [status, setStatus] = useState<Status>('filling')
  const [error, setError] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState(!form.terms)
  const [askCookies, setAskCookies] = useState(false)
  const [cookies, setCookies] = useState(false)
  const [thanks, setThanks] = useState<{ title: string; body: string } | null>(null)

  useEffect(() => setAskCookies(needsCookieConsent()), [])

  const fields = twoSteps ? (step === 1 ? [email as FieldBlok] : visible.filter((f) => f.id !== 'email')) : visible
  const lastStep = !twoSteps || step === 2

  const handleChange = useCallback((field: FieldData) => {
    field.error = fieldValidation(field as any)
    if (field.id === 'nome' || field.id === 'cognome') field.value = getCapitalize(field.value)
    setData((prev) => ({ ...prev, [field.id]: field }))
    setError(null)
    setStatus((s) => (s === 'error' ? 'filling' : s))
  }, [])

  const next = () => {
    const emailField = data.email
    const err = emailField ? fieldValidation(emailField as any) : null
    if (err) {
      setData((prev) => ({ ...prev, email: { ...emailField, error: err } }))
      setStatus('error')
      setError('Controlla l’indirizzo email.')
      return
    }
    setStep(2)
  }

  const send = async () => {
    const checked = validateFields(data)
    if (Object.values(checked).some((f) => !!f?.error)) {
      setData(checked)
      setStatus('error')
      setError('Verifica i campi evidenziati prima di procedere.')
      return
    }
    if (!privacy) {
      setStatus('error')
      setError(errors.agreement)
      return
    }
    setStatus('sending')
    setError(null)
    const result = await inviaModulo(form, checked, globalEvents, askCookies && cookies)
    if (!result.ok) {
      setStatus('error')
      setError(result.error)
      return
    }
    setThanks({
      title: parseText(titles.done, checked),
      body: parseText(form.message || '', checked),
    })
    setStatus('done')
    onSent()
  }

  if (status === 'done') {
    return (
      <div className="grid justify-items-start gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-primary-50 text-primary" aria-hidden="true">
          ✓
        </span>
        {thanks?.title && compiler(thanks.title, { wrapper: null, overrides: Typography({}) })}
        {thanks?.body && <div className="text-sm">{compiler(thanks.body, { wrapper: null, overrides: Typography({}) })}</div>}
        <Button color="primary" onPress={onClose}>
          Chiudi
        </Button>
      </div>
    )
  }

  const linkColor = dark ? 'text-white' : 'text-foreground'

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (lastStep) send()
        else next()
      }}
    >
      {twoSteps && (
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
          <span>{step} di 2</span>
          <span className="h-1 flex-1 rounded bg-primary" />
          <span className={`h-1 flex-1 rounded ${step === 2 ? 'bg-primary' : 'bg-default-200'}`} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field._uid || field.id} className={field.id === 'nome' || field.id === 'cognome' ? 'col-span-1' : 'col-span-2'}>
            <StoryblokComponent
              blok={field}
              data={data[field.id] || { id: field.id, required: !!field.required, value: '' }}
              onChange={handleChange}
            />
          </div>
        ))}
      </div>

      {lastStep && form.terms && (
        <div className="flex items-start gap-2 text-sm">
          <Checkbox isSelected={privacy} onValueChange={setPrivacy} aria-label="Ho letto l'informativa privacy" />
          <div>
            <span>Dichiaro di aver letto </span>
            <Link href={form.terms} target="_blank" rel="noopener noreferrer" className={`text-sm underline underline-offset-1 ${linkColor}`}>
              l'informativa Privacy
            </Link>
            .
          </div>
        </div>
      )}

      {lastStep && askCookies && (
        <div className="flex items-start gap-2 text-sm">
          <Checkbox isSelected={cookies} onValueChange={setCookies} aria-label="Consenso ai cookie facoltativi" />
          <div>
            <span>Accetto anche i cookie facoltativi. </span>
            <Link href={COOKIE_POLICY_URL} target="_blank" rel="noopener noreferrer" className={`text-sm underline underline-offset-1 ${linkColor}`}>
              Cookie policy
            </Link>
          </div>
        </div>
      )}

      {status === 'error' && error && <Alert color="danger" hideIcon variant="faded" title={error} />}

      <div className="flex items-center justify-between gap-2">
        {twoSteps && step === 2 ? (
          <Button variant="light" className={dark ? 'text-white' : undefined} onPress={() => setStep(1)}>
            Indietro
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" color="primary" isLoading={status === 'sending'} isDisabled={status === 'sending'}>
          {lastStep ? 'Invia' : 'Avanti'}
        </Button>
      </div>
    </form>
  )
}
