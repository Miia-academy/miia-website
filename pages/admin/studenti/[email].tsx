import { GetServerSideProps } from 'next'
import React from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getContact } from '@modules/brevo'
import { getStudentApplications } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'
import { useDataContext } from '@modules/context'
import { Card, CardHeader, CardBody, Chip, Button, Divider } from '@heroui/react'

interface StudentDetailProps {
  student: {
    email: string
    nome: string
    cognome: string
    sms: string
    indirizzo: string
    provincia: string
    ricerca_attiva: boolean | null
    automunito: boolean | null
    trasferte: boolean | null
    cv_url: string
    portfolio_url: string
    competenze: string[]
  }
  applications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function AdminStudentView({ student, applications }: StudentDetailProps) {
  const { competenze: masterCompetenze } = useDataContext()
  const fullName = [student.nome, student.cognome].filter(Boolean).join(' ')

  const detailedSkills = student.competenze.map((skillKey) => {
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
      title: isLongText ? 'Competenza specifica' : skillKey,
      description: isLongText ? skillKey : null,
    }
  })

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

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'validata':
      case 'accettata':
      case 'letta':
        return 'success'
      case 'rifiutata':
        return 'danger'
      default:
        return 'warning'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <Link
          href="/admin/profilo"
          className="text-sm font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1"
        >
          &larr; Torna al Pannello
        </Link>

        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 pb-4 flex flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                Profilo Candidato
              </span>
              {student.ricerca_attiva === true && (
                <Chip size="sm" color="success" variant="flat" className="font-bold">
                  In Cerca Attiva
                </Chip>
              )}
              {student.ricerca_attiva === false && (
                <Chip size="sm" color="default" variant="flat" className="font-bold">
                  Non in Cerca Attiva
                </Chip>
              )}
              {student.ricerca_attiva === null && (
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
                  {student.sms || <span className="text-red-500 italic text-sm">Mancante</span>}
                </span>
              </div>

              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Provincia</span>
                <span className="text-base font-semibold text-neutral-800 uppercase">
                  {student.provincia || <span className="text-red-500 italic text-sm">Mancante</span>}
                </span>
              </div>

              <div>
                <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Indirizzo</span>
                <span className="text-base font-medium text-neutral-800">
                  {student.indirizzo || <span className="text-red-500 italic text-sm">Mancante</span>}
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
                {renderBooleanStatus(student.trasferte, 'Trasferte', 'Disponibile a Trasferte', 'No Trasferte')}
              </div>
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Competenze
              </span>
              {detailedSkills.length > 0 ? (
                <div className="space-y-4 mt-2">
                  {detailedSkills.map((skill, idx) => (
                    <div key={idx} className="flex items-start gap-3">
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
              ) : (
                <p className="text-sm text-neutral-400 italic">Nessuna competenza salvata</p>
              )}
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Allegati Candidato
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                {student.cv_url ? (
                  <Button
                    as="a"
                    href={student.cv_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-white bg-[#009245]"
                  >
                    📄 Download Curriculum (PDF)
                  </Button>
                ) : (
                  <span className="text-sm text-red-500 italic font-semibold">Curriculum: Mancante</span>
                )}

                {student.portfolio_url ? (
                  <Button
                    as="a"
                    href={student.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    variant="flat"
                    className="font-bold"
                  >
                    🔗 Vedi Portfolio
                  </Button>
                ) : (
                  <span className="text-sm text-neutral-400 italic">Portfolio: Non caricato</span>
                )}
              </div>
            </div>

          </CardBody>
        </Card>

        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 pb-2 flex justify-between items-center">
            <h2 className="text-xl font-bold text-neutral-900">
              Candidature Inviate ({applications.length})
            </h2>
          </CardHeader>

          <Divider className="my-2" />

          <CardBody className="p-6">
            {applications.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">
                Lo studente non si è ancora candidato a nessuna offerta di lavoro.
              </p>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div
                    key={app.application_id}
                    className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <Link
                        href={`/lavoro/inserzioni/${app.job_id}`}
                        className="text-base font-bold text-neutral-900 hover:text-[#009245] transition-colors"
                      >
                        {app.title}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        Inviata il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                        {app.provincie && app.provincie.length > 0 && ` • Sede: ${app.provincie.join(', ')}`}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {app.viewed_at ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                            ✓ Visto dall'Azienda il {new Date(app.viewed_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            ● Non ancora letto dall'azienda
                          </span>
                        )}

                        {app.cv_downloaded_at ? (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                            📄 CV Scaricato il {new Date(app.cv_downloaded_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-neutral-500 bg-neutral-200 px-2 py-0.5 rounded">
                            CV Non scaricato dall'azienda
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Chip
                        size="sm"
                        variant="flat"
                        color={getStatusChipColor(app.status)}
                        className="font-semibold uppercase tracking-wider text-[10px]"
                      >
                        {app.status ? app.status.replace('_', ' ') : 'in revisione'}
                      </Chip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']
  const studentEmailParam = context.params?.email as string

  if (!token || !studentEmailParam) {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Admin') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const cleanEmail = decodeURIComponent(studentEmailParam).trim().toLowerCase()
    const contact = await getContact({ identifier: cleanEmail }).catch(() => null)
    const attrs = contact?.attributes || {}

    const parseBooleanAttr = (val: any): boolean | null => {
      if (val === undefined || val === null || val === '') return null
      if (val === true || val === 'true') return true
      if (val === false || val === 'false') return false
      return null
    }

    const parseAndHealCompetenze = (raw: any): string[] => {
      let arr: string[] = []
      if (Array.isArray(raw)) {
        arr = raw.map(s => String(s).trim())
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) arr = parsed.map(s => String(s).trim())
          else arr = raw.split(',').map(s => s.trim())
        } catch {
          arr = raw.split(',').map(s => s.trim())
        }
      }

      const grouped: string[] = []
      for (const frag of arr) {
        if (!frag) continue
        if (grouped.length > 0 && /^[a-zèéìòù]/.test(frag)) {
          grouped[grouped.length - 1] += ', ' + frag
        } else {
          grouped.push(frag)
        }
      }
      return grouped
    }

    let applications: any[] = []
    try {
      applications = await getStudentApplications(cleanEmail)
    } catch (appErr) {
      console.warn('[Admin Student SSR Warning] Errore recupero candidature:', appErr)
    }

    return {
      props: {
        student: {
          email: cleanEmail,
          nome: attrs.NOME || attrs.FIRSTNAME || '',
          cognome: attrs.COGNOME || attrs.LASTNAME || '',
          sms: attrs.SMS || attrs.TELEFONO || '',
          indirizzo: attrs.INDIRIZZO || '',
          provincia: attrs.PROVINCIA || '',
          ricerca_attiva: parseBooleanAttr(attrs.RICERCA_ATTIVA),
          automunito: parseBooleanAttr(attrs.AUTOMUNITO),
          trasferte: parseBooleanAttr(attrs.TRASFERTE),
          cv_url: attrs.CV_URL || '',
          portfolio_url: attrs.PORTFOLIO_URL || '',
          competenze: parseAndHealCompetenze(attrs.COMPETENZE),
        },
        applications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch (err) {
    console.error('❌ Errore SSR Student View:', err)
    return { redirect: { destination: '/admin/profilo', permanent: false } }
  }
}