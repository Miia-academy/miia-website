// gate.tsx
import React, { useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Input,
  Button,
  Alert,
  Checkbox,
  Link,
} from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'

// --- INTERFACCE ---
interface AuthGateProps {
  onSuccess?: () => void
  redirectUrl?: string
}

type AuthTab = 'login' | 'register'

interface SuccessData {
  type: 'login' | 'register'
  email: string
  contactPerson?: string
}

// --- UTILITY ---
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

// --- SOTTO-COMPONENTI UI ---

const HeaderView = () => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <Button
        as={NextLink}
        href="/"
        size="sm"
        variant="light"
        className="text-xs font-medium text-neutral-500 hover:text-neutral-900 px-0 min-w-0"
      >
        ← Torna alla Home
      </Button>
    </div>
    <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
      Area Riservata
    </h2>
    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
      Accedi per consultare o gestire le inserzioni. La registrazione di un nuovo profilo è riservata esclusivamente alle Aziende Partner (gli studenti sono già accreditati dalla scuola).
    </p>
  </div>
)

const SuccessView = ({ data, hasOnSuccess }: { data: SuccessData; hasOnSuccess: boolean }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className="flex flex-col items-center text-center py-4 px-2 space-y-5"
  >
    {data.type === 'login' ? (
      <>
        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Controlla la tua casella di posta!
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed text-center">
          Ti abbiamo inviato un <strong>Magic Link</strong> di accesso. <br />
          Clicca sul link contenuto nell'email per entrare direttamente nella tua area riservata.
        </p>
      </>
    ) : (
      <>
        <h3 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Grazie <span className="text-[#009245]">{data.contactPerson}</span><br /> la richiesta è stata inviata con successo!
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed text-center">
          Riceverà un’<strong>email con un link diretto</strong> per accedere a questa pagina e poter pubblicare una nuova inserzione. In seguito, il nostro staff <strong>analizzerà la posizione</strong> per poi divulgarla ai nostri studenti. <br /><br />
          Sempre in questa schermata potrà in qualsiasi momento <strong>consultare le sue inserzioni</strong>, <strong>eliminarle</strong> o <strong>aggiungerne di nuove</strong> qualora serva.
        </p>
      </>
    )}

    <div className="w-full bg-neutral-100 dark:bg-neutral-800 p-3.5 rounded-2xl text-xs font-mono text-neutral-700 dark:text-neutral-300 break-all border border-neutral-200/50 dark:border-neutral-700/50">
      Email inviata a: <strong>{data.email}</strong>
    </div>

    {hasOnSuccess && (
      <Button as={Link} href="/" color="primary" radius="md" variant="solid">
        Continua la navigazione
      </Button>
    )}
  </motion.div>
)

// --- SOTTO-COMPONENTI LOGICI ---

const LoginForm = ({
  redirectUrl,
  onSuccess,
  onError,
}: {
  redirectUrl: string
  onSuccess: (email: string) => void
  onError: (msg: string | null) => void
}) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    onError(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectUrl }),
      })
      const data = await res.json()

      if (res.ok) {
        onSuccess(email)
      } else {
        onError(data.message || 'Impossibile inviare il link di accesso. Riprova con un’altra email.')
      }
    } catch {
      onError('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.form
      key="login-form"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 pt-3"
    >
      <Input
        type="email"
        label="Email"
        placeholder="mario.rossi@example.com"
        isRequired
        variant="flat"
        className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl"
        value={email}
        onValueChange={setEmail}
      />
      <div className="flex gap-2 mt-2">
        <Button type="submit" isLoading={loading} className="bg-[#009245] text-white font-medium px-6 h-11 rounded-xl">
          Invia Magic Link
        </Button>
        <Button as={NextLink} href="/" variant="flat" className="bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium px-6 h-11 rounded-xl">
          Annulla
        </Button>
      </div>
    </motion.form>
  )
}

