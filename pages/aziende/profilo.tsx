import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getBusinessJobs } from '@modules/jobs/db'
import type { Job, JobWithApplicantsCount } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import {
  Input,
  Textarea,
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
  ModalFooter,
  Chip,
} from '@heroui/react'
import { JobFormModal } from '@components/business/JobFormModal'
import { DeleteJobModal } from '@components/business/DeleteJobModal'
import { ApplicationsModal } from '@components/business/ApplicationsModal'

interface BusinessProfileDashboardProps {
  user: {
    email: string
    company: string
    contactPerson: string
    telefono: string
    indirizzo: string
    website: string
    description: string
    logo_url: string
  }
  initialJobs: JobWithApplicantsCount[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessProfileDashboard({ user, initialJobs }: BusinessProfileDashboardProps) {
  const router = useRouter()

  // 1. Stato dei dati confermati (mostrati in UI)
  const [profileData, setProfileData] = useState({
    company: user.company || '',
    contactPerson: user.contactPerson || '',
    telefono: user.telefono || '',
    indirizzo: user.indirizzo || '',
    website: user.website || '',
    description: user.description || '',
    logo_url: user.logo_url || '',
  })

  // 2. Stato temporaneo per il form nella modale
  const [editForm, setEditForm] = useState(profileData)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // 3. Stati Modali
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false)
  const [isJobFormOpen, setIsJobFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isApplicationsOpen, setIsApplicationsOpen] = useState(false)

  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  // ==========================================
  // HANDLERS
  // ==========================================
  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  const handleOpenProfileModal = () => {
    setEditForm(profileData) // Reset form ai dati salvati
    setLogoFile(null)
    setIsProfileFormOpen(true)
  }

  const handleOpenCreate = () => {
    setSelectedJob(null)
    setIsJobFormOpen(true)
  }

  const handleOpenEdit = (job: Job) => {
    setSelectedJob(job)
    setIsJobFormOpen(true)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)

    try {
      let logoBase64 = '', logoFileName = '', logoMimeType = ''
      if (logoFile) {
        if (logoFile.size > 3 * 1024 * 1024) {
          showAlert('Errore', 'Il logo non può superare i 3MB.', true)
          setProfileLoading(false)
          return
        }

        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(logoFile)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = (error) => reject(error)
        })
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const payload = {
        companyName: editForm.company,
        contactPerson: editForm.contactPerson,
        telefono: editForm.telefono,
        indirizzo: editForm.indirizzo,
        website: editForm.website,
        description: editForm.description,
        logoBase64,
        logoFileName,
        logoMimeType,
      }

      const res = await fetch('/api/user/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setProfileData({
          ...editForm,
          logo_url: data.user?.logo_url || profileData.logo_url
        })
        showAlert('Successo', 'Dati aziendali salvati con successo!')
        setIsProfileFormOpen(false)
      } else {
        showAlert('Errore', data.message || 'Errore durante l\'aggiornamento.', true)
      }
    } catch {
      showAlert('Errore', 'Connessione fallita. Riprova.', true)
    } finally {
      setProfileLoading(false)
    }
  }

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
      showAlert('Errore', 'Impossibile cambiare lo stato dell\'inserzione.', true)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Header Responsivo */}
      <div className="mx-auto max-w-6xl mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 truncate">Area Azienda</h1>
            <p className="mt-0.5 text-sm text-neutral-500 truncate">
              Gestisci le tue inserzioni e le candidature
            </p>
          </div>
        </div>
        <Button onPress={handleOpenCreate} className="w-full md:w-auto bg-[#009245] text-white font-bold shadow-sm shrink-0 h-11">
          + Nuova Inserzione
        </Button>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

        {/* Colonna SX: Profilo Operativo (Invertito su mobile: order-2) */}
        <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-5 sm:px-6 font-bold text-xl text-neutral-900 flex justify-between items-center">
              <span>Profilo Operativo</span>
            </CardHeader>
            <Divider className="my-2" />

            <CardBody className="px-5 sm:px-6 pb-6 space-y-6">
              {/* Logo Preview */}
              <div className="flex items-center gap-4">
                {profileData.logo_url ? (
                  <img src={profileData.logo_url} alt="Logo Azienda" className="w-16 h-16 rounded-xl object-contain border border-neutral-200 bg-white p-1 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-400 text-xl shrink-0 border border-neutral-200 border-dashed">
                    {profileData.company ? profileData.company.substring(0, 2).toUpperCase() : 'AZ'}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">{profileData.company || <span className="text-red-500 italic text-sm">Nome mancante</span>}</h2>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{user.email}</p>
                </div>
              </div>

              {/* Dati Testuali */}
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Referente</span>
                  <p className="font-medium text-neutral-800">{profileData.contactPerson || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Telefono</span>
                    <p className="font-medium text-neutral-800">{profileData.telefono || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Sito Web</span>
                    {profileData.website ? (
                      <a href={profileData.website.startsWith('http') ? profileData.website : `https://${profileData.website}`} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:underline truncate block">
                        {profileData.website.replace(/^https?:\/\//, '')}
                      </a>
                    ) : (
                      <span className="text-red-500 italic text-xs">Mancante</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Indirizzo Sede</span>
                  <p className="font-medium text-neutral-800">{profileData.indirizzo || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Chi Siamo</span>
                  {profileData.description ? (
                    <p className="text-neutral-600 leading-relaxed line-clamp-4">{profileData.description}</p>
                  ) : (
                    <span className="text-red-500 italic text-xs">Descrizione mancante. I candidati non sapranno di cosa vi occupate.</span>
                  )}
                </div>
              </div>

              <Button onPress={handleOpenProfileModal} className="w-full bg-neutral-900 text-white font-bold h-11">
                Modifica Profilo
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <h2 className="font-bold text-xl text-neutral-900">Le Tue Inserzioni</h2>
            <span className="text-sm text-neutral-500 font-medium">{initialJobs.length} {initialJobs.length === 1 ? 'Annuncio' : 'Annunci'}</span>
          </div>

          {initialJobs.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-neutral-300 rounded-2xl bg-white mt-4">
              <p className="mb-4 text-neutral-500">Nessun annuncio creato finora.</p>
              <Button onPress={handleOpenCreate} variant="flat" color="primary" className="font-semibold">
                Pubblica la prima inserzione
              </Button>
            </div>
          ) : (
            /* Layout a singola colonna (flex-col) che si allarga al 100% */
            <div className="flex flex-col gap-3 mt-4">
              {initialJobs.map((job) => (
                <div key={job.id} className="bg-white border border-neutral-200 rounded-xl p-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 hover:shadow transition-all">

                  {/* Sinistra: Titolo e Provincia */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/lavoro/inserzioni/${job.id}`}
                      className="text-[17px] font-bold text-neutral-900 hover:text-[#009245] transition-colors leading-tight line-clamp-1 truncate block"
                    >
                      {job.title}
                    </Link>
                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1">
                      {job.provincie && job.provincie.length > 0 ? job.provincie.join(', ') : 'Triveneto'}
                    </p>
                  </div>

                  {/* Destra: Candidati, Stato e Azioni */}
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 border-t sm:border-t-0 border-neutral-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
                    <button
                      onClick={() => { setSelectedJob(job); setIsApplicationsOpen(true); }}
                      className="text-sm font-semibold text-[#009245] hover:underline whitespace-nowrap"
                    >
                      {job.applicant_count} {job.applicant_count === 1 ? 'Candidato' : 'Candidati'}
                    </button>

                    <Chip size="sm" color={job.status === 'attiva' ? 'success' : 'default'} variant="flat" className="shrink-0 font-medium">
                      {job.status === 'attiva' ? 'Attiva' : 'Chiusa'}
                    </Chip>

                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" className="text-neutral-500 hover:text-neutral-900 text-2xl font-bold min-w-8 w-8 h-8">
                          &#8942;
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Azioni Inserzione">
                        <DropdownItem key="status" onPress={() => handleToggleStatus(job.id, job.status)}>
                          {job.status === 'attiva' ? 'Disattiva Annuncio' : 'Riattiva Annuncio'}
                        </DropdownItem>
                        <DropdownItem key="edit" onPress={() => handleOpenEdit(job)}>
                          Modifica Inserzione
                        </DropdownItem>
                        <DropdownItem key="delete" className="text-danger" color="danger" onPress={() => { setSelectedJob(job); setIsDeleteOpen(true); }}>
                          Elimina Inserzione
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          MODALE MODIFICA PROFILO AZIENDALE
      ========================================= */}
      <Modal isOpen={isProfileFormOpen} onOpenChange={setIsProfileFormOpen} size="lg" scrollBehavior="inside" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <ModalHeader className="border-b border-neutral-100 px-6 py-4 text-xl font-bold">
                Modifica Profilo
              </ModalHeader>

              <ModalBody className="py-6 px-4 sm:px-6 space-y-6">
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Identità Aziendale</span>
                  <Input label="Nome Azienda" isRequired value={editForm.company} onValueChange={(v) => setEditForm({ ...editForm, company: v })} variant="flat" />

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Logo (PNG/JPG max 3MB)</label>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition-colors"
                    />
                  </div>
                </div>

                <Divider className="my-1" />

                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Contatti & Sede</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Referente / Contatto" isRequired value={editForm.contactPerson} onValueChange={(v) => setEditForm({ ...editForm, contactPerson: v })} variant="flat" />
                    <Input type="tel" label="Telefono (es. +39...)" value={editForm.telefono} onValueChange={(v) => setEditForm({ ...editForm, telefono: v })} variant="flat" />
                  </div>
                  <Input label="Indirizzo Sede" placeholder="Via/Piazza, Città, CAP" value={editForm.indirizzo} onValueChange={(v) => setEditForm({ ...editForm, indirizzo: v })} variant="flat" />
                </div>

                <Divider className="my-1" />

                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Presentazione</span>
                  <Input type="url" label="Sito Web" placeholder="https://..." value={editForm.website} onValueChange={(v) => setEditForm({ ...editForm, website: v })} variant="flat" />
                  <Textarea label="Chi Siamo" placeholder="Descrivi brevemente l'azienda per i candidati..." value={editForm.description} onValueChange={(v) => setEditForm({ ...editForm, description: v })} variant="flat" minRows={4} />
                </div>
              </ModalBody>

              <ModalFooter className="border-t border-neutral-100 px-6 py-4">
                <Button variant="flat" onPress={onClose} disabled={profileLoading} className="w-full sm:w-auto">
                  Annulla
                </Button>
                <Button type="submit" isLoading={profileLoading} className="w-full sm:w-auto bg-black text-white font-bold shadow-sm">
                  Salva Modifiche
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Modali Job e Altri */}
      <JobFormModal
        isOpen={isJobFormOpen}
        onOpenChange={setIsJobFormOpen}
        onClose={() => { setIsJobFormOpen(false); setSelectedJob(null); }}
        jobData={selectedJob}
        onSuccess={() => router.replace(router.asPath)}
        showAlert={showAlert}
      />

      {selectedJob && (
        <DeleteJobModal
          isOpen={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          onClose={() => { setIsDeleteOpen(false); setSelectedJob(null); }}
          jobData={selectedJob}
          onSuccess={() => router.replace(router.asPath)}
          showAlert={showAlert}
        />
      )}

      {selectedJob && (
        <ApplicationsModal
          isOpen={isApplicationsOpen}
          onOpenChange={setIsApplicationsOpen}
          onClose={() => { setIsApplicationsOpen(false); setSelectedJob(null); }}
          job={selectedJob}
        />
      )}

      {/* Alert Feedback Modal */}
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
// SERVER-SIDE LOGIC CON BLOCCHI TRY/CATCH ISOLATI
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/aziende/login?redirectUrl=/aziende/profilo', permanent: false } }
  }

  let decoded: AuthPayload

  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    console.error('❌ Errore JWT Profilo Azienda:', err)
    return { redirect: { destination: '/aziende/login?redirectUrl=/aziende/profilo', permanent: false } }
  }

  if (decoded.tipo_utente !== 'Azienda') {
    return { redirect: { destination: '/studenti/profilo', permanent: false } }
  }

  try {
    const initialJobs = await getBusinessJobs(decoded.email)

    return {
      props: {
        user: {
          email: decoded.email,
          company: decoded.company || '',
          contactPerson: decoded.contact_person || (decoded as any).contactPerson || '',
          telefono: (decoded as any).telefono || '',
          indirizzo: (decoded as any).indirizzo || '',
          website: (decoded as any).website || '',
          description: (decoded as any).description || '',
          logo_url: (decoded as any).logo_url || '',
        },
        initialJobs: JSON.parse(JSON.stringify(initialJobs)),
      },
    }
  } catch (dbError) {
    console.error('❌ Errore Database in getBusinessJobs:', dbError)

    return {
      props: {
        user: {
          email: decoded.email,
          company: decoded.company || '',
          contactPerson: decoded.contact_person || (decoded as any).contactPerson || '',
          telefono: (decoded as any).telefono || '',
          indirizzo: (decoded as any).indirizzo || '',
          website: (decoded as any).website || '',
          description: (decoded as any).description || '',
          logo_url: (decoded as any).logo_url || '',
        },
        initialJobs: [],
      },
    }
  }
}