import { GetServerSideProps } from 'next'
import React from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getContact } from '@modules/brevo'
import { markApplicationAsViewed } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'
import { useDataContext } from '@modules/context'
import { Card, CardHeader, CardBody, Chip, Button, Divider } from '@heroui/react'

interface BusinessStudentViewProps {
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
  jobId: string
  appId: string
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function BusinessStudentView({ student, appId }: BusinessStudentViewProps) {
  const { competenze: masterCompetenze } = useDataContext()
  const fullName = [student.nome, student.cognome].filter(Boolean).join(' ') || student.email

  // Mappatura competenze (Titolo + Descrizione)
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
    trueLabel: string,
    falseLabel: string
  ) => {
    if (val === true) return <Chip variant="flat" color="primary">✓ {trueLabel}</Chip>
    if (val === false) return <Chip variant="flat" color="default">✕ {falseLabel}</Chip>
    return <Chip variant="flat" color="warning" className="text-neutral-700">Mancante</Chip>
  }

  const getCvDownloadUrl = () => {
    if (!student.cv_url) return '#'
    return `/api/job/download?file=${encodeURIComponent(student.cv_url)}&application_id=${encodeURIComponent(appId)}`
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">

        <Link
          href="/aziende/profilo"
          className="text-sm font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center gap-1"
        >
          &larr; Torna alla Dashboard Azienda
        </Link>

        <Card shadow="sm" className="border border-neutral-200">
          <CardHeader className="pt-6 px-6 pb-4 flex flex-col items-start gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
              Scheda Dettaglio Candidato
            </span>
            <h1 className="text-3xl font-extrabold text-neutral-900 mt-2">
              {fullName}
            </h1>
          </CardHeader>

          <Divider />

          <CardBody className="p-6 space-y-6">

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Recapiti & Informazioni di Contatto
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Email</span>
                  <a href={`mailto:${student.email}`} className="text-base font-semibold text-emerald-700 hover:underline break-all">
                    {student.email}
                  </a>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Telefono / SMS</span>
                  <a href={`tel:${student.sms}`} className="text-base font-semibold text-neutral-800 hover:underline">
                    {student.sms || <span className="text-red-500 italic text-sm">Mancante</span>}
                  </a>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Provincia</span>
                  <span className="text-base font-semibold text-neutral-800 uppercase">
                    {student.provincia || <span className="text-red-500 italic text-sm">Mancante</span>}
                  </span>
                </div>
                <div>
                  <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Indirizzo Sede / Residenza</span>
                  <span className="text-base font-medium text-neutral-800">
                    {student.indirizzo || <span className="text-red-500 italic text-sm">Mancante</span>}
                  </span>
                </div>
              </div>
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Mobilità e Disponibilità
              </span>
              <div className="flex flex-wrap gap-2">
                {renderBooleanStatus(student.automunito, 'Automunito', 'Non Automunito')}
                {renderBooleanStatus(student.trasferte, 'Disponibile a Trasferte', 'No Trasferte')}
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
                <p className="text-sm text-neutral-400 italic">Nessuna competenza specificata</p>
              )}
            </div>

            <Divider />

            <div>
              <span className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                Documenti Candidato
              </span>
              <div className="flex flex-wrap gap-3 items-center">
                {student.cv_url ? (
                  <Button
                    as="a"
                    href={getCvDownloadUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-white bg-[#009245]"
                  >
                    📄 Scarica Curriculum Vitae (PDF)
                  </Button>
                ) : (
                  <span className="text-sm text-red-500 italic font-semibold">Curriculum Vitae: Mancante</span>
                )}

                {student.portfolio_url && (
                  <Button
                    as="a"
                    href={student.portfolio_url}
                    target="_blank"
                    rel="noreferrer"
                    variant="flat"
                    className="font-bold"
                  >
                    🔗 Apri Portfolio
                  </Button>
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
  const studentEmailParam = context.params?.email as string
  const jobId = (context.query.jobId as string) || ''
  const appId = (context.query.appId as string) || ''

  if (!token || !studentEmailParam) {
    return { redirect: { destination: '/aziende/login', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Azienda') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const cleanEmail = decodeURIComponent(studentEmailParam).trim().toLowerCase()

    if (appId) {
      await markApplicationAsViewed(appId, decoded.email).catch((err) =>
        console.warn('[SSR View Tracking Warning]', err)
      )
    }

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
        jobId,
        appId,
      },
    }
  } catch (err) {
    console.error('❌ Errore SSR Business Student View:', err)
    return { redirect: { destination: '/aziende/profilo', permanent: false } }
  }
}