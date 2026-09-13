import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getJobById } from '@modules/jobs/db'
import type { Job } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { Button, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react'

interface DettaglioInserzioneProps {
  user: {
    email: string
    cv_url: string
  }
  job: Job
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function DettaglioInserzione({ user, job }: DettaglioInserzioneProps) {
  const router = useRouter()
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
          // Inviamo esplicitamente anche company_name vuoto se non lo abbiamo, 
          // l'API lo gestirà per Brevo
          company_name: ''
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
    } catch (error) {
      showAlert('Errore di Rete', 'Impossibile inviare la candidatura. Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">

        {/* Breadcrumb / Back Button */}
        <div className="mb-6">
          <Link href="/lavoro/inserzioni" className="text-sm font-medium text-neutral-500 hover:text-black transition-colors">
            &larr; Torna alla bacheca
          </Link>
        </div>

        {/* Job Header */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-neutral-200 mb-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <Chip size="sm" color="primary" variant="flat" className="font-bold uppercase tracking-widest text-[10px]">
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
          </div>
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 rounded-2xl bg-white p-8 shadow-sm border border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-900 mb-4 border-b border-neutral-100 pb-2">
              Descrizione dell'offerta
            </h2>
            <div className="prose prose-neutral max-w-none text-neutral-600 whitespace-pre-wrap">
              {job.description}
            </div>
          </div>

          <div className="md:col-span-1 rounded-2xl bg-white p-8 shadow-sm border border-neutral-200 h-fit">
            <h2 className="text-lg font-bold text-neutral-900 mb-4 border-b border-neutral-100 pb-2">
              Competenze Richieste
            </h2>
            {job.competenze && job.competenze.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {job.competenze.map((skill) => (
                  <Chip key={skill} variant="flat" className="bg-neutral-100 text-neutral-700">
                    {skill}
                  </Chip>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Nessuna competenza specifica indicata.</p>
            )}
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
                  {/* Se manca il CV, offriamo un bottone comodo per andare al profilo */}
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

  // 1. Gatekeeper: Solo loggati
  if (!token) {
    return {
      redirect: {
        destination: `/studenti/login?redirect=/lavoro/inserzioni/${id}`,
        permanent: false,
      },
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    // 2. Gatekeeper: Niente aziende
    if (decoded.tipo_utente === 'Azienda') {
      return { redirect: { destination: '/aziende/inserzioni', permanent: false } }
    }

    // 3. Fetch dal DB Neon dell'inserzione specifica
    const job = await getJobById(id)

    // Se non esiste o è chiusa/eliminata, mostriamo 404
    if (!job) {
      return { notFound: true }
    }

    return {
      props: {
        user: {
          email: decoded.email,
          cv_url: decoded.cv_url || '',
        },
        job: JSON.parse(JSON.stringify(job)),
      },
    }
  } catch (error) {
    return {
      redirect: {
        destination: `/studenti/login?redirect=/lavoro/inserzioni/${id}`,
        permanent: false,
      },
    }
  }
}