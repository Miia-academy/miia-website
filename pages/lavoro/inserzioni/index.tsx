import { GetServerSideProps } from 'next'
import React from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getActiveJobs } from '@modules/jobs/db'
import type { Job } from '@modules/jobs/types'
import { TIPO_CONTRATTO_LABELS, GRADO_ESPERIENZA_LABELS } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { Card, CardHeader, CardBody, CardFooter, Chip, Button, Divider } from '@heroui/react'

// Estendiamo l'interfaccia Job per includere i dati delle candidature
interface JobWithStats extends Job {
  applicant_count?: number
  has_applied?: boolean
}

interface BachecaLavoroProps {
  user: {
    email: string
    name: string
  }
  jobs: JobWithStats[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BachecaLavoro({ user, jobs }: BachecaLavoroProps) {
  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Link di ritorno minimalista */}
        <div className="mb-4 sm:mb-6">
          <Link
            href="/studenti/profilo"
            className="text-sm font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1"
          >
            &larr; Torna al profilo
          </Link>
        </div>

        {/* Header Bacheca */}
        <div className="mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900">
            Bacheca Opportunità
          </h1>
          <p className="mt-2 text-base sm:text-lg text-neutral-500">
            Ciao <span className="font-semibold text-[#009245]">{user.name || user.email}</span>, scopri le posizioni aperte nel Triveneto e candidati.
          </p>
        </div>

        {/* Griglia Inserzioni */}
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 sm:p-12 text-center">
            <h3 className="text-lg font-medium text-neutral-900">Nessuna inserzione attiva</h3>
            <p className="mt-1 text-sm sm:text-base text-neutral-500">Al momento non ci sono posizioni aperte. Torna a controllare più tardi!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {jobs.map((job) => {
              const skillsCount = job.competenze?.length || 0
              const sediText = job.provincie && job.provincie.length > 0 ? job.provincie.join(', ') : 'Triveneto'

              return (
                <Card key={job.id} shadow="sm" className="border border-neutral-200 hover:shadow-md transition-shadow flex flex-col h-full">

                  <CardHeader className="flex flex-col items-start px-4 pt-4 sm:px-6 sm:pt-6 pb-0">
                    {/* RIGA 1: Titolo e Data */}
                    <div className="flex w-full justify-between items-start gap-3">
                      <h3 className="text-lg sm:text-2xl font-extrabold leading-tight text-neutral-900 line-clamp-2">
                        {job.title}
                      </h3>
                      <span className="text-[11px] sm:text-xs text-neutral-400 font-medium shrink-0 mt-1.5">
                        {new Date(job.created_at).toLocaleDateString('it-IT')}
                      </span>
                    </div>

                    {/* RIGA 2: Info rapide (Zona, Contratto, Esperienza) */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 sm:mt-4">
                      <Chip size="sm" variant="flat" className="bg-neutral-100 text-neutral-700 font-medium">
                        <span className="font-semibold opacity-70 mr-1">Zona:</span>
                        {sediText}
                      </Chip>
                      {job.tipo_contratto && (
                        <Chip size="sm" variant="flat" className="bg-neutral-100 text-neutral-700 font-medium">
                          {TIPO_CONTRATTO_LABELS[job.tipo_contratto] || job.tipo_contratto}
                        </Chip>
                      )}
                      {job.grado_esperienza && (
                        <Chip size="sm" variant="flat" className="bg-neutral-100 text-neutral-700 font-medium">
                          {GRADO_ESPERIENZA_LABELS[job.grado_esperienza] || job.grado_esperienza}
                        </Chip>
                      )}
                    </div>
                  </CardHeader>

                  <CardBody className="px-4 py-3 sm:px-6 sm:py-4 flex-grow flex flex-col gap-3 sm-gap-4">
                    {/* RIGA 3: Descrizione */}
                    <p className="text-xs sm:text-sm text-neutral-600 line-clamp-3 leading-relaxed flex-grow">
                      {job.description}
                    </p>

                    {/* RIGA 4: Competenze */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] sm:text-xs text-neutral-500 font-medium">Competenze richieste:</span>
                      <Chip size="sm" variant="flat" className="bg-neutral-100 text-neutral-700 font-bold text-xs">
                        {skillsCount} {skillsCount === 1 ? 'competenza' : 'competenze'}
                      </Chip>
                    </div>

                    <Divider className="my-1 sm:my-2" />

                    {/* RIGA 5: Statistiche Candidature */}
                    <div className="w-full flex justify-between items-center text-[11px] sm:text-xs">
                      <span className="text-neutral-500 font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {job.applicant_count || 0} {(job.applicant_count === 1) ? 'candidatura' : 'candidature'} in corso
                      </span>

                      {job.has_applied && (
                        <span className="text-[#009245] font-bold flex items-center gap-1 bg-[#009245]/10 px-2 py-0.5 rounded">
                          ✓ Già candidato
                        </span>
                      )}
                    </div>
                  </CardBody>

                  <CardFooter className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
                    {/* Bottone Ghost Nativo */}
                    <Button
                      as={Link}
                      href={`/lavoro/inserzioni/${job.id}`}
                      variant="ghost"
                      color="primary"
                      className="w-full font-bold"
                    >
                      Vedi Dettagli
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  // 1. Controllo presenza token
  if (!token) {
    return {
      redirect: {
        destination: '/studenti/login?redirect=/lavoro/inserzioni',
        permanent: false,
      },
    }
  }

  let decoded: AuthPayload

  // 2. Validazione JWT isolata
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    console.error('❌ Errore JWT Bacheca Lavoro:', err)
    return {
      redirect: {
        destination: '/studenti/login?redirect=/lavoro/inserzioni',
        permanent: false,
      },
    }
  }

  // 3. Controllo Ruolo
  if (decoded.tipo_utente === 'Azienda') {
    return {
      redirect: {
        destination: '/aziende/profilo',
        permanent: false,
      },
    }
  }

  // 4. Fetching Dati Database
  try {
    const jobs = await getActiveJobs()

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
        },
        jobs: JSON.parse(JSON.stringify(jobs)),
      },
    }
  } catch (dbError) {
    console.error('❌ Errore Database in getActiveJobs:', dbError)

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
        },
        jobs: [],
      },
    }
  }
}