import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getStudentApplications } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'
import { Button, Chip, Card, CardBody, CardHeader, Divider } from '@heroui/react'
import { useDataContext } from '@modules/context'
import { StudentProfileModal, StudentProfileData } from '@components/student/StudentProfileModal'
import { LogoutButton } from '@components/shared/LogoutButton'

interface StudentProfileProps {
  user: StudentProfileData & { email: string; competenze: string[] }
  applications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function StudentProfile({ user, applications }: StudentProfileProps) {
  const { competenze } = useDataContext()
  const [profileData, setProfileData] = useState<StudentProfileData>({
    ...user,
    skills: new Set<string>(user.competenze || []),
  })
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const isCvMissing = !profileData.cv_url

  const rawSkills = Array.from(profileData.skills).map((skillKey) => {
    const cleanKey = skillKey.trim()

    // Fallback storico: se la stringa salvata nel DB è un'intera frase
    if (cleanKey.length > 40) {
      return { key: cleanKey, title: 'Competenza Storica', description: cleanKey }
    }

    // Casting as any per scavalcare il limite dell'interfaccia Competenza e testare chiavi fallback
    const found = (competenze || []).find((s: any) =>
      s.name?.trim() === cleanKey || s.title?.trim() === cleanKey
    ) as any

    if (found) {
      const title = found.name?.trim() || found.title?.trim() || cleanKey
      const description = found.value && found.value.trim() !== title ? found.value.trim() : null
      return { key: cleanKey, title, description }
    }

    return { key: cleanKey, title: cleanKey, description: null }
  })

  const detailedSkills = rawSkills.filter((skill, index, self) => index === self.findIndex((s) => s.title.toLowerCase() === skill.title.toLowerCase()))

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'accettata': case 'letta': return 'success'
      case 'rifiutata': return 'danger'
      default: return 'primary'
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">Area Studente</h1>
          <p className="mt-1 text-sm text-neutral-500">Benvenuto, <span className="font-semibold text-neutral-800">{profileData.nome ? `${profileData.nome} ${profileData.cognome}` : user.email}</span></p>
        </div>
        <div>
          <LogoutButton
            redirectTo="/studenti/login"
            variant="light"
            color="default"
            label="Esci"
          />
          {isCvMissing ? (
            <Button isDisabled className="w-full md:w-auto bg-neutral-200 text-neutral-500 font-bold shadow-sm h-11 shrink-0 opacity-100 cursor-not-allowed">
              Carica il CV per accedere
            </Button>
          ) : (
            <Button as={Link} href="/lavoro/inserzioni" className="w-full md:w-auto bg-[#009245] text-white font-bold shadow-sm h-11 shrink-0">
              Vai alla Bacheca Inserzioni &rarr;
            </Button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-5 sm:px-6 font-bold text-xl text-neutral-900 flex justify-between items-center">
              Il Tuo Profilo
            </CardHeader>
            <Divider className="my-2" />
            <CardBody className="px-5 sm:px-6 pb-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#009245]/10 text-[#009245] flex items-center justify-center font-bold text-2xl shrink-0">
                  {profileData.nome ? profileData.nome.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">
                    {profileData.nome ? `${profileData.nome} ${profileData.cognome}` : <span className="text-red-500 italic text-sm">Nome mancante</span>}
                  </h2>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5 break-all">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Telefono</span>
                    <p className="font-medium text-neutral-800">{profileData.sms || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Provincia</span>
                    <p className="font-medium text-neutral-800 uppercase">{profileData.provincia || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Indirizzo</span>
                  <p className="font-medium text-neutral-800 line-clamp-1">{profileData.indirizzo || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-2">Disponibilità</span>
                  <div className="flex flex-wrap gap-2">
                    {profileData.ricerca_attiva ? <Chip size="sm" color="success" variant="flat">Ricerca Attiva</Chip> : <Chip size="sm" color="default" variant="flat">Non in ricerca</Chip>}
                    {profileData.automunito && <Chip size="sm" color="primary" variant="flat">Automunito</Chip>}
                    {profileData.trasferte && <Chip size="sm" color="primary" variant="flat">Trasferte Ok</Chip>}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-3">Le Mie Competenze</span>
                  {detailedSkills.length > 0 ? (
                    <div className="space-y-3.5 mt-1">
                      {detailedSkills.map((skill) => (
                        <div key={skill.key} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#009245] mt-1.5 shrink-0" />
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-neutral-900 leading-tight">{skill.title}</h3>
                            {skill.description && <p className="text-xs text-neutral-500 leading-relaxed">{skill.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <span className="text-neutral-400 italic text-xs">Nessuna competenza aggiunta</span>}
                </div>
                <div className="pt-2">
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-2">Allegati</span>
                  <div className="space-y-2">
                    {profileData.cv_url ? (
                      <a href={profileData.cv_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[#009245] hover:underline">📄 Vedi Curriculum</a>
                    ) : <p className="text-xs text-red-500 font-semibold italic">Nessun CV caricato</p>}
                    {profileData.portfolio_url && <a href={profileData.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:underline">🔗 Vedi Portfolio</a>}
                  </div>
                </div>
              </div>
              {isCvMissing && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl mt-4">
                  <h4 className="text-red-800 font-bold text-sm mb-1">Curriculum Mancante!</h4>
                  <p className="text-xs text-red-600 leading-relaxed">Per poter esplorare le offerte di lavoro e candidarti, è necessario caricare il tuo CV in formato PDF.</p>
                </div>
              )}
              <Button onPress={() => setIsProfileModalOpen(true)} className="w-full bg-neutral-900 text-white font-bold h-11">
                Modifica Profilo
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2 order-1 lg:order-2 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
            <h2 className="font-bold text-xl text-neutral-900">Le Mie Candidature</h2>
            <span className="text-sm text-neutral-500 font-medium">{applications.length} Inviate</span>
          </div>
          {applications.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-neutral-300 rounded-2xl bg-white mt-4">
              <p className="text-neutral-500 mb-4">Non ti sei ancora candidato a nessuna offerta.</p>
              <Button as={Link} href={isCvMissing ? "#" : "/lavoro/inserzioni"} isDisabled={isCvMissing} variant="flat" color="primary" className="font-semibold">
                Esplora le Opportunità
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-4">
              {applications.map((app) => (
                <div key={app.application_id} className="bg-white border border-neutral-200 rounded-xl p-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm hover:border-neutral-300 transition-all">
                  <div className="flex-1 min-w-0">
                    <Link href={`/lavoro/inserzioni/${app.job_id}`} className="text-[17px] font-bold text-neutral-900 hover:text-[#009245] transition-colors leading-tight line-clamp-1 block">
                      {app.title}
                    </Link>
                    <p className="text-[11px] font-bold text-neutral-400 tracking-wider mt-1.5 flex items-center gap-2">
                      <span className="uppercase text-neutral-500">{Array.isArray(app.provincie) && app.provincie.length > 0 ? app.provincie.join(', ') : app.provincia || 'Triveneto'}</span>
                      <span>•</span>
                      Inviata il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 gap-1 mt-2 sm:mt-0">
                    <Chip size="sm" variant="flat" color={getStatusChipColor(app.status)} className="font-semibold uppercase tracking-wider text-[10px]">
                      {app.status ? app.status.replace('_', ' ') : 'in valutazione'}
                    </Chip>
                    {app.job_status && app.job_status !== 'attiva' && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1">Annuncio chiuso</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <StudentProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} initialData={profileData} onSuccess={setProfileData} />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']
  if (!token) return { redirect: { destination: '/studenti/login?redirect=/studenti/profilo', permanent: false } }

  let decoded: AuthPayload
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    return { redirect: { destination: '/studenti/login', permanent: false } }
  }

  if (decoded.tipo_utente !== 'Studente') return { redirect: { destination: '/', permanent: false } }

  const mappedUser = {
    email: decoded.email,
    nome: decoded.nome || (decoded as any).name || '',
    cognome: decoded.cognome || (decoded as any).surname || '',
    sms: decoded.sms || (decoded as any).telefono || '',
    provincia: decoded.provincia || '',
    indirizzo: decoded.indirizzo || '',
    ricerca_attiva: decoded.ricerca_attiva ?? true,
    automunito: decoded.automunito ?? false,
    trasferte: decoded.trasferte ?? (decoded as any).disponibile_trasferte ?? false,
    competenze: Array.isArray(decoded.competenze) ? decoded.competenze : [],
    cv_url: decoded.cv_url || '',
    portfolio_url: decoded.portfolio_url || '',
  }

  try {
    const applications = await getStudentApplications(decoded.email)
    return {
      props: {
        user: mappedUser,
        applications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch {
    return {
      props: {
        user: mappedUser,
        applications: [],
      },
    }
  }
}