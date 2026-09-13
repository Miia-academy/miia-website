import { GetServerSideProps } from 'next'
import React from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getActiveJobs } from '@modules/jobs/db'
import type { Job } from '@modules/jobs/types'
import type { AuthPayload } from '@modules/auth'
import { Card, CardHeader, CardBody, CardFooter, Chip, Button } from '@heroui/react'

interface BachecaLavoroProps {
  user: {
    email: string
    name: string
  }
  jobs: Job[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BachecaLavoro({ user, jobs }: BachecaLavoroProps) {
  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Header Bacheca */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">
            Bacheca Opportunità
          </h1>
          <p className="mt-2 text-lg text-neutral-500">
            Ciao <span className="font-semibold text-[#009245]">{user.name || user.email}</span>, scopri le posizioni aperte e candidati.
          </p>
        </div>

        {/* Griglia Inserzioni */}
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center">
            <h3 className="text-lg font-medium text-neutral-900">Nessuna inserzione attiva</h3>
            <p className="mt-1 text-neutral-500">Al momento non ci sono posizioni aperte. Torna a controllare più tardi!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card key={job.id} shadow="sm" className="border border-neutral-200 hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-col items-start gap-2 pt-6 px-6">
                  <div className="flex w-full justify-between items-center">
                    <Chip size="sm" variant="flat" color="primary" className="font-semibold uppercase tracking-wider text-[10px]">
                      {job.provincia}
                    </Chip>
                    <span className="text-xs text-neutral-400">
                      {new Date(job.created_at).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold leading-tight text-neutral-900 mt-2 line-clamp-2">
                    {job.title}
                  </h3>
                </CardHeader>

                <CardBody className="px-6 py-2">
                  <p className="text-sm text-neutral-600 line-clamp-3">
                    {job.description}
                  </p>

                  <div className="flex flex-wrap gap-1 mt-4">
                    {(job.competenze || []).slice(0, 3).map((skill) => (
                      <Chip key={skill} size="sm" variant="flat" className="bg-neutral-100 text-neutral-600 text-[11px]">
                        {skill}
                      </Chip>
                    ))}
                    {(job.competenze?.length || 0) > 3 && (
                      <span className="text-xs text-neutral-400 font-medium ml-1 flex items-center">
                        +{job.competenze.length - 3}
                      </span>
                    )}
                  </div>
                </CardBody>

                <CardFooter className="px-6 pb-6 pt-4">
                  <Button
                    as={Link}
                    href={`/lavoro/inserzioni/${job.id}`}
                    className="w-full bg-black text-white font-semibold"
                  >
                    Vedi Dettagli
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

// ============================================================================
// SERVER-SIDE GATEKEEPER
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  // 1. Nessun token? Manda al login studenti salvando la pagina di destinazione
  if (!token) {
    return {
      redirect: {
        destination: '/studenti/login?redirect=/lavoro/inserzioni',
        permanent: false,
      },
    }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    // 2. Sei un'Azienda? Ti caccio nella tua dashboard B2B
    if (decoded.tipo_utente === 'Azienda') {
      return {
        redirect: {
          destination: '/aziende/inserzioni',
          permanent: false,
        },
      }
    }

    // 3. Sei uno Studente? Ti faccio passare e recupero le inserzioni 'attive' dal DB transazionale
    const jobs = await getActiveJobs()

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
        },
        // Serializziamo l'array di oggetti (i timestamp di Neon possono dare fastidio al JSON di Next)
        jobs: JSON.parse(JSON.stringify(jobs)),
      },
    }
  } catch (error) {
    // Token scaduto o manomesso
    return {
      redirect: {
        destination: '/studenti/login?redirect=/lavoro/inserzioni',
        permanent: false,
      },
    }
  }
}