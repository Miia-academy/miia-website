import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { Card, CardHeader, CardBody, Input, Button } from '@heroui/react'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.ok) {
        // Redirezione alla dashboard operativa in caso di successo
        router.push('/admin/profilo')
      } else {
        const data = await res.json()
        setError(data.message || 'Credenziali non valide.')
      }
    } catch (err) {
      setError('Errore di connessione al server. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <Card shadow="sm" className="w-full max-w-md border border-neutral-200">
        <CardHeader className="flex flex-col items-center pt-10 pb-4">
          <div className="w-14 h-14 bg-neutral-900 text-white rounded-2xl flex items-center justify-center text-2xl font-black mb-5 shadow-sm">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Area Backoffice</h1>
          <p className="text-sm text-neutral-500 mt-1">Accesso riservato all'amministrazione</p>
        </CardHeader>

        <CardBody className="px-8 pb-10">
          <form onSubmit={handleLogin} className="space-y-6">

            {/* Banner di errore */}
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm font-medium border border-red-100 text-center">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                type="email"
                label="Email Amministratore"
                variant="flat"
                isRequired
                value={email}
                onValueChange={setEmail}
                classNames={{ input: "font-medium" }}
              />
              <Input
                type="password"
                label="Password"
                variant="flat"
                isRequired
                value={password}
                onValueChange={setPassword}
                classNames={{ input: "font-medium" }}
              />
            </div>

            <Button
              type="submit"
              isLoading={loading}
              className="w-full bg-neutral-900 text-white font-bold h-12 shadow-sm"
            >
              Accedi al Gestionale
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}