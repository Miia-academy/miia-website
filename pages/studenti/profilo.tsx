import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getStudentApplications } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'
import { Input, Button, Chip, Card, CardBody, CardHeader, Select, SelectItem } from '@heroui/react'
import { useDataContext } from '@modules/context'

interface StudentProfileProps {
  user: {
    email: string
    name: string
    surname: string
    provincia: string
    competenze: string[]
    cv_url: string
  }
  applications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function StudentProfile({ user, applications }: StudentProfileProps) {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)

  // Inizializziamo il form includendo provincia e skills
  const [form, setForm] = useState({
    name: user.name || '',
    surname: user.surname || '',
    provincia: user.provincia || '',
    skills: new Set<string>(user.competenze || []),
    cv_url: user.cv_url || '',
  })

  const [file, setFile] = useState<File | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let cvBase64 = ''
      let cvFileName = ''
      let cvMimeType = ''

      if (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert("Il file è troppo grande. Dimensione massima 5MB.")
          setLoading(false)
          return
        }

        cvBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(file)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = (error) => reject(error)
        })
        cvFileName = file.name
        cvMimeType = file.type
      }

      const payload = {
        attributes: {
          NOME: form.name,
          COGNOME: form.surname,
          PROVINCIA: form.provincia.toUpperCase(),
          COMPETENZE: Array.from(form.skills),
        },
        cvBase64,
        cvFileName,
        cvMimeType,
      }

      const res = await fetch('/api/user/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        alert('Profilo e CV aggiornati con successo!')
        setFile(null)
      } else {
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
      {/* HEADER DELLA PAGINA CON LINK ALLA BACHECA */}
      <div className="mx-auto max-w-5xl mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Area Studente
        </h1>
        <Button
          as={Link}
          href="/lavoro/inserzioni"
          className="bg-[#009245] text-white font-bold shadow-sm"
        >
          Vai alla Bacheca Inserzioni &rarr;
        </Button>
      </div>

      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonna Sinistra: Dati e CV */}
        <div className="lg:col-span-1 space-y-6">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-6 font-bold text-xl text-neutral-900">
              I Tuoi Dati
            </CardHeader>
            <CardBody className="px-6 pb-6 space-y-4">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  label="Email"
                  value={user.email}
                  isReadOnly
                  variant="flat"
                  className="opacity-70"
                />

                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="Nome"
                    value={form.name}
                    onValueChange={(v) => setForm({ ...form, name: v })}
                    variant="flat"
                  />
                  <Input
                    label="Cognome"
                    value={form.surname}
                    onValueChange={(v) => setForm({ ...form, surname: v })}
                    variant="flat"
                  />
                </div>

                {/* Nuovi Campi Provincia e Competenze */}
                <div className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4">
                  <Input
                    label="Provincia (Sigla)"
                    placeholder="Es. MI, RM"
                    maxLength={2}
                    value={form.provincia}
                    onValueChange={(v) => setForm({ ...form, provincia: v.toUpperCase() })}
                    variant="flat"
                  />
                  <Select
                    label="Le tue Competenze"
                    selectionMode="multiple"
                    variant="flat"
                    selectedKeys={form.skills}
                    onSelectionChange={(keys) => setForm({ ...form, skills: keys as Set<string> })}
                  >
                    {(competenze || []).map((skill: any) => (
                      <SelectItem key={skill.value || skill.name}>
                        {skill.name || skill.value}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="pt-4 border-t border-neutral-100">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Curriculum Vitae (PDF)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#009245]/10 file:text-[#009245] hover:file:bg-[#009245]/20 transition-colors"
                  />
                  {form.cv_url && !file && (
                    <a href={form.cv_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                      Visualizza il CV attualmente caricato
                    </a>
                  )}
                </div>

                <Button
                  type="submit"
                  isLoading={loading}
                  className="w-full bg-black text-white font-bold mt-4"
                >
                  Salva Profilo
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Colonna Destra: Storico Candidature */}
        <div className="lg:col-span-2">
          <Card shadow="sm" className="border border-neutral-200 min-h-full">
            <CardHeader className="pt-6 px-6 font-bold text-xl text-neutral-900 border-b border-neutral-100 pb-4">
              Le Mie Candidature
            </CardHeader>
            <CardBody className="p-0">
              {applications.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center">
                  <p className="text-neutral-500 mb-4">Non ti sei ancora candidato a nessuna offerta.</p>
                  <Button
                    as={Link}
                    href="/lavoro/inserzioni"
                    variant="flat"
                    color="primary"
                    className="font-semibold"
                  >
                    Esplora le Opportunità
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {applications.map((app) => (
                    <div key={app.application_id} className="p-6 hover:bg-neutral-50 transition-colors flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-neutral-900">{app.title}</h4>
                        <p className="text-xs text-neutral-500 mt-1 flex items-center gap-2">
                          <span className="uppercase font-semibold">{app.provincia}</span> •
                          Candidato il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div className="text-right">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={
                            app.status === 'letta' ? 'success' :
                              app.status === 'rifiutata' ? 'danger' : 'primary'
                          }
                        >
                          {app.status.replace('_', ' ')}
                        </Chip>
                        {app.job_status !== 'attiva' && (
                          <p className="text-[10px] text-red-500 font-semibold mt-2">Annuncio chiuso</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

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
    return { redirect: { destination: '/studenti/login?redirect=/studenti/profilo', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Studente') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const applications = await getStudentApplications(decoded.email)

    // Estraiamo in modo sicuro Provincia e Competenze dal token aggiornato dalla nostra API
    const userProvincia = (decoded as any).provincia || ''
    const userCompetenze = Array.isArray((decoded as any).competenze) ? (decoded as any).competenze : []

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
          surname: decoded.surname || '',
          provincia: userProvincia,
          competenze: userCompetenze,
          cv_url: decoded.cv_url || '',
        },
        applications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch (error) {
    return { redirect: { destination: '/studenti/login', permanent: false } }
  }
}