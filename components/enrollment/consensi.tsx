import { useEffect, useState, type ReactNode } from 'react'
import { Button, Checkbox, Radio, RadioGroup, Spinner } from '@heroui/react'
import type { Conditions } from '@modules/enrollment/conditions'
import type { EnrollmentState } from '@modules/enrollment/state'

type Required = 'contratto' | 'clausole' | 'recesso' | 'privacy'

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
    <section className="flex flex-col gap-3 rounded-xl bg-[#F3F3F2] p-4 sm:p-5">
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

/** Passo 5: consensi raggruppati per argomento; nessuna casella già spuntata. */
export function Consensi({ corso, state, onSaved }: ConsensiProps) {
  const [conditions, setConditions] = useState<Conditions | null>(null)
  const [loadError, setLoadError] = useState('')
  const saved = state.consensi || {}
  // Le scelte salvate si ripropongono solo se i testi sono ancora quelli accettati.
  const [checks, setChecks] = useState<Record<Required | 'newsletter', boolean>>({
    contratto: false,
    clausole: false,
    recesso: false,
    privacy: false,
    newsletter: saved.newsletter === true,
  })
  const [foto, setFoto] = useState(typeof saved.foto === 'string' ? saved.foto : '')
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
        if (saved.versione === c.versione) {
          setChecks((s) => ({
            ...s,
            contratto: saved.contratto === true,
            clausole: saved.clausole === true,
            recesso: saved.recesso === true,
            privacy: saved.privacy === true,
          }))
        }
      })
      .catch(() => setLoadError('Errore di connessione. Ricarica la pagina.'))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [])

  const check = (key: keyof typeof checks, label: string, required = true) => (
    <Checkbox
      isSelected={checks[key]}
      onValueChange={(v) => setChecks((s) => ({ ...s, [key]: v }))}
      isInvalid={!!errors[key]}
      size="sm"
      classNames={{ label: 'text-sm' }}
    >
      {label}
      {required && <span className="text-secondary"> *</span>}
    </Checkbox>
  )

  const save = async () => {
    if (!conditions) return
    setLoading(true)
    setMessage('')
    setErrors({})
    try {
      const res = await fetch('/api/iscrizione/bozza', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          corso,
          sezione: 'consensi',
          valori: { ...checks, foto, versione: conditions.versione, impronta: conditions.impronta },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage(data.message || 'Servono i consensi con l’asterisco')
        setErrors(data.errori || {})
        if (data.aggiornate) {
          setChecks((s) => ({ ...s, contratto: false, clausole: false, recesso: false, privacy: false }))
          load()
        }
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
      <Group title="Contratto" tag="art. a–n">
        {conditions.contratto_punti.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-1">
            {conditions.contratto_punti.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <FullText label="Leggi le condizioni generali complete" text={conditions.contratto_testo} />
        {check('contratto', 'Ho letto e accetto le condizioni generali di contratto')}
      </Group>

      <Group title="Clausole da approvare a parte" tag="artt. 1341–1342 c.c.">
        <p className="text-sm text-neutral-700">La legge chiede un’approvazione separata per queste clausole.</p>
        {check('clausole', `Approvo espressamente: ${conditions.clausole_1341}`)}
      </Group>

      <Group title="Diritto di recesso">
        <p className="text-sm text-neutral-700 whitespace-pre-line">{conditions.recesso_testo}</p>
        {check('recesso', 'Ho capito come e fino a quando posso recedere')}
      </Group>

      <Group title="Privacy e proprietà intellettuale">
        <p className="text-sm text-neutral-700">Come trattiamo i tuoi dati e chi è titolare dei materiali e dei progetti del corso.</p>
        <FullText label="Leggi l’informativa completa" text={conditions.privacy_testo} />
        {check('privacy', 'Ho letto l’informativa privacy e accetto le regole sulla proprietà intellettuale')}
      </Group>

      <Group title="Fotografie e video" tag="scegli una risposta">
        <RadioGroup
          aria-label="Fotografie e video"
          value={foto}
          onValueChange={setFoto}
          isInvalid={!!errors.foto}
          errorMessage={errors.foto}
          classNames={{ wrapper: 'gap-3' }}
        >
          <Radio value="si" size="sm" classNames={{ label: 'text-sm' }}>
            Sì, autorizzo l’uso su cataloghi, sito e social di MIIA
          </Radio>
          <Radio value="no" size="sm" classNames={{ label: 'text-sm' }} description="In questo caso non potrai partecipare alle visite nelle aziende del settore.">
            No, non autorizzo
          </Radio>
        </RadioGroup>
      </Group>

      <Group title="Comunicazioni" tag="facoltativo">
        {check('newsletter', 'Voglio ricevere novità su corsi, open day ed eventi', false)}
      </Group>

      <p className="text-xs text-neutral-500">Versione delle condizioni: {conditions.versione}</p>
      <div className="flex flex-col gap-2">
        <Button color="primary" className="h-12 font-bold self-start px-8" isLoading={loading} onPress={save}>
          Continua
        </Button>
        {message && <p role="alert" className="text-sm text-secondary">{message}</p>}
      </div>
    </div>
  )
}
