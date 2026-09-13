// pages/aziende/inserzioni.tsx
import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import jwt from 'jsonwebtoken'
import { getBusinessJobs } from '@modules/jobs/db'
import type { JobWithApplicantsCount } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { CreateJobModal } from '@components/business/CreateJobModal'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from '@heroui/react'

interface BusinessDashboardProps {
  user: {
    email: string
    company: string
  }
  initialJobs: JobWithApplicantsCount[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessDashboard({ user, initialJobs }: BusinessDashboardProps) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Stato per l'Alert Modale UI
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  // Aggiorna lo stato (attiva/chiusa)
  const handleToggleStatus = async (jobId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'attiva' ? 'chiusa' : 'attiva'
    setActionLoading(jobId)

    try {
      const res = await fetch(`/api/job/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!res.ok) throw new Error()
      router.replace(router.asPath)
    } catch {
      showAlert('Errore', 'Impossibile aggiornare lo stato dell\'inserzione', true)
    } finally {
      setActionLoading(null)
    }
  }

  // Elimina inserzione
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa inserzione?')) return
    setActionLoading(jobId)

    try {
      const res = await fetch(`/api/job/${jobId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.replace(router.asPath)
    } catch {
      showAlert('Errore', 'Impossibile eliminare l\'annuncio', true)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-200 pb-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard Inserzioni</h1>
            <p className="mt-1 text-sm text-gray-500">
              Azienda: <span className="font-semibold text-gray-800">{user.company || user.email}</span>
            </p>
          </div>
          <Button
            onPress={() => setIsModalOpen(true)}
            className="mt-4 md:mt-0 bg-[#009245] text-white font-semibold shadow"
          >
            + Nuova Inserzione
          </Button>
        </div>

        {/* Tabella Inserzioni */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Le Tue Inserzioni</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500 border-b">
                <tr>
                  <th className="px-6 py-3">Titolo</th>
                  <th className="px-6 py-3">Provincia</th>
                  <th className="px-6 py-3">Competenze</th>
                  <th className="px-6 py-3">Candidati</th>
                  <th className="px-6 py-3">Stato</th>
                  <th className="px-6 py-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {initialJobs.length > 0 ? (
                  initialJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{job.title}</td>
                      <td className="px-6 py-4 font-semibold uppercase">{job.provincia}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {job.competenze?.slice(0, 3).map((c) => (
                            <Chip key={c} size="sm" variant="flat" className="text-[10px] text-gray-700 bg-gray-100">
                              {c}
                            </Chip>
                          ))}
                          {(job.competenze?.length || 0) > 3 && (
                            <span className="text-[10px] text-gray-400">+{job.competenze.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-black">{job.applicant_count}</td>
                      <td className="px-6 py-4">
                        <Chip size="sm" variant="flat" color={job.status === 'attiva' ? 'success' : 'default'}>
                          {job.status === 'attiva' ? 'Attiva' : 'Chiusa'}
                        </Chip>
                      </td>
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handleToggleStatus(job.id, job.status)}
                          className="text-xs font-semibold text-gray-600 hover:text-black"
                        >
                          {job.status === 'attiva' ? 'Disattiva' : 'Attiva'}
                        </button>
                        <button
                          disabled={actionLoading === job.id}
                          onClick={() => handleDeleteJob(job.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Elimina
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      Nessun annuncio creato finora. Clicca su "+ Nuova Inserzione" per iniziare.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modale Creazione Inserzione */}
        <CreateJobModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => router.replace(router.asPath)}
          showAlert={showAlert}
        />

        {/* Modale di Alert UI */}
        <Modal isOpen={alertInfo.isOpen} onOpenChange={(open) => setAlertInfo({ ...alertInfo, isOpen: open })} backdrop="blur">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className={`text-xl font-bold ${alertInfo.isError ? 'text-red-600' : 'text-[#009245]'}`}>
                  {alertInfo.title}
                </ModalHeader>
                <ModalBody>
                  <p className="text-neutral-700">{alertInfo.message}</p>
                </ModalBody>
                <ModalFooter>
                  <Button color={alertInfo.isError ? 'danger' : 'primary'} onPress={onClose}>
                    OK
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/login?redirect=/aziende/inserzioni', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
    if (decoded.tipo_utente !== 'Azienda') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const initialJobs = await getBusinessJobs(decoded.email)

    return {
      props: {
        user: { email: decoded.email, company: decoded.company || '' },
        initialJobs: JSON.parse(JSON.stringify(initialJobs)),
      },
    }
  } catch (error) {
    return { redirect: { destination: '/login', permanent: false } }
  }
}