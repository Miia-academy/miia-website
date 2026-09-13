import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getJobById } from '@modules/jobs/db'
import { getContact } from '@modules/brevo'
import type { Job } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { useDataContext } from '@modules/context'
import { Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Divider } from '@heroui/react'

interface CompanyDetails {
  companyName: string
  contactPerson: string
  email: string
  settore: string
  website: string
  description: string
}

interface DettaglioInserzioneProps {
  user: {
    email: string
    cv_url: string
    tipo_utente: 'Azienda' | 'Studente'
  }
  job: Job
  company: CompanyDetails
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function DettaglioInserzione({ user, job, company }: DettaglioInserzioneProps) {
  const router = useRouter()
  const { getCompetenzaNameByValue } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  const handleApply = async () => {
    if (!user.cv_url) {
      showAlert(
        'Curriculum Mancante',
        'Devi caricare il tuo CV nel profilo prima di poterti candidare.',
        true
      )
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/job/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          company_name: company.companyName || '',
        }),
      })

      const data = await res.json()

      if (res.status === 201 || res.status === 200) {
        showAlert('Candidatura Inviata!', 'La tua candidatura è stata inoltrata con successo all\'azienda.')
      } else if (res.status === 409) {
        showAlert('Già Candidato', data.message, false)
      } else {
        showAlert('Attenzione', data.message || 'Errore durante la candidatura.', true)
      }
    } catch {
      showAlert('Errore di Rete', 'Impossibile inviare la candidatura. Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  const isAzienda = user.tipo_utente === 'Azienda'

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">

        {/* Breadcrumb dinamico in base al ruolo */}
        <div className="mb-6">
          <Link
            href={isAzienda ? '/aziende/profilo' : '/lavoro/inserzioni'}
            className="text-sm font-medium text-neutral-500 hover:text-black transition-colors"
          >
            &larr; {isAzienda ? 'Torna al profilo' : 'Torna alla bacheca'}
          </Link>
        </div>

        {/* Job Header */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-neutral-200 mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Chip size="sm" variant="flat" className="font-bold uppercase tracking-widest text-[10px] bg-[#009245]/10 text-[#009245]">
                  {job.provincia}
                </Chip>
                <span className="text-xs text-neutral-400 font-medium">
                  Pubblicato il: {new Date(job.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
                {job.title}
              </h1>
            </div>

            {!isAzienda && (
              <div className="shrink-0 w-full md:w-auto">
                <Button
                  onPress={handleApply}
                  isLoading={loading}
                  size="lg"
                  className="w-full md:w-auto bg-[#009245] text-white font-bold shadow-md"
                >
                  Candidati Ora
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Griglia Principale */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Colonna Sinistra: Descrizione e Competenze */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl bg-white p-8 shadow-sm border border-neutral-200">
              <h2 className="text-lg font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
                Descrizione dell'offerta
              </h2>
              <div className="prose prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap leading-relaxed">
                {job.description}
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-100">
                <h3 className="text-base font-bold text-neutral-900 mb-3">
                  Competenze Richieste
                </h3>
                {job.competenze && job.competenze.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {job.competenze.map((skillKey) => {
                      const label = getCompetenzaNameByValue(skillKey) || skillKey
                      return (
                        <Chip key={skillKey} variant="flat" className="bg-neutral-100 text-neutral-800 font-medium text-xs px-2 py-1">
                          {label}
                        </Chip>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">Nessuna competenza specifica indicata.</p>
                )}
              </div>

            </div>
          </div>

          {/* Colonna Destra: Dettagli Azienda */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-neutral-200 sticky top-6">
              <h2 className="text-lg font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100">
                Informazioni Azienda
              </h2>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Azienda</span>
                  <span className="font-bold text-neutral-900 text-base">{company.companyName || 'Riservata'}</span>
                </div>

                {company.contactPerson && (
                  <div>
                    <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Referente</span>
                    <span className="text-neutral-700">{company.contactPerson}</span>
                  </div>
                )}

                {company.settore && (
                  <div>
                    <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Settore</span>
                    <span className="text-neutral-700 capitalize">{company.settore}</span>
                  </div>
                )}

                <div>
                  <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Email di Contatto</span>
                  <span className="text-neutral-700 break-all">{company.email}</span>
                </div>

                {company.website && (
                  <div>
                    <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">Sito Web</span>
                    <a
                      href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {company.website}
                    </a>
                  </div>
                )}

                {company.description && (
                  <div>
                    <Divider className="my-2" />
                    <span className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">Chi Siamo</span>
                    <p className="text-xs text-neutral-600 line-clamp-4 leading-relaxed">{company.description}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Feedback Modal */}
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
                  {alertInfo.isError && alertInfo.title === 'Curriculum Mancante' ? (
                    <Button color="primary" as={Link} href="/studenti/profilo">
                      Vai al Profilo
                    </Button>
                  ) : (
                    <Button color={alertInfo.isError ? 'danger' : 'primary'} onPress={onClose}>
                      OK
                    </Button>
                  )}
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

      </div>
    </div>
  )
}

// ============================================================================
// SERVER-SIDE LOGIC
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string }
  const token = context.req.cookies['miia_auth_token']

  // 1. VERIFICA AUTHENTICAZIONE (Isolata)
  if (!token) {
    return {
      redirect: {
        destination: `/studenti/login?redirect=/lavoro/inserzioni/${id}`,
        permanent: false,
      },
    }
  }

  let decoded: AuthPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (authErr) {
    console.error('[SSR Auth Error] Token JWT non valido o scaduto:', authErr)
    const userCookie = context.req.cookies['miia_user']
    let isAzienda = false
    try {
      if (userCookie) {
        const parsed = JSON.parse(decodeURIComponent(userCookie))
        isAzienda = parsed?.tipo_utente === 'Azienda'
      }
    } catch { }

    const loginRoute = isAzienda ? '/aziende/login' : '/studenti/login'
    return {
      redirect: {
        destination: `${loginRoute}?redirect=/lavoro/inserzioni/${id}`,
        permanent: false,
      },
    }
  }

  // 2. RECUPERO INSERZIONE DB (Non causa più il redirect al login se fallisce)
  let job: Job | null = null
  try {
    job = await getJobById(id)
  } catch (dbErr) {
    console.error(`[SSR DB Error] Errore durante getJobById("${id}"):`, dbErr)
    return { notFound: true }
  }

  if (!job) {
    return { notFound: true }
  }

  // 3. RECUPERO DETTAGLI BREVO (Isolato con Fallback)
  let companyInfo: CompanyDetails = {
    companyName: '',
    contactPerson: '',
    email: job.company_email,
    settore: '',
    website: '',
    description: '',
  }

  try {
    if (job.company_email) {
      const contact = await getContact({ identifier: job.company_email })
      const attrs = contact?.attributes || {}
      companyInfo = {
        companyName: attrs.NOME_AZIENDA || attrs.AZIENDA || attrs.COMPANY || '',
        contactPerson: attrs.REFERENTE || attrs.CONTACT_PERSON || '',
        email: job.company_email,
        settore: attrs.SETTORE || attrs.AREA || '',
        website: attrs.SITO_WEB || '',
        description: attrs.DESCRIZIONE || '',
      }
    }
  } catch (brevoErr) {
    console.warn('[SSR Brevo Warning] Impossibile recuperare info azienda:', brevoErr)
  }

  return {
    props: {
      user: {
        email: decoded.email,
        cv_url: decoded.cv_url || '',
        tipo_utente: decoded.tipo_utente || 'Studente',
      },
      job: JSON.parse(JSON.stringify(job)),
      company: companyInfo,
    },
  }
}