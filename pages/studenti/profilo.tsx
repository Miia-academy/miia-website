import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import Link from 'next/link'
import jwt from 'jsonwebtoken'
import { getStudentApplications } from '@modules/applications/db'
import type { AuthPayload } from '@modules/auth'
import {
  Input,
  Button,
  Chip,
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider
} from '@heroui/react'
import { useDataContext } from '@modules/context'

interface StudentProfileProps {
  user: {
    email: string
    name: string
    surname: string
    provincia: string
    indirizzo: string
    ricerca_attiva: boolean
    automunito: boolean
    disponibile_trasferte: boolean
    competenze: string[]
    cv_url: string
    portfolio_url: string
  }
  applications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function StudentProfile({ user, applications }: StudentProfileProps) {
  const { competenze } = useDataContext()

  // Stato dei dati confermati e mostrati a schermo
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    surname: user.surname || '',
    provincia: user.provincia || '',
    indirizzo: user.indirizzo || '',
    ricerca_attiva: user.ricerca_attiva ?? true,
    automunito: user.automunito ?? false,
    disponibile_trasferte: user.disponibile_trasferte ?? false,
    skills: new Set<string>(user.competenze || []),
    cv_url: user.cv_url || '',
    portfolio_url: user.portfolio_url || '',
  })

  // Stato temporaneo per il form nella modale
  const [editForm, setEditForm] = useState(profileData)

  const [cvFile, setCvFile] = useState<File | null>(null)
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)

  const isCvMissing = !profileData.cv_url

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleOpenProfileModal = () => {
    setEditForm(profileData)
    setCvFile(null)
    setPortfolioFile(null)
    setIsProfileModalOpen(true)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let cvBase64 = '', cvFileName = '', cvMimeType = ''
      if (cvFile) {
        if (cvFile.size > 5 * 1024 * 1024) {
          alert('Il CV supera il limite di 5MB.')
          setLoading(false)
          return
        }
        cvBase64 = await fileToBase64(cvFile)
        cvFileName = cvFile.name
        cvMimeType = cvFile.type
      }

      let portfolioBase64 = '', portfolioFileName = '', portfolioMimeType = ''
      if (portfolioFile) {
        if (portfolioFile.size > 15 * 1024 * 1024) {
          alert('Il Portfolio supera il limite di 15MB.')
          setLoading(false)
          return
        }
        portfolioBase64 = await fileToBase64(portfolioFile)
        portfolioFileName = portfolioFile.name
        portfolioMimeType = portfolioFile.type
      }

      const payload = {
        attributes: {
          NOME: editForm.name,
          COGNOME: editForm.surname,
          PROVINCIA: editForm.provincia.toUpperCase(),
          INDIRIZZO: editForm.indirizzo,
          RICERCA_ATTIVA: editForm.ricerca_attiva,
          AUTOMUNITO: editForm.automunito,
          DISPONIBILE_TRASFERTE: editForm.disponibile_trasferte,
          COMPETENZE: Array.from(editForm.skills),
        },
        cvBase64,
        cvFileName,
        cvMimeType,
        portfolioBase64,
        portfolioFileName,
        portfolioMimeType,
      }

      const res = await fetch('/api/user/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        setProfileData({
          ...editForm,
          cv_url: data.cv_url || profileData.cv_url,
          portfolio_url: data.portfolio_url || profileData.portfolio_url
        })
        setIsProfileModalOpen(false)
      } else {
        alert(data.message || 'Errore durante l\'aggiornamento.')
      }
    } catch {
      alert('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  // Risoluzione delle competenze selezionate per mostrare il testo leggibile
  // 1. Risoluzione delle competenze selezionate (con deduplicazione e descrizione)
  const rawSkills = Array.from(profileData.skills).map((skillKey) => {
    const cleanKey = skillKey.trim()

    const found = (competenze || []).find(
      (s: any) =>
        s.name?.trim() === cleanKey ||
        s.title?.trim() === cleanKey ||
        s.value?.trim() === cleanKey
    )

    if (found) {
      return {
        key: cleanKey,
        title: found.name?.trim() || cleanKey,
        description: found.value && found.value.trim() !== found.name?.trim() ? found.value : null,
      }
    }

    const isLongText = cleanKey.length > 40
    return {
      key: cleanKey,
      title: isLongText ? 'Competenza' : cleanKey,
      description: isLongText ? cleanKey : null,
    }
  })

  // 2. Deduplicazione assoluta (come fatto per le aziende)
  const detailedSkills = rawSkills.filter((skill, index, self) =>
    index === self.findIndex((s) => s.title.toLowerCase() === skill.title.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-neutral-50 py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Header Dashboard */}
      <div className="mx-auto max-w-6xl mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">Area Studente</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Benvenuto, <span className="font-semibold text-neutral-800">{profileData.name ? `${profileData.name} ${profileData.surname}` : user.email}</span>
          </p>
        </div>

        {/* GATEKEEPING: Bottone disabilitato se manca il CV */}
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

      <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">

        {/* Colonna Sinistra (1/3): Dati in Sola Lettura */}
        <div className="lg:col-span-1 space-y-6 order-2 lg:order-1">
          <Card shadow="sm" className="border border-neutral-200">
            <CardHeader className="pt-6 px-5 sm:px-6 font-bold text-xl text-neutral-900 flex justify-between items-center">
              Il Tuo Profilo
            </CardHeader>
            <Divider className="my-2" />

            <CardBody className="px-5 sm:px-6 pb-6 space-y-6">

              {/* Avatar e Nome */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#009245]/10 text-[#009245] flex items-center justify-center font-bold text-2xl shrink-0">
                  {profileData.name ? profileData.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 leading-tight">
                    {profileData.name ? `${profileData.name} ${profileData.surname}` : <span className="text-red-500 italic text-sm">Nome mancante</span>}
                  </h2>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5 break-all">{user.email}</p>
                </div>
              </div>

              {/* Dati Anagrafici */}
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Provincia</span>
                    <p className="font-medium text-neutral-800">{profileData.provincia || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-1">Indirizzo</span>
                    <p className="font-medium text-neutral-800 line-clamp-1">{profileData.indirizzo || <span className="text-red-500 italic text-xs">Mancante</span>}</p>
                  </div>
                </div>

                {/* Tags di disponibilità */}
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-2">Disponibilità</span>
                  <div className="flex flex-wrap gap-2">
                    {profileData.ricerca_attiva ? (
                      <Chip size="sm" color="success" variant="flat">Ricerca Attiva</Chip>
                    ) : (
                      <Chip size="sm" color="default" variant="flat">Non in ricerca</Chip>
                    )}
                    {profileData.automunito && <Chip size="sm" color="primary" variant="flat">Automunito</Chip>}
                    {profileData.disponibile_trasferte && <Chip size="sm" color="primary" variant="flat">Trasferte Ok</Chip>}
                  </div>
                </div>

                {/* Competenze */}
                <div>
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-3">Le Mie Competenze</span>
                  {detailedSkills.length > 0 ? (
                    <div className="space-y-3.5 mt-1">
                      {detailedSkills.map((skill) => (
                        <div key={skill.key} className="flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#009245] mt-1.5 shrink-0" />
                          <div className="space-y-0.5">
                            <h3 className="text-sm font-bold text-neutral-900 leading-tight">
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
                    <span className="text-neutral-400 italic text-xs">Nessuna competenza aggiunta</span>
                  )}
                </div>

                {/* Allegati */}
                <div className="pt-2">
                  <span className="block text-[10px] font-bold uppercase text-neutral-400 tracking-wider mb-2">Allegati</span>
                  <div className="space-y-2">
                    {profileData.cv_url ? (
                      <a href={profileData.cv_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[#009245] hover:underline">
                        📄 Vedi Curriculum
                      </a>
                    ) : (
                      <p className="text-xs text-red-500 font-semibold italic">Nessun CV caricato</p>
                    )}

                    {profileData.portfolio_url && (
                      <a href={profileData.portfolio_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:underline">
                        🔗 Vedi Portfolio
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* GATEKEEPING: Banner di avviso */}
              {isCvMissing && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl mt-4">
                  <h4 className="text-red-800 font-bold text-sm mb-1">Curriculum Mancante!</h4>
                  <p className="text-xs text-red-600 leading-relaxed">
                    Per poter esplorare le offerte di lavoro e candidarti, è necessario caricare il tuo CV in formato PDF.
                  </p>
                </div>
              )}

              <Button onPress={handleOpenProfileModal} className="w-full bg-neutral-900 text-white font-bold h-11">
                Modifica Profilo
              </Button>
            </CardBody>
          </Card>
        </div>

        {/* Colonna Destra (2/3): Candidature */}
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
                      <span className="uppercase text-neutral-500">{app.provincia}</span>
                      <span>•</span>
                      Inviata il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>

                  <div className="flex flex-col items-end shrink-0 gap-1 mt-2 sm:mt-0">
                    <Chip size="sm" variant="flat" color={app.status === 'letta' ? 'success' : app.status === 'rifiutata' ? 'danger' : 'primary'} className="font-semibold uppercase tracking-wider text-[10px]">
                      {app.status.replace('_', ' ')}
                    </Chip>
                    {app.job_status !== 'attiva' && (
                      <span className="text-[10px] text-red-500 font-bold uppercase tracking-wider mt-1">Annuncio chiuso</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =========================================
          MODALE MODIFICA PROFILO STUDENTE
      ========================================= */}
      <Modal isOpen={isProfileModalOpen} onOpenChange={setIsProfileModalOpen} size="lg" scrollBehavior="inside" backdrop="blur">
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <ModalHeader className="border-b border-neutral-100 px-6 py-4 text-xl font-bold">
                Modifica Profilo
              </ModalHeader>

              <ModalBody className="py-6 px-4 sm:px-6 space-y-6">

                {/* Dati Anagrafici */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Dati Anagrafici</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Nome" isRequired value={editForm.name} onValueChange={(v) => setEditForm({ ...editForm, name: v })} variant="flat" />
                    <Input label="Cognome" isRequired value={editForm.surname} onValueChange={(v) => setEditForm({ ...editForm, surname: v })} variant="flat" />
                  </div>
                  <Input label="Indirizzo" placeholder="Via/Piazza, Civico" value={editForm.indirizzo} onValueChange={(v) => setEditForm({ ...editForm, indirizzo: v })} variant="flat" />
                  <Input label="Provincia (Sigla)" placeholder="Es. MI, RM" maxLength={2} value={editForm.provincia} onValueChange={(v) => setEditForm({ ...editForm, provincia: v.toUpperCase() })} variant="flat" />
                </div>

                <Divider className="my-1" />

                {/* Competenze */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Le tue Competenze</span>
                  <Select
                    label="Seleziona competenze"
                    selectionMode="multiple"
                    variant="flat"
                    selectedKeys={editForm.skills}
                    onSelectionChange={(keys) => setEditForm({ ...editForm, skills: keys as Set<string> })}
                    classNames={{ popoverContent: 'max-w-[500px]' }} // Allarghiamo leggermente il popover per le descrizioni lunghe
                  >
                    {(competenze || []).map((skill: any) => {
                      // Estraiamo titolo e descrizione dai dati di Storyblok
                      const title = skill.name?.trim() || skill.value?.trim() || ''
                      const description = (skill.value && skill.value.trim() !== skill.name?.trim()) ? skill.value.trim() : null
                      const key = skill.value || skill.name

                      return (
                        <SelectItem key={key} textValue={title}>
                          <div className="flex flex-col gap-0.5 py-1.5 whitespace-normal">
                            <span className="text-sm font-semibold text-neutral-900 leading-tight">
                              {title}
                            </span>
                            {description && (
                              <span className="text-xs text-neutral-500 font-normal leading-relaxed block">
                                {description}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </Select>
                </div>

                <Divider className="my-1" />

                {/* Disponibilità */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Stato e Disponibilità</span>
                  <div className="flex flex-col gap-3">
                    <Checkbox isSelected={editForm.ricerca_attiva} onValueChange={(v) => setEditForm({ ...editForm, ricerca_attiva: v })}>
                      <span className="text-sm font-medium text-neutral-700">In ricerca attiva di lavoro</span>
                    </Checkbox>
                    <Checkbox isSelected={editForm.automunito} onValueChange={(v) => setEditForm({ ...editForm, automunito: v })}>
                      <span className="text-sm text-neutral-700">Automunito / Patente B</span>
                    </Checkbox>
                    <Checkbox isSelected={editForm.disponibile_trasferte} onValueChange={(v) => setEditForm({ ...editForm, disponibile_trasferte: v })}>
                      <span className="text-sm text-neutral-700">Disponibile a trasferte / trasferimenti</span>
                    </Checkbox>
                  </div>
                </div>

                <Divider className="my-1" />

                {/* Allegati */}
                <div className="space-y-4">
                  <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Documenti</span>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Curriculum Vitae (PDF max 5MB) <span className="text-red-500">*</span></label>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#009245]/10 file:text-[#009245] hover:file:bg-[#009245]/20 transition-colors"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Portfolio (PDF/ZIP max 15MB)</label>
                    <input
                      type="file"
                      accept="application/pdf,application/zip,application/x-zip-compressed"
                      onChange={(e) => setPortfolioFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition-colors"
                    />
                  </div>
                </div>

              </ModalBody>

              <ModalFooter className="border-t border-neutral-100 px-6 py-4">
                <Button variant="flat" onPress={onClose} disabled={loading} className="w-full sm:w-auto">
                  Annulla
                </Button>
                <Button type="submit" isLoading={loading} className="w-full sm:w-auto bg-black text-white font-bold shadow-sm">
                  Salva Profilo
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

    </div>
  )
}

// ============================================================================
// SERVER-SIDE LOGIC 
// ============================================================================
export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/studenti/login?redirect=/studenti/profilo', permanent: false } }
  }

  let decoded: AuthPayload

  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch (err) {
    console.error('❌ Errore JWT Studente:', err)
    return { redirect: { destination: '/studenti/login', permanent: false } }
  }

  if (decoded.tipo_utente !== 'Studente') {
    return { redirect: { destination: '/', permanent: false } }
  }

  try {
    const applications = await getStudentApplications(decoded.email)

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
          surname: decoded.surname || '',
          provincia: (decoded as any).provincia || '',
          indirizzo: (decoded as any).indirizzo || '',
          ricerca_attiva: (decoded as any).ricerca_attiva ?? true,
          automunito: (decoded as any).automunito ?? false,
          disponibile_trasferte: (decoded as any).disponibile_trasferte ?? false,
          competenze: Array.isArray((decoded as any).competenze) ? (decoded as any).competenze : [],
          cv_url: decoded.cv_url || '',
          portfolio_url: (decoded as any).portfolio_url || '',
        },
        applications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch (dbError) {
    console.error('❌ Errore Database in getStudentApplications:', dbError)

    return {
      props: {
        user: {
          email: decoded.email,
          name: decoded.name || '',
          surname: decoded.surname || '',
          provincia: (decoded as any).provincia || '',
          indirizzo: (decoded as any).indirizzo || '',
          ricerca_attiva: (decoded as any).ricerca_attiva ?? true,
          automunito: (decoded as any).automunito ?? false,
          disponibile_trasferte: (decoded as any).disponibile_trasferte ?? false,
          competenze: Array.isArray((decoded as any).competenze) ? (decoded as any).competenze : [],
          cv_url: decoded.cv_url || '',
          portfolio_url: (decoded as any).portfolio_url || '',
        },
        applications: [],
      },
    }
  }
}