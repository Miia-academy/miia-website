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
        <CardHeader className="py-4 px-6 flex justify-between items-center">
          <h2 className="text-lg font-bold text-neutral-900">Gestione Candidature</h2>
          <span className="text-xs font-semibold text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
            Totale: {applications.length}
          </span>
        </CardHeader>
        <Divider />
        <CardBody className="p-4 sm:p-6 bg-neutral-50/50">
          {applications.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm bg-white rounded-xl border border-neutral-200">
              Nessuna candidatura presente a sistema.
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => {
                const isRifiutata = app.status === 'rifiutata'

                return (
                  <div
                    key={app.application_id}
                    className={`p-4 rounded-xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${isRifiutata
                      ? 'bg-neutral-100/80 border-neutral-200 shadow-2xs'
                      : 'bg-white border-neutral-200 hover:border-neutral-300 shadow-2xs'
                      }`}
                  >
                    <div className="flex-1 space-y-2 min-w-0">
                      {/* RIGA 1: Stato + Titolo Inserzione + Azienda + Studente */}
                      <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={getStatusColor(app.status)}
                          className="uppercase font-bold text-[10px] tracking-wider shrink-0 h-5 min-h-5"
                        >
                          {app.status.replace('_', ' ')}
                        </Chip>

                        {app.job_id ? (
                          <Link
                            href={`/lavoro/inserzioni/${app.job_id}`}
                            target="_blank"
                            className="font-bold text-neutral-900 hover:text-[#009245] hover:underline transition-colors truncate max-w-[280px]"
                          >
                            {app.job_title}
                          </Link>
                        ) : (
                          <span className="font-bold text-neutral-900 truncate">{app.job_title}</span>
                        )}

                        <span className="text-neutral-300 font-light hidden sm:inline">|</span>

                        <span className="text-neutral-500 text-xs truncate">
                          Azienda: <span className="font-medium text-neutral-700">{app.company_email}</span>
                        </span>

                        <span className="text-neutral-300 font-light hidden sm:inline">|</span>

                        <span className="text-neutral-500 text-xs truncate">
                          Studente:{' '}
                          <Link
                            href={`/admin/studenti/${encodeURIComponent(app.student_email)}`}
                            className="font-semibold text-emerald-700 hover:underline"
                          >
                            {app.student_email}
                          </Link>
                        </span>
                      </div>

                      {/* RIGA 2: Data Candidatura + Badges Tracciamento */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-[11px] text-neutral-400 font-medium mr-1">
                          Candidato il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                        </span>

                        {app.viewed_at ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            ✓ Letto il {new Date(app.viewed_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                            ● Non letto dall'azienda
                          </span>
                        )}

                        {app.cv_downloaded_at ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                            📄 CV Scaricato il {new Date(app.cv_downloaded_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded">
                            CV non scaricato
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AZIONI */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        as={Link}
                        href={`/admin/studenti/${encodeURIComponent(app.student_email)}`}
                        variant="flat"
                        size="sm"
                        className="font-semibold text-xs h-8"
                      >
                        Vedi Profilo
                      </Button>

                      {app.status === 'in_revisione' && (
                        <>
                          <Button
                            color="danger"
                            variant="flat"
                            size="sm"
                            isLoading={loadingId === app.application_id}
                            onPress={() => handleUpdateStatus(app.application_id, 'rifiutata')}
                            className="font-bold text-xs h-8"
                          >
                            Rifiuta
                          </Button>
                          <Button
                            color="success"
                            size="sm"
                            isLoading={loadingId === app.application_id}
                            onPress={() => handleUpdateStatus(app.application_id, 'validata')}
                            className="text-white font-bold text-xs h-8 bg-[#009245]"
                          >
                            Valida
                          </Button>
                        </>
                      )}

                      {isRifiutata && (
                        <Button
                          color="success"
                          variant="solid"
                          size="sm"
                          isLoading={loadingId === app.application_id}
                          onPress={() => handleUpdateStatus(app.application_id, 'validata')}
                          className="font-bold text-xs h-8 text-white bg-[#009245]"
                        >
                          Rivalida Candidatura
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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