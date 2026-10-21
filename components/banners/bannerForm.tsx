import type { Field as FieldBlok } from '@types'
import { Alert, Button, Checkbox, Link } from '@heroui/react'
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
  // Area che interessa alla persona (interni / moda), passata al modulo come campo nascosto.
  area?: string
  scuro?: boolean
  onInviato: () => void
  onChiudi: () => void
}

type Stato = 'compila' | 'invio' | 'errore' | 'fatto'

/**
 * Il modulo di Storyblok dentro il banner, in versione compatta (decisione del 20/10):
 * prima l'email, poi il resto. Un modulo breve, come la newsletter, ha un passo solo.
 * Stessi campi, liste Brevo e tracciamento del modulo nella pagina.
 */
/** Il modulo come va nel banner: solo i campi previsti e, se serve, area e livello nascosti. */
export function moduloPerBanner(blok: ExtendedFormBlok, area?: string): ExtendedFormBlok {
  const form = mergeForm(blok)
  const tenuti = BANNER.campiNelBanner[form.tracking || '']
  if (!tenuti) return form
  const fields = (form.fields || []).filter((f) => tenuti.includes(f.id))
  const valore = area === 'moda' ? 'fashion' : area === 'interni' ? 'interior' : null
  if (valore && !fields.some((f) => f.id === 'area')) {
    const nascosto = (id: string, placeholder: string) =>
      ({ id, _uid: `banner-${id}`, component: 'field', input: 'multiple', label: id, hidden: true, required: false, placeholder }) as FieldBlok
    fields.push(nascosto('area', valore), nascosto('programma', 'primo'))
  }
  return { ...form, fields }
}

export default function BannerForm({ form: blok, area, scuro, onInviato, onChiudi }: BannerFormProps) {
  const { events: globalEvents } = useDataContext()
  const form = useMemo(() => moduloPerBanner(blok, area), [blok, area])
  // I campi da mostrare; quelli con tipo "hidden" non si vedono ma partono con il modulo.
  const visibili = useMemo(
    () => (form.fields || []).filter((f) => !f.hidden && f.id && (f.input as string) !== 'hidden'),
    [form.fields]
  )
  const email = visibili.find((f) => f.id === 'email')
  const daCompilare = visibili.filter((f) => f.id !== 'email' && f.input !== 'checkbox').length
  const duePassi = !!email && daCompilare > BANNER.campiUnPasso

  const [data, setData] = useState<FormData>(() => getData(form.fields))
  const [passo, setPasso] = useState<1 | 2>(1)
  const [stato, setStato] = useState<Stato>('compila')
  const [errore, setErrore] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState(!form.terms)
  const [chiediCookie, setChiediCookie] = useState(false)
  const [cookie, setCookie] = useState(false)
  const [grazie, setGrazie] = useState<{ title: string; body: string } | null>(null)

  useEffect(() => setChiediCookie(needsCookieConsent()), [])

  const campi = duePassi ? (passo === 1 ? [email as FieldBlok] : visibili.filter((f) => f.id !== 'email')) : visibili
  const ultimoPasso = !duePassi || passo === 2

  const handleChange = useCallback((field: FieldData) => {
    field.error = fieldValidation(field as any)
    if (field.id === 'nome' || field.id === 'cognome') field.value = getCapitalize(field.value)
    setData((prev) => ({ ...prev, [field.id]: field }))
    setErrore(null)
    setStato((s) => (s === 'errore' ? 'compila' : s))
  }, [])

  const avanti = () => {
    const campo = data.email
    const err = campo ? fieldValidation(campo as any) : null
    if (err) {
      setData((prev) => ({ ...prev, email: { ...campo, error: err } }))
      setStato('errore')
      setErrore('Controlla l’indirizzo email.')
      return
    }
    setPasso(2)
  }

  const invia = async () => {
    const controllati = validateFields(data)
    if (Object.values(controllati).some((f) => !!f?.error)) {
      setData(controllati)
      setStato('errore')
      setErrore('Verifica i campi evidenziati prima di procedere.')
      return
    }
    if (!privacy) {
      setStato('errore')
      setErrore(errors.agreement)
      return
    }
    setStato('invio')
    setErrore(null)
    const esito = await inviaModulo(form, controllati, globalEvents, chiediCookie && cookie)
    if (!esito.ok) {
      setStato('errore')
      setErrore(esito.error)
      return
    }
    setGrazie({
      title: parseText(titles.done, controllati),
      body: parseText(form.message || '', controllati),
    })
    setStato('fatto')
    onInviato()
  }

  if (stato === 'fatto') {
    return (
      <div className="grid justify-items-start gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-primary-50 text-primary" aria-hidden="true">
          ✓
        </span>
        {grazie?.title && compiler(grazie.title, { wrapper: null, overrides: Typography({}) })}
        {grazie?.body && <div className="text-sm">{compiler(grazie.body, { wrapper: null, overrides: Typography({}) })}</div>}
        <Button color="primary" onPress={onChiudi}>
          Chiudi
        </Button>
      </div>
    )
  }

  const testoLink = scuro ? 'text-white' : 'text-foreground'

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (ultimoPasso) invia()
        else avanti()
      }}
    >
      {duePassi && (
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
          <span>{passo} di 2</span>
          <span className="h-1 flex-1 rounded bg-primary" />
          <span className={`h-1 flex-1 rounded ${passo === 2 ? 'bg-primary' : 'bg-default-200'}`} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {campi.map((field) => (
          <div key={field._uid || field.id} className={field.id === 'nome' || field.id === 'cognome' ? 'col-span-1' : 'col-span-2'}>
            <StoryblokComponent
              blok={field}
              data={data[field.id] || { id: field.id, required: !!field.required, value: '' }}
              onChange={handleChange}
            />
          </div>
        ))}
      </div>

      {ultimoPasso && form.terms && (
        <div className="flex items-start gap-2 text-sm">
          <Checkbox isSelected={privacy} onValueChange={setPrivacy} aria-label="Ho letto l'informativa privacy" />
          <div>
            <span>Dichiaro di aver letto </span>
            <Link href={form.terms} target="_blank" rel="noopener noreferrer" className={`text-sm underline underline-offset-1 ${testoLink}`}>
              l'informativa Privacy
            </Link>
            .
          </div>
        </div>
      )}

      {ultimoPasso && chiediCookie && (
        <div className="flex items-start gap-2 text-sm">
          <Checkbox isSelected={cookie} onValueChange={setCookie} aria-label="Consenso ai cookie facoltativi" />
          <div>
            <span>Accetto anche i cookie facoltativi. </span>
            <Link href={COOKIE_POLICY_URL} target="_blank" rel="noopener noreferrer" className={`text-sm underline underline-offset-1 ${testoLink}`}>
              Cookie policy
            </Link>
          </div>
        </div>
      )}

      {stato === 'errore' && errore && <Alert color="danger" hideIcon variant="faded" title={errore} />}

      <div className="flex items-center justify-between gap-2">
        {duePassi && passo === 2 ? (
          <Button variant="light" className={scuro ? 'text-white' : undefined} onPress={() => setPasso(1)}>
            Indietro
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" color="primary" isLoading={stato === 'invio'} isDisabled={stato === 'invio'}>
          {ultimoPasso ? 'Invia' : 'Avanti'}
        </Button>
      </div>
    </form>
  )
}
