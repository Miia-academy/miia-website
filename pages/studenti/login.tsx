import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { Card, CardBody, Input, Button, Alert } from '@heroui/react'

export default function StudentLogin() {
  const router = useRouter()
  // Catturiamo la rotta originale o impostiamo il profilo come default
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
      // Chiamata all'API esistente per l'invio del Magic Link
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
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
      <Head>
        <title>Accesso Studenti | MIIA</title>
      </Head>

      <Card className="w-full max-w-md p-4 rounded-3xl">
        <CardBody className="space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Area Studenti</h1>
            <p className="text-sm text-neutral-500 mt-2">
              {router.query.redirectUrl
                ? 'Accedi per visualizzare i dettagli di questa inserzione.'
                : 'Inserisci la tua email per ricevere il Magic Link.'}
            </p>
          </div>

          {success ? (
            <Alert color="success" variant="flat">
              Controlla la posta! Ti abbiamo inviato il link di accesso.
            </Alert>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                type="email"
                label="Email"
                isRequired
                value={email}
                onValueChange={setEmail}
              />
              <Button type="submit" isLoading={loading} color="primary" className="h-12 font-medium">
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