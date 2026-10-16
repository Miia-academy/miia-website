import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button, Input, InputOtp } from '@heroui/react'
import { getAttribution } from '@modules/attribution'
import type { EnrollmentState } from '@modules/enrollment/state'

type Phase = 'email' | 'codice' | 'dati'

interface ChiSeiProps {
  corso: string
  initialEmail?: string
  /** Bozza già verificata (cookie), o null se la persona deve ancora verificare l'email. */
  state: EnrollmentState | null
  onVerified: (state: EnrollmentState) => void
  onSaved: (state: EnrollmentState) => void
}

async function post(url: string, data: unknown, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data: json as Record<string, any> }
}

const inputClasses = { label: 'after:text-secondary', inputWrapper: 'bg-[#F3F3F2]' }

/** Passo 1: email, codice di verifica, poi nome, cognome e cellulare. */
export function ChiSei({ corso, initialEmail = '', state, onVerified, onSaved }: ChiSeiProps) {
  const [phase, setPhase] = useState<Phase>(state ? 'dati' : 'email')
  const [email, setEmail] = useState(state?.email || initialEmail)
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [values, setValues] = useState(state?.chi_sei || { nome: '', cognome: '', telefono: '' })
  const [greeting, setGreeting] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const honeypot = useRef<HTMLInputElement>(null)

  // Conto alla rovescia per "Mandalo di nuovo".
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  useEffect(() => {
    if (state) {
      setPhase('dati')
      setEmail(state.email)
      setValues(state.chi_sei)
    }
  }, [state])

  const fail = (text: string, field?: string) => {
    setMessage(text)
    setErrors(field ? { [field]: text } : {})
  }

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await post('/api/iscrizione/codice', { email, corso, validation: honeypot.current?.value || '' })
      if (!res.ok) {
        if (typeof res.data.attesa === 'number') setWait(res.data.attesa)
        return fail(res.data.message || 'Non siamo riusciti a inviare il codice, riprova.', res.data.campo)
      }
      setWait(res.data.attesa || 30)
      setCode('')
      setPhase('codice')
    } catch {
      fail('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const verify = async (value: string) => {
    if (value.length !== 6 || loading) return
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await post('/api/iscrizione/verifica', { email, corso, codice: value, provenienza: getAttribution() })
      if (!res.ok) {
        setCode('')
        return fail(res.data.message || 'Il codice non è corretto.', 'codice')
      }
      const next = res.data.iscrizione as EnrollmentState
      setValues(next.chi_sei)
      setGreeting(res.data.trovato && next.chi_sei.nome ? `Ciao ${next.chi_sei.nome}, abbiamo già i tuoi dati.` : '')
      setPhase('dati')
      onVerified(next)
    } catch {
      fail('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await post('/api/iscrizione/bozza', { corso, sezione: 'chi_sei', valori: values }, 'PUT')
      if (res.status === 401) {
        setPhase('email')
        return fail(res.data.message)
      }
      if (!res.ok) {
        setMessage(res.data.message || 'Completa i campi con l’asterisco')
        setErrors(res.data.errori || {})
        const first = Object.keys(res.data.errori || {})[0]
        if (first) document.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus()
        return
      }
      onSaved(res.data.iscrizione as EnrollmentState)
    } catch {
      fail('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const footer = (label: string) => (
    <div className="flex flex-col gap-2">
      <Button type="submit" color="primary" className="h-12 font-bold self-start px-8" isLoading={loading}>
        {label}
      </Button>
      {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
    </div>
  )

  if (phase === 'email') {
    return (
      <form onSubmit={sendCode} className="flex flex-col gap-5 max-w-md" noValidate>
        <p className="text-sm text-neutral-600">Ti mandiamo un codice per verificare l’email e salvare l’iscrizione.</p>
        <Input
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          isRequired
          value={email}
          onValueChange={setEmail}
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          classNames={inputClasses}
        />
        {/* Campo trappola per i bot, invisibile alle persone */}
        <input ref={honeypot} name="validation" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        {footer('Continua')}
      </form>
    )
  }

  if (phase === 'codice') {
    return (
      <form onSubmit={(e) => { e.preventDefault(); verify(code) }} className="flex flex-col gap-4 max-w-md" noValidate>
        <p className="text-sm text-neutral-600">
          Abbiamo mandato un codice di 6 cifre a <strong className="text-neutral-900">{email}</strong>. Controlla anche nella posta indesiderata.
        </p>
        <InputOtp
          length={6}
          value={code}
          onValueChange={setCode}
          onComplete={(v) => v && verify(v)}
          allowedKeys="^[0-9]*$"
          inputMode="numeric"
          autoComplete="one-time-code"
          isInvalid={!!errors.codice}
          errorMessage={errors.codice}
          isDisabled={loading}
          aria-label="Codice di verifica"
        />
        {footer('Verifica')}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <button type="button" className="text-primary font-semibold disabled:text-neutral-400" disabled={wait > 0 || loading} onClick={() => sendCode()}>
            {wait > 0 ? `Mandalo di nuovo tra ${wait} s` : 'Mandalo di nuovo'}
          </button>
          <button type="button" className="text-neutral-500 underline" onClick={() => { setPhase('email'); setMessage(''); setErrors({}) }}>
            Cambia email
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5" noValidate>
      {greeting && <p className="text-sm font-medium text-primary">{greeting}</p>}
      <p className="text-sm text-neutral-600">
        Email verificata: <strong className="text-neutral-900">{email}</strong>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Input name="nome" label="Nome" autoComplete="given-name" isRequired value={values.nome}
          onValueChange={(v) => setValues((s) => ({ ...s, nome: v }))} isInvalid={!!errors.nome} errorMessage={errors.nome} classNames={inputClasses} />
        <Input name="cognome" label="Cognome" autoComplete="family-name" isRequired value={values.cognome}
          onValueChange={(v) => setValues((s) => ({ ...s, cognome: v }))} isInvalid={!!errors.cognome} errorMessage={errors.cognome} classNames={inputClasses} />
        <Input name="telefono" type="tel" label="Cellulare" autoComplete="tel" isRequired value={values.telefono}
          onValueChange={(v) => setValues((s) => ({ ...s, telefono: v }))} isInvalid={!!errors.telefono} errorMessage={errors.telefono}
          description="Serve per il codice di firma via SMS." classNames={inputClasses} />
      </div>
      {footer('Continua')}
    </form>
  )
}
