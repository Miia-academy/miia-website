import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Divider, Select, SelectItem, Checkbox } from '@heroui/react'
import { useDataContext } from '@modules/context'

export interface StudentProfileData {
  nome: string
  cognome: string
  sms: string
  provincia: string
  indirizzo: string
  ricerca_attiva: boolean
  automunito: boolean
  trasferte: boolean
  skills: Set<string>
  cv_url: string
  portfolio_url: string
}

interface StudentProfileModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: StudentProfileData
  onSuccess: (updatedData: StudentProfileData) => void
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

export function StudentProfileModal({ isOpen, onClose, initialData, onSuccess }: StudentProfileModalProps) {
  const { competenze } = useDataContext()
  const [editForm, setEditForm] = useState<StudentProfileData>(initialData)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEditForm(initialData)
      setCvFile(null)
      setPortfolioFile(null)
    }
  }, [isOpen, initialData])

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
          NOME: editForm.nome,
          COGNOME: editForm.cognome,
          SMS: editForm.sms,
          PROVINCIA: editForm.provincia.toUpperCase(),
          INDIRIZZO: editForm.indirizzo,
          RICERCA_ATTIVA: editForm.ricerca_attiva,
          AUTOMUNITO: editForm.automunito,
          TRASFERTE: editForm.trasferte,
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
        onSuccess({
          ...editForm,
          cv_url: data.cv_url || editForm.cv_url,
          portfolio_url: data.portfolio_url || editForm.portfolio_url
        })
        onClose()
      } else {
        alert(data.message || 'Errore durante l\'aggiornamento.')
      }
    } catch {
      alert('Errore di connessione. Riprova più tardi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => !open && onClose()} size="lg" scrollBehavior="inside" backdrop="blur">
      <ModalContent>
        {() => (
          <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 overflow-hidden min-h-0">
            <ModalHeader className="border-b border-neutral-100 px-6 py-4 text-xl font-bold">
              Modifica Profilo
            </ModalHeader>

            <ModalBody className="py-6 px-4 sm:px-6 space-y-6">
              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Dati Anagrafici & Contatti</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Nome" isRequired value={editForm.nome} onValueChange={(v) => setEditForm({ ...editForm, nome: v })} variant="flat" />
                  <Input label="Cognome" isRequired value={editForm.cognome} onValueChange={(v) => setEditForm({ ...editForm, cognome: v })} variant="flat" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input type="tel" label="Telefono / SMS" placeholder="Es. +393401234567" value={editForm.sms} onValueChange={(v) => setEditForm({ ...editForm, sms: v })} variant="flat" />
                  <Input label="Provincia (Sigla)" placeholder="Es. MI, RM" maxLength={2} value={editForm.provincia} onValueChange={(v) => setEditForm({ ...editForm, provincia: v.toUpperCase() })} variant="flat" />
                </div>
                <Input label="Indirizzo" placeholder="Via/Piazza, Civico" value={editForm.indirizzo} onValueChange={(v) => setEditForm({ ...editForm, indirizzo: v })} variant="flat" />
              </div>

              <Divider className="my-1" />

              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Le tue Competenze</span>
                <Select
                  label="Seleziona competenze"
                  selectionMode="multiple"
                  variant="flat"
                  selectedKeys={editForm.skills}
                  onSelectionChange={(keys) => setEditForm({ ...editForm, skills: keys as Set<string> })}
                  classNames={{ popoverContent: 'max-w-[500px]' }}
                >
                  {(competenze || []).map((skill: any) => {
                    const title = skill.name?.trim() || skill.value?.trim() || ''
                    const description = (skill.value && skill.value.trim() !== skill.name?.trim()) ? skill.value.trim() : null
                    const key = skill.value || skill.name
                    return (
                      <SelectItem key={key} textValue={title}>
                        <div className="flex flex-col gap-0.5 py-1.5 whitespace-normal">
                          <span className="text-sm font-semibold text-neutral-900 leading-tight">{title}</span>
                          {description && <span className="text-xs text-neutral-500 font-normal leading-relaxed block">{description}</span>}
                        </div>
                      </SelectItem>
                    )
                  })}
                </Select>
              </div>

              <Divider className="my-1" />

              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Stato e Disponibilità</span>
                <div className="flex flex-col gap-3">
                  <Checkbox isSelected={editForm.ricerca_attiva} onValueChange={(v) => setEditForm({ ...editForm, ricerca_attiva: v })}>
                    <span className="text-sm font-medium text-neutral-700">In ricerca attiva di lavoro</span>
                  </Checkbox>
                  <Checkbox isSelected={editForm.automunito} onValueChange={(v) => setEditForm({ ...editForm, automunito: v })}>
                    <span className="text-sm text-neutral-700">Automunito / Patente B</span>
                  </Checkbox>
                  <Checkbox isSelected={editForm.trasferte} onValueChange={(v) => setEditForm({ ...editForm, trasferte: v })}>
                    <span className="text-sm text-neutral-700">Disponibile a trasferte / trasferimenti</span>
                  </Checkbox>
                </div>
              </div>

              <Divider className="my-1" />

              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Documenti</span>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Curriculum Vitae (PDF max 5MB) <span className="text-red-500">*</span></label>

                  <div className="flex items-center gap-3 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    {editForm.cv_url ? (
                      <a href={editForm.cv_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#009245] hover:underline flex items-center gap-1.5 shrink-0">
                        📄 CV Caricato
                      </a>
                    ) : (
                      <span className="text-xs text-red-500 font-medium italic">Nessun CV caricato</span>
                    )}
                    <span className="text-[11px] text-neutral-500">
                      {editForm.cv_url ? 'File salvato su Storage. Carica un nuovo PDF solo se desideri sostituirlo.' : 'File obbligatorio per accedere alle candidature.'}
                    </span>
                  </div>

                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setCvFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-[#009245]/10 file:text-[#009245] hover:file:bg-[#009245]/20 transition-colors"
                  />
                </div>

                <div className="pt-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Portfolio (PDF/ZIP max 15MB)</label>

                  <div className="flex items-center gap-3 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    {editForm.portfolio_url ? (
                      <a href={editForm.portfolio_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-neutral-800 hover:underline flex items-center gap-1.5 shrink-0">
                        🔗 Portfolio Caricato
                      </a>
                    ) : (
                      <span className="text-xs text-neutral-400 font-medium italic">Nessun portfolio caricato</span>
                    )}
                    <span className="text-[11px] text-neutral-500">
                      {editForm.portfolio_url ? 'File salvato su Storage. Carica un nuovo file solo se desideri sostituirlo.' : 'File opzionale.'}
                    </span>
                  </div>

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
  )
}