const RegisterForm = ({
  redirectUrl,
  onSuccess,
  onError,
}: {
  redirectUrl: string
  onSuccess: (email: string, contactPerson: string) => void
  onError: (msg: string | null) => void
}) => {
  const [loading, setLoading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    nome: '',
    contact_person: '',
    email: '',
    sms: '',
    termsAccepted: false,
    newsletter: false,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.termsAccepted) {
      onError('Devi accettare i termini e le condizioni per proseguire.')
      return
    }

    setLoading(true)
    onError(null)

    try {
      let logoBase64 = ''
      let logoFileName = ''
      let logoMimeType = ''

      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile)
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, logoBase64, logoFileName, logoMimeType, redirectUrl }),
      })
      const data = await res.json()

      if (res.ok) {
        onSuccess(form.email, form.contact_person || 'Referente')
      } else {
        onError(data?.message || 'Errore durante la registrazione dell’azienda.')
      }
    } catch {
      onError('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.form
      key="register-form"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.15 }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 pt-3 h-[400px] sm:h-auto overflow-y-auto pr-1"
    >
      <Input label="Nome Azienda" isRequired variant="flat" value={form.nome} onValueChange={(val) => setForm({ ...form, nome: val })} />
      <Input label="Nome Referente" placeholder="Es. Mario Rossi" isRequired variant="flat" value={form.contact_person} onValueChange={(val) => setForm({ ...form, contact_person: val })} />
      <Input type="email" label="Email Aziendale" isRequired variant="flat" value={form.email} onValueChange={(val) => setForm({ ...form, email: val })} />
      <Input type="tel" label="Telefono" variant="flat" value={form.sms} onValueChange={(val) => setForm({ ...form, sms: val })} />

      <div className="flex flex-col gap-1 w-full pt-1">
        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Logo Aziendale (Opzionale)
        </label>
        <input
          type="file"
          accept="image/png, image/jpeg, image/webp, image/svg+xml"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) setLogoFile(e.target.files[0])
          }}
          className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-neutral-100 dark:file:bg-neutral-800 file:text-neutral-700 dark:file:text-neutral-300 hover:file:bg-neutral-200 cursor-pointer"
        />
      </div>

      <div className="flex flex-col gap-2 mt-2 px-1">
        <Checkbox isSelected={form.termsAccepted} onValueChange={(val) => setForm({ ...form, termsAccepted: val })} size="sm" color="primary" isRequired>
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            Ho letto e accetto i <NextLink href="/collaborazione-aziende" target="_blank" className="text-[#009245] hover:underline font-medium">termini di collaborazione</NextLink>.
          </span>
        </Checkbox>
        <Checkbox isSelected={form.newsletter} onValueChange={(val) => setForm({ ...form, newsletter: val })} size="sm" color="primary">
          <span className="text-xs text-neutral-600 dark:text-neutral-400">
            Voglio iscrivermi alla newsletter per ricevere aggiornamenti.
          </span>
        </Checkbox>
      </div>

      <div className="flex gap-2 mt-3">
        <Button type="submit" isLoading={loading} className="bg-[#009245] text-white font-medium px-6 h-11 rounded-xl">
          Invia Richiesta
        </Button>
        <Button as={NextLink} href="/" variant="flat" className="bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium px-6 h-11 rounded-xl">
          Annulla
        </Button>
      </div>
    </motion.form>
  )
}

// --- COMPONENTE PRINCIPALE ESPORTATO ---

export default function AuthGate({ onSuccess, redirectUrl }: AuthGateProps) {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState<AuthTab>('login')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  const activeRedirectUrl = redirectUrl || router.asPath

  return (
    <div className="w-full py-4">
      <Card
        shadow="none"
        className="mx-auto max-w-lg bg-white p-4 dark:bg-neutral-900 sm:p-6 rounded-3xl border border-neutral-200/60 dark:border-neutral-800"
      >
        <CardBody className="space-y-5 px-1 sm:px-2">
          {!successData && <HeaderView />}

          {successData ? (
            <SuccessView data={successData} hasOnSuccess={!!onSuccess} />
          ) : (
            <>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  setSelectedTab(key as AuthTab)
                  setErrorMsg(null)
                }}
                color="success"
                variant="underlined"
                fullWidth
                classNames={{
                  tabList: 'border-b border-neutral-200 dark:border-neutral-800 gap-6 p-0',
                  cursor: 'w-full bg-[#009245]',
                  tab: 'max-w-fit px-0 h-10',
                  tabContent: 'group-data-[selected=true]:font-bold text-sm text-neutral-700 dark:text-neutral-200 group-data-[selected=true]:text-[#009245]',
                }}
              >
                <Tab key="login" title="Accedi">
                  <AnimatePresence mode="wait">
                    <LoginForm
                      redirectUrl={activeRedirectUrl}
                      onSuccess={(email) => setSuccessData({ type: 'login', email })}
                      onError={setErrorMsg}
                    />
                  </AnimatePresence>
                </Tab>

                <Tab key="register" title="Registrati">
                  <AnimatePresence mode="wait">
                    <RegisterForm
                      redirectUrl={activeRedirectUrl}
                      onSuccess={(email, contactPerson) => setSuccessData({ type: 'register', email, contactPerson })}
                      onError={setErrorMsg}
                    />
                  </AnimatePresence>
                </Tab>
              </Tabs>

              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="pt-2"
                  >
                    <Alert color="danger" variant="flat" title={errorMsg} hideIcon />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}