import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Tabs, Tab, Input, Button, Alert, Checkbox } from '@heroui/react'
import { Logo } from '@public/logo'

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = error => reject(error)
  })
}

export default function CompanyLogin() {
  const router = useRouter()
  const redirectUrl = (router.query.redirectUrl as string) || '/aziende/profilo'

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [regForm, setRegForm] = useState({
    nome: '',
    contact_person: '',
    email: '',
    telefono: '',
    termsAccepted: false,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loginEmail, setLoginEmail] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, tipo_utente: 'Azienda', redirectUrl }),
      })
      if (res.ok) {
        setSuccessMsg('Controlla la tua casella email: ti abbiamo inviato il Magic Link per accedere.')
      } else {
        const data = await res.json()
        setErrorMsg(data.message || 'Email non trovata. Sicuro di esserti già registrato?')
      }
    } catch {
      setErrorMsg('Errore di rete. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!regForm.termsAccepted) {
      setErrorMsg('Devi accettare i termini per proseguire.')
      return
    }

    let finalPhone = regForm.telefono.trim()
    if (finalPhone && !finalPhone.startsWith('+')) {
      finalPhone = `+39${finalPhone}`
    }

    setLoading(true)
    setErrorMsg(null)

    try {
      let logoBase64 = '', logoFileName = '', logoMimeType = ''
      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile)
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const payload = { ...regForm, telefono: finalPhone, logoBase64, logoFileName, logoMimeType, redirectUrl }

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setSuccessMsg('Registrazione completata con successo! Riceverai un’email con il link di accesso.')
      } else {
        const data = await res.json()
        setErrorMsg(data.message || 'Errore durante la registrazione.')
      }
    } catch {
      setErrorMsg('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Aggiunto "relative" al wrapper principale per posizionare il logo
    <div className="relative min-h-screen flex items-center justify-center bg-neutral-50 p-4 overflow-x-hidden">
      <Head><title>Area Aziende | MIIA</title></Head>

      <div className="absolute top-0 right-0 left-0 z-10 flex justify-center p-6">
        <Logo classes="h-8 sm:h-12" primary="#171717" secondary="#009245" />
      </div>

      <div className="w-full max-w-lg bg-white p-5 sm:p-8 rounded-3xl shadow-sm border border-neutral-200 flex flex-col max-h-[90vh] relative z-20">
        <h1 className="text-2xl font-bold mb-6 text-center shrink-0">Area Riservata Aziende</h1>

        {successMsg ? (
          <Alert color="success" variant="flat">{successMsg}</Alert>
        ) : (
          <Tabs
            selectedKey={mode}
            onSelectionChange={(k) => { setMode(k as any); setErrorMsg(null); }}
            fullWidth
            variant="underlined"
            classNames={{ tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider" }}
          >
            <Tab key="login" title="Accedi">
              <form onSubmit={handleLogin} className="flex flex-col gap-5 mt-6 px-1">
                <Input type="email" label="Email Aziendale" isRequired value={loginEmail} onValueChange={setLoginEmail} variant="flat" />
                <Button type="submit" isLoading={loading} color="primary" className="h-12 font-bold shadow-sm">Invia Link di Accesso</Button>
              </form>
            </Tab>

            <Tab key="register" title="Registrati">
              <form onSubmit={handleRegister} className="flex flex-col mt-6 h-[50vh] min-h-[350px] max-h-[500px]">

                <div className="flex-1 overflow-y-auto px-1 pb-4 space-y-4">
                  <Input label="Nome Azienda" isRequired value={regForm.nome} onValueChange={v => setRegForm({ ...regForm, nome: v })} variant="flat" />
                  <Input label="Nome Referente" isRequired value={regForm.contact_person} onValueChange={v => setRegForm({ ...regForm, contact_person: v })} variant="flat" />
                  <Input type="email" label="Email Aziendale" isRequired value={regForm.email} onValueChange={v => setRegForm({ ...regForm, email: v })} variant="flat" />

                  <Input
                    type="tel"
                    label="Telefono Sede"
                    placeholder="Es. +39 02 123456"
                    description="Inserisci il prefisso internazionale (es. +39)"
                    value={regForm.telefono}
                    onValueChange={v => setRegForm({ ...regForm, telefono: v })}
                    variant="flat"
                  />

                  <div className="flex flex-col gap-2 pt-2 border-t border-neutral-100">
                    <label className="text-sm font-medium text-neutral-600">Logo Aziendale (Opzionale)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => e.target.files && setLogoFile(e.target.files[0])}
                      className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition-colors"
                    />
                  </div>

                  <div className="pt-2">
                    <Checkbox isSelected={regForm.termsAccepted} onValueChange={v => setRegForm({ ...regForm, termsAccepted: v })}>
                      <span className="text-sm text-neutral-600">Accetto i termini di collaborazione</span>
                    </Checkbox>
                  </div>
                </div>

                <div className="pt-4 border-t border-neutral-100 mt-auto shrink-0 bg-white px-1">
                  <Button type="submit" isLoading={loading} color="primary" className="w-full h-12 font-bold shadow-sm">
                    Invia Richiesta
                  </Button>
                </div>

              </form>
            </Tab>
          </Tabs>
        )}

        {errorMsg && <Alert color="danger" variant="flat" className="mt-4 shrink-0 mx-1">{errorMsg}</Alert>}
      </div>
    </div>
  )
}