import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getJobById } from '@modules/jobs/db'
import { hasStudentApplied } from '@modules/applications/db'
import { getContact } from '@modules/brevo'
import type { Job } from '@modules/jobs/types'
import {
  TIPO_CONTRATTO_LABELS,
  ORARIO_LAVORO_LABELS,
  GRADO_ESPERIENZA_LABELS,
  TRASFERTE_LABELS,
  LINGUE_STRANIERE,
} from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { useDataContext } from '@modules/context'
import { Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Divider } from '@heroui/react'

interface CompanyDetails {
  companyName: string
  indirizzo: string
  website: string
  description: string
  logo_url: string
}

interface DettaglioInserzioneProps {
  user: {
    email: string
    cv_url: string
    tipo_utente: 'Azienda' | 'Studente' | 'Admin'
  }
  job: Job
  company: CompanyDetails
  hasApplied: boolean
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function DettaglioInserzione({ user, job, company, hasApplied }: DettaglioInserzioneProps) {
  const { competenze: masterCompetenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [hasAppliedState, setHasAppliedState] = useState(hasApplied)
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  const uniqueCompetenze = Array.from(new Set((job.competenze || []).map((k) => k.trim())))

  const detailedSkills = uniqueCompetenze.map((skillKey) => {
    const found = (masterCompetenze || []).find(
      (s: any) =>
        s.name?.trim() === skillKey ||
        s.title?.trim() === skillKey ||
        s.value?.trim() === skillKey
    )

    if (found) {
      return {
        key: skillKey,
        title: found.name?.trim() || skillKey,
        description: found.value && found.value.trim() !== found.name?.trim() ? found.value : null,
      }
    }

    const isLongText = skillKey.length > 40
    return {
      key: skillKey,
      title: isLongText ? 'Competenza richiesta' : skillKey,
      description: isLongText ? skillKey : null,
    }
  })

  const selectedLanguages = (job.lingue || []).map((langKey) => {
    const found = LINGUE_STRANIERE.find((l) => l.key === langKey)
    return found ? found.label : langKey
  })

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
        setHasAppliedState(true)
        showAlert('Candidatura Inviata!', 'La tua candidatura verrà presa in esame.')
      } else if (res.status === 409) {
        setHasAppliedState(true)
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

  // Routerino dinamico per la navigazione
  const navRouter: Record<string, { text: string; url: string }> = {
    Azienda: { text: 'Torna alla dashboard', url: '/aziende/profilo' },
    Studente: { text: 'Torna alla bacheca', url: '/lavoro/inserzioni' },
    Admin: { text: 'Torna al pannello', url: '/admin/profilo' },
  }

  const backNavigation = navRouter[user.tipo_utente] || navRouter['Studente']

  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Link di ritorno dinamico */}
        <div className="mb-4 sm:mb-6">
          <Link
            href={backNavigation.url}
            className="text-sm font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1"
          >
            &larr; {backNavigation.text}
          </Link>
        </div>

        {/* Layout a 2 colonne */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Colonna Principale */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 p-6 sm:p-8 space-y-8 shadow-xs">

            {/* Header Posizione */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${job.status === 'attiva' ? 'bg-emerald-50 text-emerald-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {job.status === 'attiva' ? 'Offerta Attiva' : 'Chiusa'}
                </span>
                <span className="text-xs font-medium text-neutral-500">
                  Pubblicato il {new Date(job.created_at).toLocaleDateString('it-IT')}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight break-words">
                  {job.title}
                </h1>

                {/* Visualizza il bottone Candidati SOLO per gli Studenti */}
                {user.tipo_utente === 'Studente' && (
                  hasAppliedState ? (
                    <Button
                      isDisabled
                      className="bg-[#009245]/10 text-[#009245] font-bold border border-[#009245]/30 opacity-100 cursor-not-allowed shrink-0 h-11 px-6"
                    >
                      ✓ Già candidato
                    </Button>
                  ) : (
                    <Button
                      onPress={handleApply}
                      isLoading={loading}
                      isDisabled={job.status !== 'attiva'}
                      className="bg-[#009245] text-white font-bold shrink-0 h-11 px-6 shadow-sm"
                    >
                      Candidati Ora
                    </Button>
                  )
                )}
              </div>
            </div>

            <Divider />

            {/* Condizioni Operative */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Condizioni & Inquadramento
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">

                <div>
                  <span className="block text-xs text-neutral-400 font-medium">Sede di lavoro</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {job.provincie && job.provincie.length > 0 ? job.provincie.join(', ') : 'Triveneto'}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-neutral-400 font-medium">Contratto</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {TIPO_CONTRATTO_LABELS[job.tipo_contratto] || job.tipo_contratto}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-neutral-400 font-medium">Esperienza</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {GRADO_ESPERIENZA_LABELS[job.grado_esperienza] || job.grado_esperienza}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-neutral-400 font-medium">Orario</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {ORARIO_LAVORO_LABELS[job.orari_lavoro] || job.orari_lavoro}
                  </span>
                </div>

                <div>
                  <span className="block text-xs text-neutral-400 font-medium">Trasferte</span>
                  <span className="text-sm font-bold text-neutral-800">
                    {TRASFERTE_LABELS[job.trasferte] || job.trasferte}
                  </span>
                </div>

                {job.ral && (
                  <div>
                    <span className="block text-xs text-neutral-400 font-medium">RAL</span>
                    <span className="text-sm font-bold text-neutral-800">{job.ral}</span>
                  </div>
                )}

                {selectedLanguages.length > 0 && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-xs text-neutral-400 font-medium">Lingue</span>
                    <span className="text-sm font-bold text-neutral-800">{selectedLanguages.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <Divider />

            {/* Descrizione del Ruolo */}
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Descrizione del Ruolo
              </h2>
              <p className="text-neutral-700 whitespace-pre-line text-sm leading-relaxed">
                {job.description}
              </p>
            </div>

            {/* Competenze Richieste */}
            {detailedSkills.length > 0 && (
              <>
                <Divider />
                <div className="space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Competenze Richieste
                  </h2>
                  <div className="space-y-4">
                    {detailedSkills.map((skill) => (
                      <div key={skill.key} className="flex items-start gap-3">
                        <span className="w-2 h-2 rounded-full bg-[#009245] mt-1.5 shrink-0" />
                        <div className="space-y-0.5">
                          <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                            {skill.title}
                          </h3>
                          {skill.description && (
                            <p className="text-xs text-neutral-500 leading-relaxed">
                              {skill.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>

          {/* Colonna Destra */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 space-y-5 sticky top-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-neutral-100">
              {company.logo_url ? (
                <img src={company.logo_url} alt="Logo Azienda" className="w-12 h-12 rounded-xl object-contain border border-neutral-200 p-1" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-600 text-base">
                  {company.companyName ? company.companyName.substring(0, 2).toUpperCase() : 'AZ'}
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-neutral-900 leading-snug">
                  {company.companyName}
                </h3>
                {company.indirizzo && (
                  <p className="text-xs text-neutral-400">{company.indirizzo}</p>
                )}
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {company.website && (
                <div>
                  <span className="block font-semibold text-neutral-400 uppercase tracking-wider text-[10px]">Sito Web</span>
                  <a
                    href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-700 font-medium hover:underline break-all"
                  >
                    {company.website}
                  </a>
                </div>
              )}

              {company.description && (
                <div className="pt-2 border-t border-neutral-100">
                  <span className="block font-semibold text-neutral-400 uppercase tracking-wider text-[10px] mb-1">Chi Siamo</span>
                  <p className="text-neutral-600 leading-relaxed line-clamp-5">{company.description}</p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Feedback */}
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

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params as { id: string }
  const token = context.req.cookies['miia_auth_token']

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
  } catch {
    return {
      redirect: {
        destination: `/studenti/login?redirect=/lavoro/inserzioni/${id}`,
        permanent: false,
      },
    }
  }

  let job: Job | null = null
  try {
    job = await getJobById(id)
  } catch (dbErr) {
    console.error(`[SSR DB Error] getJobById("${id}"):`, dbErr)
    return { notFound: true }
  }

  if (!job) {
    return { notFound: true }
  }

  let hasApplied = false
  if (decoded.tipo_utente === 'Studente') {
    try {
      hasApplied = await hasStudentApplied(id, decoded.email)
    } catch (err) {
      console.error(`[SSR DB Error] hasStudentApplied("${id}", "${decoded.email}"):`, err)
    }
  }

  let companyInfo: CompanyDetails = {
    companyName: job.company_email ? job.company_email.split('@')[0].toUpperCase() : 'Azienda Partner',
    indirizzo: '',
    website: '',
    description: '',
    logo_url: '',
  }

  try {
    if (job.company_email) {
      const contact = await getContact({ identifier: job.company_email })
      const attrs = contact?.attributes || {}

      const resolvedName =
        attrs.NOME_AZIENDA ||
        attrs.AZIENDA ||
        attrs.COMPANY ||
        attrs.REFERENTE ||
        companyInfo.companyName

      companyInfo = {
        companyName: resolvedName,
        indirizzo: attrs.INDIRIZZO || '',
        website: attrs.SITO_WEB || '',
        description: attrs.DESCRIZIONE || '',
        logo_url: attrs.LOGO_URL || '',
      }
    }
  } catch (brevoErr) {
    console.warn('[SSR Brevo Warning] Impossibile recuperare info Brevo:', brevoErr)
  }

  return {
    props: {
      user: {
        email: decoded.email,
        cv_url: decoded.cv_url || '',
        tipo_utente: decoded.tipo_utente,
      },
      job: JSON.parse(JSON.stringify(job)),
      company: companyInfo,
      hasApplied,
    },
  }
}