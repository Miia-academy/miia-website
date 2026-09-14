import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Card, CardBody, Input, Button, Alert } from '@heroui/react'
import { Logo } from '@public/logo'

export default function StudentLogin() {
  const router = useRouter()
  const redirectUrl = (router.query.redirectUrl as string) || '/studenti/profilo'

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectUrl }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setErrorMsg(data.message || 'Email non trovata.')
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
      <Head>
        <title>Accesso Studenti | MIIA</title>
      </Head>

      <div className="absolute top-0 right-0 left-0 z-10 flex justify-center p-6">
        <Logo classes="h-8 sm:h-12" primary="#171717" secondary="#009245" />
      </div>

      <Card className="w-full max-w-lg rounded-3xl shadow-sm border border-neutral-200 relative z-20" shadow="none">
        <CardBody className="p-5 sm:p-8 space-y-6 sm:space-y-8">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">Area Studenti</h1>
            <p className="text-sm text-neutral-500 mt-2">
              {router.query.redirectUrl
                ? 'Accedi per visualizzare i dettagli di questa inserzione.'
                : 'Inserisci la tua email per ricevere il Magic Link.'}
            </p>
          </div>

          {success ? (
            <Alert color="success" variant="flat" className="py-4">
              Controlla la posta! Ti abbiamo inviato il link di accesso.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-6">
              <Input
                type="email"
                label="Email"
                placeholder="es. nome.cognome@email.it"
                isRequired
                value={email}
                onValueChange={setEmail}
                variant="flat"
                classNames={{ inputWrapper: "h-14" }}
              />
              <Button type="submit" isLoading={loading} color="primary" className="h-14 font-bold shadow-sm text-base">
                Invia Magic Link
              </Button>
              {errorMsg && <Alert color="danger" variant="flat">{errorMsg}</Alert>}
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  )
}