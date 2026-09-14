import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import jwt from 'jsonwebtoken'
import { getAllApplications } from '@modules/applications/db'
import { JobFormModal } from '@components/business/JobFormModal'
import type { AuthPayload } from '@modules/auth'
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  Button,
  Divider,
  useDisclosure,
} from '@heroui/react'

interface AdminProfileProps {
  user: { email: string }
  initialApplications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function AdminProfile({ user, initialApplications }: AdminProfileProps) {
  const router = useRouter()
  const [applications, setApplications] = useState(initialApplications)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Gestione Modale Inserzione condivisa con flag Admin
  const {
    isOpen: isJobOpen,
    onOpen: onJobOpen,
    onClose: onJobClose,
    onOpenChange: onJobOpenChange,
  } = useDisclosure()

  const handleUpdateStatus = async (applicationId: string, newStatus: string) => {
    setLoadingId(applicationId)
    try {
      const res = await fetch(`/api/admin/application/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setApplications((apps) =>
          apps.map((app) =>
            app.application_id === applicationId ? { ...app, status: newStatus } : app
          )
        )
      } else {
        alert('Errore durante l\'aggiornamento dello stato.')
      }
    } catch {
      alert('Errore di connessione.')
    } finally {
      setLoadingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'validata':
        return 'success'
      case 'rifiutata':
        return 'danger'
      case 'letta':
        return 'primary'
      default:
        return 'warning'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">

        {/* Header Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Pannello Operativo
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Accesso come Admin: <span className="font-mono text-neutral-800">{user.email}</span>
            </p>
          </div>

          <Button color="primary" onPress={onJobOpen} className="font-bold text-white shadow-sm">
            + Nuova Inserzione
          </Button>
        </div>

        {/* Tabella Candidature */}
        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 pb-4">
            <h2 className="text-xl font-bold text-neutral-900">Gestione Candidature</h2>
          </CardHeader>
          <Divider />
          <CardBody className="p-0">
            {applications.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                Nessuna candidatura presente a sistema.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-neutral-50/50 transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={getStatusColor(app.status)}
                          className="uppercase font-bold text-[10px] tracking-wider"
                        >
                          {app.status.replace('_', ' ')}
                        </Chip>
                        <span className="text-xs text-neutral-400 font-medium">
                          {new Date(app.applied_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>

                      <div>
                        {app.job_id ? (
                          <Link
                            href={`/lavoro/inserzioni/${app.job_id}`}
                            target="_blank"
                            className="text-lg font-bold text-neutral-900 leading-tight hover:text-[#009245] hover:underline transition-colors"
                          >
                            {app.job_title}
                          </Link>
                        ) : (
                          <span className="text-lg font-bold text-neutral-900">{app.job_title}</span>
                        )}
                        <p className="text-sm text-neutral-500 mt-0.5">
                          Azienda: <span className="font-medium text-neutral-700">{app.company_email}</span>
                        </p>
                      </div>

                      <div className="text-sm pt-1">
                        Studente:{' '}
                        <Link
                          href={`/admin/studenti/${encodeURIComponent(app.student_email)}`}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          {app.student_email}
                        </Link>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <Button
                        as={Link}
                        href={`/admin/studenti/${encodeURIComponent(app.student_email)}`}
                        variant="flat"
                        className="font-semibold"
                      >
                        Vedi Profilo
                      </Button>

                      {app.status === 'in_revisione' && (
                        <>
                          <Button
                            color="danger"
                            variant="flat"
                            isLoading={loadingId === app.application_id}
                            onPress={() => handleUpdateStatus(app.application_id, 'rifiutata')}
                            className="font-bold"
                          >
                            Rifiuta
                          </Button>
                          <Button
                            color="success"
                            className="text-white font-bold"
                            isLoading={loadingId === app.application_id}
                            onPress={() => handleUpdateStatus(app.application_id, 'validata')}
                          >
                            Valida
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Modale Form Inserzione (Shared Component con modalità Admin) */}
        <JobFormModal
          isOpen={isJobOpen}
          onOpenChange={onJobOpenChange}
          onClose={onJobClose}
          isAdmin={true}
          onSuccess={() => {
            router.replace(router.asPath)
          }}
          showAlert={(title, message) => {
            alert(`${title}: ${message}`)
          }}
        />

      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Admin') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const applications = await getAllApplications()

    return {
      props: {
        user: { email: decoded.email },
        initialApplications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }
}