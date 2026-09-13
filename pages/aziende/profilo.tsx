import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import jwt from 'jsonwebtoken'
import type { AuthPayload } from '@modules/auth'
import { Input, Button, Card, CardBody, CardHeader, Divider } from '@heroui/react'

interface BusinessProfileProps {
  user: {
    email: string
    company: string
    name: string
    surname: string
    vatNumber: string
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessProfile({ user }: BusinessProfileProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company: user.company || '',
    name: user.name || '',
    surname: user.surname || '',
    vatNumber: user.vatNumber || '',
  })

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Mappiamo i dati del form sui nomi attesi dall'API business.ts
      const payload = {
        nome: form.company, // Ragione Sociale
        contact_person: `${form.name} ${form.surname}`.trim(), // Nome e Cognome uniti
        // Se in futuro aggiungerai questi campi al form, l'API è già pronta:
        // address: form.address,
        // website: form.website,
        // area: form.area,
        // description: form.description
      }

      const res = await fetch('/api/user/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        alert('Dati aziendali aggiornati con successo su Brevo!')
      } else {
        const data = await res.json()
        alert(data.message || 'Errore durante l\'aggiornamento.')
      }
    } catch (error) {
      alert('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900 mb-8">
          Profilo Aziendale
        </h1>

        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 font-bold text-xl text-neutral-900">
            Dati Anagrafici e Referente
          </CardHeader>
          <Divider className="my-2" />
          <CardBody className="px-6 pb-6">
            <form onSubmit={handleUpdateProfile} className="space-y-6">

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-neutral-500 tracking-wider">Azienda</h3>
                <Input
                  label="Email di Accesso"
                  value={user.email}
                  isReadOnly
                  variant="flat"
                  className="opacity-70"
                />
                <Input
                  label="Ragione Sociale / Nome Azienda"
                  isRequired
                  value={form.company}
                  onValueChange={(v) => setForm({ ...form, company: v })}
                  variant="flat"
                />
                <Input
                  label="Partita IVA"
                  value={form.vatNumber}
                  onValueChange={(v) => setForm({ ...form, vatNumber: v })}
                  variant="flat"
                />
              </div>

              <Divider />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase text-neutral-500 tracking-wider">Referente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nome Referente"
                    value={form.name}
                    onValueChange={(v) => setForm({ ...form, name: v })}
                    variant="flat"
                  />
                  <Input
                    label="Cognome Referente"
                    value={form.surname}
                    onValueChange={(v) => setForm({ ...form, surname: v })}
                    variant="flat"
                  />
                </div>
              </div>

              <Button
                type="submit"
                isLoading={loading}
                className="w-full bg-[#009245] text-white font-bold mt-4"
              >
                Salva Modifiche
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// SERVER-SIDE LOGIC
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/aziende/login?redirect=/aziende/profilo', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Azienda') {
      return { redirect: { destination: '/', permanent: false } }
    }

    return {
      props: {
        user: {
          email: decoded.email,
          company: decoded.company || '',
          name: decoded.name || '',
          surname: decoded.surname || '',
          vatNumber: (decoded as any).vatNumber || '',
        },
      },
    }
  } catch (error) {
    return { redirect: { destination: '/aziende/login', permanent: false } }
  }
}