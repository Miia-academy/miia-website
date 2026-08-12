import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Select, SelectItem, Checkbox, Button } from '@heroui/react'
import { useDataContext } from '@modules/context'
import { OCCUPAZIONE_OPTIONS, fileToBase64 } from '../utils'

export const UpdateStudentModal = ({ isOpen, onOpenChange, onClose, userData, showAlert }: any) => {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    occupazione: new Set<string>([]),
    comune: '',
    provincia: '',
    ricerca: false,
    competenze: new Set<string>([]),
  })

  useEffect(() => {
    if (isOpen && userData) {
      setForm({
        occupazione: new Set<string>(userData.occupazione ? [userData.occupazione] : []),
        comune: userData.comune || '',
        provincia: userData.provincia || '',
        ricerca: userData.ricerca || false,
        competenze: new Set<string>(userData.competenze || []),
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
        email: userData?.email,
        cvBase64,
        cvFileName,
        cvMimeType,
        attributes: {
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

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="lg" backdrop="blur">
      <ModalContent className="p-2">
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="text-xl font-bold">Le tue preferenze</ModalHeader>
            <ModalBody className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
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

              <div className="flex flex-col gap-1 w-full pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <label className="text-sm font-semibold text-neutral-900 dark:text-white">Curriculum Vitae (PDF)</label>
                {userData?.cv && (
                  <p className="text-xs text-neutral-500 mb-1">Hai già caricato un CV. Caricane uno nuovo per sostituirlo.</p>
                )}
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => { if (e.target.files && e.target.files[0]) setCvFile(e.target.files[0]) }}
                  className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-medium file:bg-blue-50 dark:file:bg-blue-900/20 file:text-blue-700 dark:file:text-blue-400 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <Checkbox isSelected={form.ricerca} onValueChange={(val) => setForm({ ...form, ricerca: val })} size="md" color="primary">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Sono attualmente alla ricerca di nuove opportunità lavorative</span>
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button type="submit" isLoading={loading} className="bg-blue-600 text-white">Salva Dati</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}