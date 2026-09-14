import { GetServerSideProps } from 'next'
import React from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getContact } from '@modules/brevo'
import type { AuthPayload } from '@modules/auth'
import { Card, CardHeader, CardBody, Chip, Button, Divider } from '@heroui/react'

interface StudentProfileProps {
  student: {
    email: string
    nome: string
    cognome: string
    sms: string
    indirizzo: string
    provincia: string
    ricercaAttiva: boolean | null
    automunito: boolean | null
    disponibileTrasferte: boolean | null
    cvUrl: string
    portfolioUrl: string
    competenze: string[]
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function AdminStudentView({ student }: StudentProfileProps) {
  const fullName = [student.nome, student.cognome].filter(Boolean).join(' ')

  // Helper a 3 stati con nome del campo sempre esplicito
  const renderBooleanStatus = (
    val: boolean | null,
    label: string,
    trueLabel: string,
    falseLabel: string
  ) => {
    if (val === true) {
      return <Chip variant="flat" color="primary">✓ {trueLabel}</Chip>
    }
    if (val === false) {
      return <Chip variant="flat" color="default">✕ {falseLabel}</Chip>
    }
    return (
      <Chip variant="flat" color="warning" className="text-neutral-700 font-medium">
        {label}: Mancante
      </Chip>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        <Link
          href="/admin/profilo"
          className="text-sm font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1"
        >
          &larr; Torna al Pannello Operativo
        </Link>

        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 pb-4 flex flex-col items-start gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                Profilo Candidato
              </span>
              {student.ricercaAttiva === true && (
                <Chip size="sm" color="success" variant="flat" className="font-bold">
                  In Cerca Attiva
                </Chip>
              )}
              {student.ricercaAttiva === false && (
                <Chip size="sm" color="default" variant="flat" className="font-bold">
                  Non in Cerca Attiva
                </Chip>
              )}
              {student.ricercaAttiva === null && (
                <Chip size="sm" color="warning" variant="flat" className="font-bold text-neutral-700">
                  Cerca Attiva: Mancante
                </Chip>
              )}
            </div>

            <h1 className="text-3xl font-extrabold text-neutral-900 mt-2">
              {fullName || student.email}
            </h1>
            <p className="text-sm text-neutral-500">{student.email}</p>
          </CardHeader>

          <Divider />

          <CardBody className="p-6 space-y-6">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Email</span>
                <span className="text-base font-semibold text-neutral-800 break-all">{student.email}</span>
              </div>

              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Telefono / SMS</span>
                <span className="text-base font-semibold text-neutral-800">
                  {student.sms || 'Mancante'}
                </span>
              </div>

              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Provincia</span>
                <span className="text-base font-semibold text-neutral-800 uppercase">
                  {student.provincia || 'Mancante'}
                </span>
              </div>

              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Indirizzo</span>
                <span className="text-base font-medium text-neutral-800">
                  {student.indirizzo || 'Mancante'}
                </span>
              </div>
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Mobilità e Disponibilità
              </span>
              <div className="flex flex-wrap gap-2">
                {renderBooleanStatus(student.automunito, 'Automunito', 'Automunito', 'Non Automunito')}
                {renderBooleanStatus(student.disponibileTrasferte, 'Trasferte', 'Disponibile a Trasferte', 'No Trasferte')}
              </div>
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Competenze
              </span>
              {student.competenze.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {student.competenze.map((skill, idx) => (
                    <Chip key={idx} size="md" variant="flat" className="bg-neutral-100 text-neutral-800 font-medium">
                      {skill}
                    </Chip>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400 italic">Mancante</p>
              )}
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Allegati Candidato
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                {student.cvUrl ? (
                  <Button
                    as="a"
                    href={student.cvUrl}
                    target="_blank"
                    color="primary"
                    className="font-bold text-white"
                  >
                    Download Curriculum (PDF)
                  </Button>
                ) : (
                  <span className="text-sm text-neutral-400 italic">Curriculum: Mancante</span>
                )}

                {student.portfolioUrl ? (
                  <Button
                    as="a"
                    href={student.portfolioUrl}
                    target="_blank"
                    variant="flat"
                    className="font-bold"
                  >
                    Vedi Portfolio
                  </Button>
                ) : (
                  <span className="text-sm text-neutral-400 italic">Portfolio: Mancante</span>
                )}
              </div>
            </div>

          </CardBody>
        </Card>

      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']
  const studentEmail = context.params?.email as string

  if (!token || !studentEmail) {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Admin') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const decodedEmail = decodeURIComponent(studentEmail)
    const contact = await getContact({ identifier: decodedEmail }).catch(() => null)
    const attrs = contact?.attributes || {}

    const parseBooleanAttr = (val: any): boolean | null => {
      if (val === undefined || val === null || val === '') return null
      if (val === true || val === 'true') return true
      if (val === false || val === 'false') return false
      return null
    }

    const rawSkills = attrs.COMPETENZE || ''
    const competenze = typeof rawSkills === 'string'
      ? rawSkills.split(',').map((s: string) => s.trim()).filter(Boolean)
      : Array.isArray(rawSkills) ? rawSkills : []

    return {
      props: {
        student: {
          email: decodedEmail,
          nome: attrs.NOME || '',
          cognome: attrs.COGNOME || '',
          sms: attrs.SMS || '',
          indirizzo: attrs.INDIRIZZO || '',
          provincia: attrs.PROVINCIA || '',
          ricercaAttiva: parseBooleanAttr(attrs.RICERCA_ATTIVA),
          automunito: parseBooleanAttr(attrs.AUTOMUNITO),
          disponibileTrasferte: parseBooleanAttr(attrs.TRASFERTE),
          cvUrl: attrs.CV_URL || '',
          portfolioUrl: attrs.PORTFOLIO_URL || '',
          competenze,
        },
      },
    }
  } catch (err) {
    console.error('❌ Errore SSR Student View:', err)
    return { redirect: { destination: '/admin/profilo', permanent: false } }
  }
}