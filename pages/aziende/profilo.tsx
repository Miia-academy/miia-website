import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getBusinessJobs } from '@modules/jobs/db'
import type { JobWithApplicantsCount } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import {
  Input,
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter
} from '@heroui/react'
import { CreateJobModal } from '@components/business/CreateJobModal'
import { UpdateJobModal } from '@components/business/UpdateJobModal'
import { DeleteJobModal } from '@components/business/DeleteJobModal'
import { ApplicationsModal } from '@components/business/ApplicationsModal'

interface BusinessProfileDashboardProps {
  user: {
    email: string
    company: string
    name: string
    surname: string
    vatNumber: string
  }
  initialJobs: JobWithApplicantsCount[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessProfileDashboard({ user, initialJobs }: BusinessProfileDashboardProps) {
  const router = useRouter()

  // Stato form profilo aziendale
  const [profileLoading, setProfileLoading] = useState(false)
  const [form, setForm] = useState({
    company: user.company || '',
    name: user.name || '',
    surname: user.surname || '',
    vatNumber: user.vatNumber || '',
  })

  // Stati per le modali di gestione inserzioni
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isApplicationsOpen, setIsApplicationsOpen] = useState(false)

  const [selectedJob, setSelectedJob] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Feedback Alert UI Modal
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  // 1. Aggiornamento Profilo Aziendale (Sync su Brevo CRM)
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)

