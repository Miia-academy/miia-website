import { useEffect, useState } from 'react'
import { InputOtp } from '@heroui/react'
import { Button } from '@components/ui/button'
import { sendGTMEvent } from '@next/third-parties/google'
import { addDays, romeDate } from '@modules/enrollment/dates'
import { longDate, paymentStart } from '@modules/enrollment/labels'
import type { EnrollmentState } from '@modules/enrollment/state'
import type { SectionId } from '@modules/enrollment/types'
import { ACADEMY, withdrawalSentence } from '@modules/enrollment/withdrawal'

interface FirmaProps {
  corso: string
  state: EnrollmentState
  onSigned: (state: EnrollmentState) => void
  /** Il server chiede di tornare a un passo (condizioni cambiate, edizione piena). */
  onReopen: (id: SectionId) => void
}

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: res.ok, data: await res.json().catch(() => ({})) }
}

/** Passo 6: cosa si firma, cosa succede dopo, firma con codice SMS. */
export function Firma({ corso, state, onSigned, onReopen }: FirmaProps) {
  const [sentTo, setSentTo] = useState('')
  const [code, setCode] = useState('')
  const [wait, setWait] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState<'send' | 'sign' | null>(null)
  // Indicativa: la data vera la scrive il server al momento della firma.
  const recesso = longDate(addDays(romeDate(), 14))

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  const handle = (data: { message?: string; passo?: SectionId }) => {
    setError(data.message || 'Qualcosa non ha funzionato, riprova.')
    if (data.passo) onReopen(data.passo)
  }

  const send = async () => {
    setLoading('send')
    setError('')
    try {
      const res = await post('/api/iscrizione/firma/codice', { corso })
      if (typeof res.data.attesa === 'number') setWait(res.data.attesa)
      if (!res.ok) return handle(res.data)
      setSentTo(res.data.telefono || state.chi_sei.telefono)
      setCode('')
    } catch {
      setError('Errore di connessione. Riprova.')
    } finally {
      setLoading(null)
    }
  }

  const sign = async (value = code) => {
    if (value.length !== 6) return setError('Il codice è di 6 cifre')
    setLoading('sign')
    setError('')
    try {
      const res = await post('/api/iscrizione/firma/conferma', { corso, codice: value })
      if (!res.ok) return handle(res.data)
      // Misura della conversione: solo qui, al momento della firma.
      if (res.data.evento) sendGTMEvent(res.data.evento)
      onSigned(res.data.iscrizione as EnrollmentState)
    } catch {
      setError('Errore di connessione. Riprova.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border-2 border-primary p-4 sm:p-5 text-sm">
        <p className="font-semibold text-base">Questa è un’iscrizione vera, con valore di contratto.</p>
        <p className="mt-2 text-neutral-700">
          Firmando accetti i dati e le scelte dei passi precedenti. Puoi annullare senza costi e senza motivazione fino al{' '}
          <strong>{recesso}</strong> (14 giorni dalla firma). Ti mandiamo il contratto in PDF via email.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h3 className="font-semibold">Firma con il codice via SMS</h3>
        {!sentTo ? (
          <>
            <p className="text-sm text-neutral-700">
              Ti mandiamo un codice di 6 cifre al cellulare <strong>{state.chi_sei.telefono}</strong>. Se il numero non è giusto, correggilo nel primo passo.
            </p>
            <Button size="lg" color="primary" className="self-start" isLoading={loading === 'send'} onPress={send}>
              Mandami il codice
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-700">
              Abbiamo mandato il codice al <strong>{sentTo}</strong>.
            </p>
            <InputOtp
              length={6}
              value={code}
              onValueChange={setCode}
              onComplete={(v) => v && sign(v)}
              allowedKeys="^[0-9]*$"
              inputMode="numeric"
              autoComplete="one-time-code"
              isDisabled={!!loading}
              aria-label="Codice per la firma"
            />
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" color="primary" isLoading={loading === 'sign'} isDisabled={!!loading} onPress={() => sign()}>
                Firma l’iscrizione
              </Button>
              <Button variant="light" className="underline text-neutral-600" isDisabled={wait > 0 || !!loading} onPress={send}>
                {wait > 0 ? `Mandalo di nuovo tra ${wait} s` : 'Mandalo di nuovo'}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-secondary">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}

/** Dopo la firma: la pagina diventa la conferma. */
export function Conferma({
  state,
  edizione,
  corso,
  sede,
  inizio,
}: {
  state: EnrollmentState
  edizione: string
  /** Nome del corso e sede, per la frase da usare se si cambia idea. */
  corso: string
  sede: string
  /** Data di inizio dell'edizione (AAAA-MM-GG), da cui partono i pagamenti. */
  inizio?: string
}) {
  const sentence = withdrawalSentence(corso, sede)
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sentence)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-surface p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Iscrizione firmata</p>
        <h2 className="mt-1 type-title-4">Grazie {state.chi_sei.nome}, ci vediamo in aula.</h2>
        {edizione && <p className="mt-3 text-neutral-700">{edizione}</p>}
        {inizio && <p className="mt-3 text-neutral-700">{paymentStart(inizio)}</p>}
        <p className="mt-3 text-neutral-700">
          Ti abbiamo mandato il contratto in PDF a <strong>{state.email}</strong>. Per qualsiasi domanda scrivi a{' '}
          <a className="text-primary underline" href={`mailto:${ACADEMY.email}`}>
            {ACADEMY.email}
          </a>
          .
        </p>
      </div>
      {state.fine_recesso && (
        <section className="border-l-4 border-neutral-300 pl-5" aria-labelledby="recesso-titolo">
          <h3 id="recesso-titolo" className="font-bold">
            Se cambi idea
          </h3>
          <p className="mt-2 text-neutral-700">
            Puoi annullare l’iscrizione senza costi fino al <strong>{longDate(state.fine_recesso)}</strong> compreso. Rispondi
            all’email di conferma, o scrivi a {ACADEMY.email}, con questa frase:
          </p>
          <p className="mt-3 select-all rounded-medium bg-surface px-4 py-3 font-medium">{sentence}</p>
          <Button size="sm" variant="light" className="mt-1 -ms-3 underline text-neutral-600" onPress={copy}>
            {copied ? 'Frase copiata' : 'Copia la frase'}
          </Button>
          <p className="mt-2 text-sm text-neutral-600">
            In alternativa puoi usare la PEC ({ACADEMY.pec}) o una raccomandata a {ACADEMY.ragione_sociale}, {ACADEMY.indirizzo}.
          </p>
        </section>
      )}
    </div>
  )
}
