import { useEffect, useState, type ReactNode } from 'react'
import { Button, Checkbox, Radio, RadioGroup, Spinner } from '@heroui/react'
import type { Conditions } from '@modules/enrollment/conditions'
import { descriptionLines } from '@modules/enrollment/consent-text'
import type { EnrollmentState } from '@modules/enrollment/state'

/** Testo integrale apribile: paragrafi separati da una riga vuota. */
function FullText({ label, text }: { label: string; text: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium text-primary">{label}</summary>
      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg bg-white p-4 text-neutral-700 space-y-3">
        {text.split(/\n{2,}/).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
    </details>
  )
}

function Group({ title, tag, children }: { title: string; tag?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-surface p-4 sm:p-5">
      <h3 className="font-semibold">
        {title} {tag && <span className="ml-1 text-xs font-normal text-neutral-500">{tag}</span>}
      </h3>
      {children}
    </section>
  )
}

interface ConsensiProps {
  corso: string
  state: EnrollmentState
  onSaved: (state: EnrollmentState) => void
}

type Answers = Record<string, boolean | string>

/** Passo 5: una voce per consenso, come in Storyblok; nessuna risposta già data. */
export function Consensi({ corso, state, onSaved }: ConsensiProps) {
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [loadError, setLoadError] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoadError('')
    fetch('/api/iscrizione/condizioni')
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return setLoadError(data.message || 'Non riusciamo a caricare le condizioni, riprova tra poco.')
        const c = data as Conditions
        setConditions(c)
        // Le risposte salvate si ripropongono solo se i testi sono ancora quelli accettati.
        const saved = state.consensi || {}
        if (saved.impronta === c.impronta) {
          const restored: Answers = {}
          for (const v of c.voci) if (v.chiave in saved) restored[v.chiave] = saved[v.chiave]
          setAnswers(restored)
        } else {
          setAnswers({})
        }
      })
      .catch(() => setLoadError('Errore di connessione. Ricarica la pagina.'))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const set = (key: string, value: boolean | string) => setAnswers((a) => ({ ...a, [key]: value }))

  const save = async () => {
    if (!conditions) return
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await fetch('/api/iscrizione/bozza', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corso, sezione: 'consensi', valori: { ...answers, impronta: conditions.impronta } }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.message || 'Servono le risposte con l’asterisco')
        setErrors(data.errori || {})
        if (data.aggiornate) load()
        return
      }
      onSaved(data.iscrizione as EnrollmentState)
    } catch {
      setMessage('Errore di connessione. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-secondary">{loadError}</p>
        <Button size="sm" variant="flat" onPress={load}>
          Riprova
        </Button>
      </div>
    )
  }
  if (!conditions) {
    return (
      <div className="flex justify-center py-8">
        <Spinner color="primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {conditions.voci.map((v) => {
        const { elenco, testo } = descriptionLines(v.descrizione)
        const star = v.obbligatorio ? <span className="text-secondary"> *</span> : null
        return (
          <Group key={v.chiave} title={v.titolo} tag={v.riferimento || (v.obbligatorio ? '' : 'facoltativo')}>
            {testo && <p className="text-sm text-neutral-700 whitespace-pre-line">{testo}</p>}
            {elenco.length > 0 && (
              <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-1">
                {elenco.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            {v.testo_completo && <FullText label="Leggi il testo completo" text={v.testo_completo} />}
            {v.tipo === 'si_no' ? (
              <RadioGroup
                aria-label={v.titolo}
                value={typeof answers[v.chiave] === 'string' ? (answers[v.chiave] as string) : ''}
                onValueChange={(value) => set(v.chiave, value)}
                isInvalid={!!errors[v.chiave]}
                errorMessage={errors[v.chiave]}
                classNames={{ wrapper: 'gap-3' }}
              >
                <Radio value="si" size="sm" classNames={{ label: 'text-sm' }}>
                  {v.etichetta}
                  {star}
                </Radio>
                <Radio value="no" size="sm" classNames={{ label: 'text-sm' }} description={v.nota_no || undefined}>
                  {v.etichetta_no}
                </Radio>
              </RadioGroup>
            ) : (
              <Checkbox
                isSelected={answers[v.chiave] === true}
                onValueChange={(value) => set(v.chiave, value)}
                isInvalid={!!errors[v.chiave]}
                size="sm"
                classNames={{ label: 'text-sm' }}
              >
                {v.etichetta}
                {star}
              </Checkbox>
            )}
          </Group>
        )
      })}

      <p className="text-xs text-neutral-500">Versione dei testi: {conditions.versione}</p>
      <div className="flex flex-col gap-2">
        <Button color="primary" className="h-12 font-bold self-start px-8" isLoading={loading} onPress={save}>
          Continua
        </Button>
        {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
      </div>
    </div>
  )
}
