import React, { useState } from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/router'
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Input,
  Select,
  SelectItem,
  Button,
  Alert,
} from '@heroui/react'
import { motion, AnimatePresence } from 'framer-motion'

interface AuthGateProps {
  onSuccess?: () => void
}

type AuthTab = 'login' | 'student' | 'company'

export default function AuthGate({ onSuccess }: AuthGateProps) {
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState<AuthTab>('login')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Stato per bloccare la form e mostrare la schermata d'istruzioni finale
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false)
  const [successNotice, setSuccessNotice] = useState<{
    title: string
    email: string
    instructions: string
  } | null>(null)

  // State File Logo per Azienda
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [loginForm, setLoginForm] = useState({ email: '' })

  // Studente: Nome, Cognome, Email, Telefono, Area
  const [studentForm, setStudentForm] = useState({
    nome: '',
    cognome: '',
    email: '',
    sms: '',
    area: 'interni',
  })

  // Azienda: Nome Azienda, Email, Telefono, Area
  const [companyForm, setCompanyForm] = useState({
    nome: '',
    email: '',
    sms: '',
    area: 'interni',
  })

  const resetFeedback = () => {
    setErrorMsg(null)
  }

  // Helper per convertire il file logo in Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  // 1. Submit Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetFeedback()

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginForm.email,
          redirectUrl: router.asPath,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessNotice({
          title: 'Link di accesso inviato!',
          email: loginForm.email,
          instructions:
            'Abbiamo inviato un Magic Link al tuo indirizzo email. Clicca sul pulsante contenuto nella mail per accedere all’area riservata.',
        })
        setIsSubmitted(true)
      } else {
        setErrorMsg(
          data.message ||
          'Impossibile inviare il link di accesso. Riprova con un’altra email.'
        )
      }
    } catch {
      setErrorMsg('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  // 2. Submit Studente
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetFeedback()

    try {
      const res = await fetch('/api/auth/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: studentForm.nome,
          cognome: studentForm.cognome,
          email: studentForm.email,
          sms: studentForm.sms,
          area: studentForm.area,
          redirectUrl: router.asPath,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessNotice({
          title: 'Registrazione Studente completata!',
          email: studentForm.email,
          instructions:
            'Ti abbiamo inviato un’email di verifica. Clicca sul Magic Link contenuto nella mail per confermare il tuo profilo ed accedere al portale.',
        })
        setIsSubmitted(true)
      } else {
        setErrorMsg(data.message || 'Errore durante la registrazione.')
      }
    } catch {
      setErrorMsg('Errore di rete. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  // 3. Submit Azienda
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetFeedback()

    try {
      let logoBase64 = ''
      let logoFileName = ''
      let logoMimeType = ''

      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile)
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const res = await fetch('/api/auth/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: companyForm.nome, // Nome Azienda
          email: companyForm.email,
          sms: companyForm.sms,
          settore: companyForm.area,
          logoBase64,
          logoFileName,
          logoMimeType,
          redirectUrl: router.asPath,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setSuccessNotice({
          title: 'Richiesta aziendale ricevuta!',
          email: companyForm.email,
          instructions:
            'Ti abbiamo inviato una mail di conferma con il tuo Magic Link di accesso. Controlla la casella di posta per proseguire.',
        })
        setIsSubmitted(true)
      } else {
        setErrorMsg(
          data?.message || 'Errore durante la registrazione dell’azienda.'
        )
      }
    } catch {
      setErrorMsg('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full py-4">
      <Card
        shadow="none"
        className="mx-auto max-w-lg bg-white p-4 dark:bg-neutral-900 sm:p-6 rounded-3xl border border-neutral-200/60 dark:border-neutral-800"
      >
        <CardBody className="space-y-5 px-1 sm:px-2">
          {/* HEADER DELLA CARD */}
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
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Accedi o iscriviti per gestire e consultare le offerte di lavoro.
            </p>
          </div>

          {/* VISTA 1: SCHERMATA DI SUCCESSO CON ISTRUZIONI */}
          {isSubmitted && successNotice ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center text-center py-6 px-2 space-y-4"
            >
              <div className="w-16 h-16 bg-[#009245]/10 text-[#009245] rounded-full flex items-center justify-center text-3xl mb-1">
                ✉️
              </div>

              <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                {successNotice.title}
              </h3>

              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-sm">
                {successNotice.instructions}
              </p>

              <div className="w-full bg-neutral-100 dark:bg-neutral-800 p-3.5 rounded-2xl text-xs font-mono text-neutral-700 dark:text-neutral-300 break-all my-2 border border-neutral-200/50 dark:border-neutral-700/50">
                {successNotice.email}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  as={NextLink}
                  href="/"
                  className="w-full bg-[#009245] text-white font-medium h-11 rounded-xl"
                >
                  Torna alla Homepage
                </Button>
                <Button
                  variant="flat"
                  onClick={() => {
                    setIsSubmitted(false)
                    setSuccessNotice(null)
                  }}
                  className="w-full bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium h-11 rounded-xl"
                >
                  Invia nuova richiesta
                </Button>
              </div>
            </motion.div>
          ) : (
            /* VISTA 2: FORM CON TABS */
            <>
              <Tabs
                selectedKey={selectedTab}
                onSelectionChange={(key) => {
                  setSelectedTab(key as AuthTab)
                  resetFeedback()
                }}
                color="success"
                variant="underlined"
                fullWidth
                classNames={{
                  tabList:
                    'border-b border-neutral-200 dark:border-neutral-800 gap-6 p-0',
                  cursor: 'w-full bg-[#009245]',
                  tab: 'max-w-fit px-0 h-10',
                  tabContent:
                    'group-data-[selected=true]:font-bold text-sm text-neutral-700 dark:text-neutral-200 group-data-[selected=true]:text-[#009245]',
                }}
              >
                {/* TAB 1: ACCEDI */}
                <Tab key="login" title="Accedi">
                  <AnimatePresence mode="wait">
                    <motion.form
                      key="login-form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={handleLoginSubmit}
                      className="flex flex-col gap-3 pt-3"
                    >
                      <Input
                        type="email"
                        label="Email"
                        placeholder="mario.rossi@example.com"
                        isRequired
                        variant="flat"
                        className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl"
                        value={loginForm.email}
                        onValueChange={(email) => setLoginForm({ email })}
                      />
                      <div className="flex gap-2 mt-2">
                        <Button
                          type="submit"
                          isLoading={loading}
                          className="bg-[#009245] text-white font-medium px-6 h-11 rounded-xl"
                        >
                          Invia Magic Link
                        </Button>
                        <Button
                          as={NextLink}
                          href="/"
                          variant="flat"
                          className="bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium px-6 h-11 rounded-xl"
                        >
                          Annulla
                        </Button>
                      </div>
                    </motion.form>
                  </AnimatePresence>
                </Tab>

                {/* TAB 2: STUDENTE */}
                <Tab key="student" title="Studente">
                  <AnimatePresence mode="wait">
                    <motion.form
                      key="student-form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={handleStudentSubmit}
                      className="flex flex-col gap-3 pt-3"
                    >
                      <Input
                        label="Nome"
                        isRequired
                        variant="flat"
                        value={studentForm.nome}
                        onValueChange={(val) =>
                          setStudentForm({ ...studentForm, nome: val })
                        }
                      />
                      <Input
                        label="Cognome"
                        isRequired
                        variant="flat"
                        value={studentForm.cognome}
                        onValueChange={(val) =>
                          setStudentForm({ ...studentForm, cognome: val })
                        }
                      />
                      <Input
                        type="email"
                        label="Email"
                        isRequired
                        variant="flat"
                        value={studentForm.email}
                        onValueChange={(val) =>
                          setStudentForm({ ...studentForm, email: val })
                        }
                      />
                      <Input
                        type="tel"
                        label="Telefono"
                        placeholder="+39 789 43 21 234"
                        variant="flat"
                        value={studentForm.sms}
                        onValueChange={(val) =>
                          setStudentForm({ ...studentForm, sms: val })
                        }
                      />

                      <Select
                        label="Area d'interesse"
                        variant="flat"
                        selectedKeys={[studentForm.area]}
                        onChange={(e) =>
                          setStudentForm({
                            ...studentForm,
                            area: e.target.value,
                          })
                        }
                      >
                        <SelectItem key="interni">Interni</SelectItem>
                        <SelectItem key="moda">Moda</SelectItem>
                      </Select>

                      <div className="flex gap-2 mt-2">
                        <Button
                          type="submit"
                          isLoading={loading}
                          className="bg-[#009245] text-white font-medium px-6 h-11 rounded-xl"
                        >
                          Invia
                        </Button>
                        <Button
                          as={NextLink}
                          href="/"
                          variant="flat"
                          className="bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium px-6 h-11 rounded-xl"
                        >
                          Annulla
                        </Button>
                      </div>
                    </motion.form>
                  </AnimatePresence>
                </Tab>

                {/* TAB 3: AZIENDA */}
                <Tab key="company" title="Azienda">
                  <AnimatePresence mode="wait">
                    <motion.form
                      key="company-form"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                      onSubmit={handleCompanySubmit}
                      className="flex flex-col gap-3 pt-3"
                    >
                      <Input
                        label="Nome Azienda"
                        isRequired
                        variant="flat"
                        value={companyForm.nome}
                        onValueChange={(val) =>
                          setCompanyForm({ ...companyForm, nome: val })
                        }
                      />
                      <Input
                        type="email"
                        label="Email Aziendale"
                        isRequired
                        variant="flat"
                        value={companyForm.email}
                        onValueChange={(val) =>
                          setCompanyForm({ ...companyForm, email: val })
                        }
                      />
                      <Input
                        type="tel"
                        label="Telefono"
                        variant="flat"
                        value={companyForm.sms}
                        onValueChange={(val) =>
                          setCompanyForm({ ...companyForm, sms: val })
                        }
                      />

                      <Select
                        label="Area"
                        variant="flat"
                        selectedKeys={[companyForm.area]}
                        onChange={(e) =>
                          setCompanyForm({
                            ...companyForm,
                            area: e.target.value,
                          })
                        }
                      >
                        <SelectItem key="interni">Interni</SelectItem>
                        <SelectItem key="moda">Moda</SelectItem>
                      </Select>

                      <div className="flex flex-col gap-1 w-full pt-1">
                        <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                          Logo Aziendale (Opzionale)
                        </label>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp, image/svg+xml"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setLogoFile(e.target.files[0])
                            }
                          }}
                          className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-neutral-100 dark:file:bg-neutral-800 file:text-neutral-700 dark:file:text-neutral-300 hover:file:bg-neutral-200 cursor-pointer"
                        />
                      </div>

                      <div className="flex gap-2 mt-2">
                        <Button
                          type="submit"
                          isLoading={loading}
                          className="bg-[#009245] text-white font-medium px-6 h-11 rounded-xl"
                        >
                          Invia
                        </Button>
                        <Button
                          as={NextLink}
                          href="/"
                          variant="flat"
                          className="bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 font-medium px-6 h-11 rounded-xl"
                        >
                          Annulla
                        </Button>
                      </div>
                    </motion.form>
                  </AnimatePresence>
                </Tab>
              </Tabs>

              {/* FEEDBACK ERRORE */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <Alert
                      color="danger"
                      variant="flat"
                      title={errorMsg}
                      hideIcon
                    />
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