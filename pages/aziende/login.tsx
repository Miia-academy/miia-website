import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Tabs, Tab, Input, Button, Alert, Checkbox } from '@heroui/react'

// Utility per convertire il logo in Base64
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
  // Default redirect alla dashboard operativa delle inserzioni
  const redirectUrl = (router.query.redirectUrl as string) || '/aziende/inserzioni'

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // State form di registrazione
  const [regForm, setRegForm] = useState({
    nome: '',
    contact_person: '',
    email: '',
    termsAccepted: false,
    newsletter: false,
  })
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // State form login
  const [loginEmail, setLoginEmail] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Aggiunto tipo_utente: 'Azienda' nel payload
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

    setLoading(true)
    setErrorMsg(null)

    try {
      let logoBase64 = '', logoFileName = '', logoMimeType = ''
      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile)
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const payload = { ...regForm, logoBase64, logoFileName, logoMimeType, redirectUrl }

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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <Head><title>Area Aziende | MIIA</title></Head>

      <div className="w-full max-w-lg bg-white p-6 rounded-3xl shadow-sm border border-neutral-200">
        <h1 className="text-2xl font-bold mb-6 text-center">Area Riservata Aziende</h1>

        {successMsg ? (
          <Alert color="success" variant="flat">{successMsg}</Alert>
        ) : (
          <Tabs selectedKey={mode} onSelectionChange={(k) => { setMode(k as any); setErrorMsg(null); }} fullWidth>
            <Tab key="login" title="Accedi">
              <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-4">
                <Input type="email" label="Email Aziendale" isRequired value={loginEmail} onValueChange={setLoginEmail} />
                <Button type="submit" isLoading={loading} color="primary" className="h-12 font-medium">Invia Link di Accesso</Button>
              </form>
            </Tab>

            <Tab key="register" title="Registrati">
              <form onSubmit={handleRegister} className="flex flex-col gap-4 mt-4 h-96 overflow-y-auto p-1">
                <Input label="Nome Azienda" isRequired value={regForm.nome} onValueChange={v => setRegForm({ ...regForm, nome: v })} />
                <Input label="Nome Referente" isRequired value={regForm.contact_person} onValueChange={v => setRegForm({ ...regForm, contact_person: v })} />
                <Input type="email" label="Email Aziendale" isRequired value={regForm.email} onValueChange={v => setRegForm({ ...regForm, email: v })} />

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-neutral-600">Logo Aziendale (Opzionale)</label>
                  <input type="file" accept="image/*" onChange={(e) => e.target.files && setLogoFile(e.target.files[0])} />
                </div>

                <Checkbox isSelected={regForm.termsAccepted} onValueChange={v => setRegForm({ ...regForm, termsAccepted: v })}>
                  <span className="text-sm">Accetto i termini di collaborazione</span>
                </Checkbox>

                <Button type="submit" isLoading={loading} color="primary" className="h-12 font-medium">Invia Richiesta</Button>
              </form>
            </Tab>
          </Tabs>
        )}

        {errorMsg && <Alert color="danger" variant="flat" className="mt-4">{errorMsg}</Alert>}
      </div>
    </div>
  )
}