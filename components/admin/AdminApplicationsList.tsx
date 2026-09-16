import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardHeader, CardBody, Chip, Button, Divider } from '@heroui/react'
import { AlertModal } from '@components/shared/AlertModal'

interface AdminApplicationsListProps {
  initialApplications: any[]
}

export function AdminApplicationsList({ initialApplications }: AdminApplicationsListProps) {
  const [applications, setApplications] = useState(initialApplications)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Stato per la modale di Alert condivisa
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

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
        showAlert('Errore', 'Errore durante l\'aggiornamento dello stato.', true)
      }
    } catch {
      showAlert('Errore', 'Errore di connessione. Riprova più tardi.', true)
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
    <>
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

      <AlertModal
        isOpen={alertInfo.isOpen}
        onOpenChange={(open) => setAlertInfo({ ...alertInfo, isOpen: open })}
        title={alertInfo.title}
        message={alertInfo.message}
        isError={alertInfo.isError}
      />
    </>
  )
}