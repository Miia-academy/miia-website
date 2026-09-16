import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getBusinessJobs } from '@modules/jobs/db'
import type { Job, JobWithApplicantsCount } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { Button, Card, CardBody, CardHeader, Divider, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Chip } from '@heroui/react'
import { JobFormModal } from '@components/business/JobFormModal'
import { DeleteJobModal } from '@components/business/DeleteJobModal'
import { ApplicationsModal } from '@components/business/ApplicationsModal'
import { BusinessProfileModal, BusinessProfileData } from '@components/business/BusinessProfileModal'
import { AlertModal } from '@components/shared/AlertModal'
import { LogoutButton } from '@components/shared/LogoutButton'

interface BusinessProfileDashboardProps {
  user: BusinessProfileData & { email: string }
  initialJobs: JobWithApplicantsCount[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessProfileDashboard({ user, initialJobs }: BusinessProfileDashboardProps) {
  const router = useRouter()
  const [profileData, setProfileData] = useState<BusinessProfileData>(user)
  const [isProfileFormOpen, setIsProfileFormOpen] = useState(false)
  const [isJobFormOpen, setIsJobFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isApplicationsOpen, setIsApplicationsOpen] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  const handleToggleStatus = async (jobId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'attiva' ? 'chiusa' : 'attiva'
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
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 border-b border-neutral-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 truncate">Area Azienda</h1>
            <p className="mt-0.5 text-sm text-neutral-500 truncate">Gestisci le tue inserzioni e le candidature</p>
          </div>
        </div>
        <div>
          <LogoutButton
            redirectTo="/aziende/login"
            variant="light"
            color="default"
            label="Esci"
          />
          <Button onPress={() => { setSelectedJob(null); setIsJobFormOpen(true); }} className="w-full md:w-auto bg-[#009245] text-white font-bold shadow-sm shrink-0 h-11">
            + Nuova Inserzione
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-5 sm:px-6 font-bold text-xl text-neutral-900 flex justify-between items-center">
              <span>Profilo Operativo</span>
            </CardHeader>
            <Divider className="my-2" />
            <CardBody className="px-5 sm:px-6 pb-6 space-y-6">
              <div className="flex items-center gap-4">
                {profileData.logo_url ? (
                  <img src={profileData.logo_url} alt="Logo Azienda" className="w-16 h-16 rounded-xl object-contain border border-neutral-200 bg-white p-1 shrink-0 shadow-sm" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-400 text-xl shrink-0 border border-neutral-200 border-dashed">
                    {profileData.azienda ? profileData.azienda.substring(0, 2).toUpperCase() : 'AZ'}
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">{profileData.azienda || <span className="text-red-500 italic text-sm">Nome mancante</span>}</h2>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Referente</span>
                  <p className="font-medium text-neutral-800">{profileData.referente || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Telefono</span>
                    <p className="font-medium text-neutral-800">{profileData.sms || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Sito Web</span>
                    {profileData.sito_web ? (
                      <a href={profileData.sito_web.startsWith('http') ? profileData.sito_web : `https://${profileData.sito_web}`} target="_blank" rel="noreferrer" className="font-medium text-emerald-600 hover:underline truncate block">
                        {profileData.sito_web.replace(/^https?:\/\//, '')}
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
                  {profileData.descrizione ? (
                    <p className="text-neutral-600 leading-relaxed line-clamp-4">{profileData.descrizione}</p>
                  ) : (
                    <span className="text-red-500 italic text-xs">Descrizione mancante. I candidati non sapranno di cosa vi occupate.</span>
                  )}
                </div>
              </div>
              <Button onPress={() => setIsProfileFormOpen(true)} className="w-full bg-neutral-900 text-white font-bold h-11">
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
              <Button onPress={() => { setSelectedJob(null); setIsJobFormOpen(true); }} variant="flat" color="primary" className="font-semibold">
                Pubblica la prima inserzione
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-4">
              {initialJobs.map((job) => (
                <div key={job.id} className="bg-white border border-neutral-200 rounded-xl p-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 hover:shadow transition-all">
                  <div className="flex-1 min-w-0">
                    <Link href={`/lavoro/inserzioni/${job.id}`} className="text-[17px] font-bold text-neutral-900 hover:text-[#009245] transition-colors leading-tight line-clamp-1 truncate block">
                      {job.title}
                    </Link>
                    <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mt-1">
                      {job.provincie && job.provincie.length > 0 ? job.provincie.join(', ') : 'Triveneto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 border-t sm:border-t-0 border-neutral-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
                    <button onClick={() => { setSelectedJob(job); setIsApplicationsOpen(true); }} className="text-sm font-semibold text-[#009245] hover:underline whitespace-nowrap">
                      {job.applicant_count} {job.applicant_count === 1 ? 'Candidato' : 'Candidati'}
                    </button>
                    <Chip size="sm" color={job.status === 'attiva' ? 'success' : 'default'} variant="flat" className="shrink-0 font-medium">
                      {job.status === 'attiva' ? 'Attiva' : 'Chiusa'}
                    </Chip>
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button isIconOnly size="sm" variant="light" className="text-neutral-500 hover:text-neutral-900 text-2xl font-bold min-w-8 w-8 h-8">&#8942;</Button>
                      </DropdownTrigger>
                      <DropdownMenu aria-label="Azioni Inserzione">
                        <DropdownItem key="status" onPress={() => handleToggleStatus(job.id, job.status)}>
                          {job.status === 'attiva' ? 'Disattiva Annuncio' : 'Riattiva Annuncio'}
                        </DropdownItem>
                        <DropdownItem key="edit" onPress={() => { setSelectedJob(job); setIsJobFormOpen(true); }}>
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

      <BusinessProfileModal isOpen={isProfileFormOpen} onClose={() => setIsProfileFormOpen(false)} initialData={profileData} onSuccess={setProfileData} showAlert={showAlert} />
      <JobFormModal isOpen={isJobFormOpen} onOpenChange={setIsJobFormOpen} onClose={() => { setIsJobFormOpen(false); setSelectedJob(null); }} jobData={selectedJob} onSuccess={() => router.replace(router.asPath)} showAlert={showAlert} />
      {selectedJob && <DeleteJobModal isOpen={isDeleteOpen} onOpenChange={setIsDeleteOpen} onClose={() => { setIsDeleteOpen(false); setSelectedJob(null); }} jobData={selectedJob} onSuccess={() => router.replace(router.asPath)} showAlert={showAlert} />}
      {selectedJob && <ApplicationsModal isOpen={isApplicationsOpen} onOpenChange={setIsApplicationsOpen} onClose={() => { setIsApplicationsOpen(false); setSelectedJob(null); }} job={selectedJob} />}
      <AlertModal isOpen={alertInfo.isOpen} onOpenChange={(open) => setAlertInfo({ ...alertInfo, isOpen: open })} title={alertInfo.title} message={alertInfo.message} isError={alertInfo.isError} />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']
  if (!token) return { redirect: { destination: '/aziende/login?redirectUrl=/aziende/profilo', permanent: false } }

  let decoded: AuthPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    return { redirect: { destination: '/aziende/login?redirectUrl=/aziende/profilo', permanent: false } }
  }

  if (decoded.tipo_utente !== 'Azienda') return { redirect: { destination: '/studenti/profilo', permanent: false } }

  const mappedUser = {
    email: decoded.email,
    azienda: decoded.azienda || '',
    referente: decoded.referente || '',
    sms: decoded.sms || '',
    indirizzo: decoded.indirizzo || '',
    sito_web: decoded.sito_web || '',
    descrizione: decoded.descrizione || '',
    logo_url: decoded.logo_url || '',
  }

  try {
    const initialJobs = await getBusinessJobs(decoded.email)
    return {
      props: {
        user: mappedUser,
        initialJobs: JSON.parse(JSON.stringify(initialJobs)),
      },
    }
  } catch {
    return {
      props: {
        user: mappedUser,
        initialJobs: [],
      },
    }
  }
}