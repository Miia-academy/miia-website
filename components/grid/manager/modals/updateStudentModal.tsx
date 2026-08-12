// components/grid/manager/modals/updateStudentModal.tsx
import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Select, SelectItem, Checkbox, Button, Link } from '@heroui/react'
import { useDataContext } from '@modules/context'
import { OCCUPAZIONE_OPTIONS, fileToBase64 } from '../utils'

export const UpdateStudentModal = ({ isOpen, onOpenChange, onClose, userData, showAlert }: any) => {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    email: '',
    sms: '',
    occupazione: new Set<string>([]),
    comune: '',
    provincia: '',
    ricerca: false,
    competenze: new Set<string>([]),
  })

  useEffect(() => {
    if (isOpen && userData) {
      const rawCompetenze = Array.isArray(userData.competenze)
        ? userData.competenze
        : (typeof userData.competenze === 'string' ? userData.competenze.split(', ') : [])

      setForm({
        nome: userData.name || userData.nome || '',
        cognome: userData.surname || userData.cognome || '',
        email: userData.email || '',
        sms: userData.sms || '',
        occupazione: new Set<string>(userData.occupazione ? [userData.occupazione] : []),
        comune: userData.comune || '',
        provincia: userData.provincia || '',
        ricerca: Boolean(userData.ricerca),
        competenze: new Set<string>(rawCompetenze),
      })
      setCvFile(null)
    }
  }, [isOpen, userData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let cvBase64 = '', cvFileName = '', cvMimeType = ''

      if (cvFile) {
        cvBase64 = await fileToBase64(cvFile)
        cvFileName = cvFile.name
        cvMimeType = cvFile.type
      }

      const payload = {
        email: form.email || userData?.email,
        cvBase64,
        cvFileName,
        cvMimeType,
        attributes: {
          NOME: form.nome,
          COGNOME: form.cognome,
          SMS: form.sms,
          OCCUPAZIONE: Array.from(form.occupazione)[0] || '',
          COMUNE: form.comune,
          PROVINCIA: form.provincia,
          RICERCA: form.ricerca,
          COMPETENZE: Array.from(form.competenze).join(', '),
        }
      }

      const res = await fetch('/api/user/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onClose()
        showAlert('Successo', 'Profilo e preferenze salvati con successo!')
        // Opzionale: ricarica per sincronizzare lo stato globale
        window.location.reload()
      } else {
        const errorData = await res.json()
        showAlert('Errore', errorData.message || 'Errore durante l\'aggiornamento.', true)
      }
    } catch {
      showAlert('Errore di connessione', 'Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  const existingCvUrl = userData?.cv_url || userData?.cv

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" backdrop="blur">
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="text-xl font-bold">Le tue preferenze e profilo</ModalHeader>
            <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto">

              {/* Dati Anagrafici pre-compilati */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nome"
                  variant="flat"
                  value={form.nome}
                  onValueChange={(val) => setForm({ ...form, nome: val })}
                />
                <Input
                  label="Cognome"
                  variant="flat"
                  value={form.cognome}
                  onValueChange={(val) => setForm({ ...form, cognome: val })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  type="email"
                  label="Email"
                  isReadOnly
                  variant="flat"
                  value={form.email}
                  className="opacity-70"
                />
                <Input
                  type="tel"
                  label="Telefono / SMS"
                  placeholder="Es. +39 333 1234567"
                  variant="flat"
                  value={form.sms}
                  onValueChange={(val) => setForm({ ...form, sms: val })}
                />
              </div>

              <Select label="Attuale Occupazione" variant="flat" selectedKeys={form.occupazione} onSelectionChange={(keys) => setForm({ ...form, occupazione: keys as Set<string> })}>
                {OCCUPAZIONE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Comune" placeholder="Es. Milano" variant="flat" value={form.comune} onValueChange={(val) => setForm({ ...form, comune: val })} />
                <Input label="Provincia (Sigla)" placeholder="Es. MI" maxLength={2} variant="flat" value={form.provincia} onValueChange={(val) => setForm({ ...form, provincia: val.toUpperCase() })} />
              </div>

              <Select label="Le tue Competenze" selectionMode="multiple" variant="flat" selectedKeys={form.competenze} onSelectionChange={(keys) => setForm({ ...form, competenze: keys as Set<string> })}>
                {competenze.map((comp) => (
                  <SelectItem key={comp.value}>{comp.name}</SelectItem>
                ))}
              </Select>

              {/* UPLOAD CV + VISUALIZZA CV ATTUALE */}
              <div className="flex flex-col gap-2 w-full pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <label className="text-sm font-semibold text-neutral-900 dark:text-white">Curriculum Vitae (PDF)</label>

                {existingCvUrl && !cvFile && (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                      📄 CV attualmente salvato
                    </span>
                    <Link
                      href={existingCvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="sm"
                      className="text-xs font-semibold text-[#009245]"
                    >
                      Visualizza PDF &rarr;
                    </Link>
                  </div>
                )}

                {cvFile ? (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate max-w-[220px]">
                      📄 Nuovo file: {cvFile.name}
                    </span>
                    <Button
                      size="sm"
                      color="danger"
                      variant="light"
                      onPress={() => setCvFile(null)}
                      className="text-xs h-7 px-2 font-semibold"
                    >
                      Annulla caricamento
                    </Button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => { if (e.target.files && e.target.files[0]) setCvFile(e.target.files[0]) }}
                    className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-medium file:bg-[#009245]/10 file:text-[#009245] hover:file:bg-[#009245]/20 cursor-pointer"
                  />
                )}
              </div>

              {/* CHECKBOX RICERCA */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 max-w-full overflow-hidden">
                <Checkbox
                  isSelected={form.ricerca}
                  onValueChange={(val) => setForm({ ...form, ricerca: val })}
                  size="md"
                  color="primary"
                  classNames={{
                    base: "max-w-full w-full flex items-start gap-2",
                    label: "whitespace-normal break-words text-xs sm:text-sm font-medium text-neutral-700 dark:text-neutral-300 leading-snug"
                  }}
                >
                  Sono attualmente alla ricerca di nuove opportunità lavorative
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button type="submit" isLoading={loading} className="bg-[#009245] text-white font-medium">Salva Dati</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}