    try {
      const payload = {
        nome: form.company,
        contact_person: `${form.name} ${form.surname}`.trim(),
      }

      const res = await fetch('/api/user/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        showAlert('Successo', 'Dati aziendali aggiornati con successo!')
      } else {
        const data = await res.json()
        showAlert('Errore', data.message || 'Errore durante l\'aggiornamento del profilo.', true)
      }
    } catch {
      showAlert('Errore di Connessione', 'Riprova più tardi.', true)
    } finally {
      setProfileLoading(false)
    }
  }

  // 2. Toggle Stato Inserzione (Attiva / Chiusa)
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
      showAlert('Errore', 'Impossibile aggiornare lo stato dell\'inserzione.', true)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Header Dashboard */}
      <div className="mx-auto max-w-6xl mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Area Riservata Azienda
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Azienda: <span className="font-semibold text-neutral-800">{user.company || user.email}</span>
          </p>
        </div>
        <Button
          onPress={() => setIsCreateOpen(true)}
          className="bg-[#009245] text-white font-bold shadow-sm"
        >
          + Nuova Inserzione
        </Button>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Colonna Sinistra (1/3): Form Profilo e Referente */}
        <div className="lg:col-span-1 space-y-6">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-6 font-bold text-xl text-neutral-900">
              Dati Anagrafici
            </CardHeader>
            <Divider className="my-2" />
            <CardBody className="px-6 pb-6">
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-neutral-400 tracking-wider">Azienda</h3>
                  <Input
                    label="Email di Accesso"
                    value={user.email}
                    isReadOnly
                    variant="flat"
                    className="opacity-70"
                  />
                  <Input
                    label="Ragione Sociale"
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

                <Divider className="my-3" />

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase text-neutral-400 tracking-wider">Referente</h3>
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

                <Button
                  type="submit"
                  isLoading={profileLoading}
                  className="w-full bg-black text-white font-bold mt-4"
                >
                  Salva Modifiche Profilo
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        {/* Colonna Destra (2/3): Tabella Inserzioni Minimal */}
        <div className="lg:col-span-2">
          <Card shadow="sm" className="border border-neutral-200 min-h-full">
            <CardHeader className="pt-6 px-6 font-bold text-xl text-neutral-900 border-b border-neutral-100 pb-4">
              Gestione Inserzioni di Lavoro
            </CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              {initialJobs.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">
                  <p className="mb-4">Nessun annuncio creato finora.</p>
                  <Button
                    onPress={() => setIsCreateOpen(true)}
                    variant="flat"
                    color="primary"
                    className="font-semibold"
                  >
                    Pubblica la prima inserzione
                  </Button>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-neutral-600">
                  <thead className="bg-neutral-50 text-xs font-semibold uppercase text-neutral-400 border-b border-neutral-100">
                    <tr>
                      <th className="px-6 py-3.5 w-1/2">Titolo</th>
                      <th className="px-4 py-3.5">Sede</th>
                      <th className="px-4 py-3.5">Candidati</th>
                      <th className="px-4 py-3.5">Stato</th>
                      <th className="px-6 py-3.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {initialJobs.map((job) => (
                      <tr key={job.id} className="hover:bg-neutral-50/60 transition-colors">

                        {/* Titolo più ampio e linkabile */}
                        <td className="px-6 py-4 font-semibold text-neutral-900">
                          <Link
                            href={`/lavoro/inserzioni/${job.id}`}
                            className="hover:text-[#009245] transition-colors line-clamp-1"
                          >
                            {job.title}
                          </Link>
                        </td>

                        {/* Sede */}
                        <td className="px-4 py-4 font-semibold uppercase text-neutral-500 text-xs">
                          {job.provincia}
                        </td>

                        {/* Candidati pulito (click per aprire il modale) */}
                        <td className="px-4 py-4">
                          <button
                            onClick={() => {
                              setSelectedJob(job)
                              setIsApplicationsOpen(true)
                            }}
                            className="text-xs font-semibold text-neutral-700 hover:text-black hover:underline focus:outline-none"
                          >
                            {job.applicant_count} {job.applicant_count === 1 ? 'candidato' : 'candidati'}
                          </button>
                        </td>

                        {/* Stato con pallino minimale */}
                        <td className="px-4 py-4">
                          {job.status === 'attiva' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Attiva
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400">
                              <span className="w-2 h-2 rounded-full bg-neutral-300"></span>
                              Chiusa
                            </span>
                          )}
                        </td>

                        {/* Menu Azioni 3 puntini */}
                        <td className="px-6 py-4 text-right">
                          <Dropdown placement="bottom-end">
                            <DropdownTrigger>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                isLoading={actionLoading === job.id}
                                className="text-neutral-400 hover:text-neutral-700"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                                </svg>
                              </Button>
                            </DropdownTrigger>
                            <DropdownMenu aria-label="Azioni Inserzione">
                              <DropdownItem
                                key="applications"
                                onPress={() => {
                                  setSelectedJob(job)
                                  setIsApplicationsOpen(true)
                                }}
                              >
                                Vedi Candidati ({job.applicant_count})
                              </DropdownItem>
                              <DropdownItem
                                key="status"
                                onPress={() => handleToggleStatus(job.id, job.status)}
                              >
                                {job.status === 'attiva' ? 'Disattiva annuncio' : 'Attiva annuncio'}
                              </DropdownItem>
                              <DropdownItem
                                key="edit"
                                onPress={() => {
                                  setSelectedJob(job)
                                  setIsUpdateOpen(true)
                                }}
                              >
                                Modifica inserzione
                              </DropdownItem>
                              <DropdownItem
                                key="delete"
                                className="text-danger"
                                color="danger"
                                onPress={() => {
                                  setSelectedJob(job)
                                  setIsDeleteOpen(true)
                                }}
                              >
                                Elimina inserzione
                              </DropdownItem>
                            </DropdownMenu>
                          </Dropdown>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
        </div>

      </div>

      {/* Modale Creazione Inserzione */}
      <CreateJobModal
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => router.replace(router.asPath)}
        showAlert={showAlert}
      />

      {/* Modale Modifica Inserzione */}
      {selectedJob && (
        <UpdateJobModal
          isOpen={isUpdateOpen}
          onOpenChange={setIsUpdateOpen}
          onClose={() => {
            setIsUpdateOpen(false)
            setSelectedJob(null)
          }}
          jobData={selectedJob}
          onSuccess={() => router.replace(router.asPath)}
          showAlert={showAlert}
        />
      )}

      {/* Modale Eliminazione Inserzione */}
      {selectedJob && (
        <DeleteJobModal
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onClose={() => {
            setIsDeleteOpen(false)
            setSelectedJob(null)
          }}
          jobData={selectedJob}
          onSuccess={() => router.replace(router.asPath)}
          showAlert={showAlert}
        />
      )}

      {/* Modale Consultazione Candidature */}
      {selectedJob && (
        <ApplicationsModal
          isOpen={isApplicationsOpen}
          onOpenChange={setIsApplicationsOpen}
          onClose={() => {
            setIsApplicationsOpen(false)
            setSelectedJob(null)
          }}
          job={selectedJob}
        />
      )}

      {/* Modale Alert UI Feedback */}
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

    const initialJobs = await getBusinessJobs(decoded.email)

    return {
      props: {
        user: {
          email: decoded.email,
          company: decoded.company || '',
          name: decoded.name || '',
          surname: decoded.surname || '',
          vatNumber: (decoded as any).vatNumber || '',
        },
        initialJobs: JSON.parse(JSON.stringify(initialJobs)),
      },
    }
  } catch {
    return { redirect: { destination: '/aziende/login', permanent: false } }
  }
}