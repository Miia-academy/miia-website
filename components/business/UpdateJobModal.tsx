import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Select, SelectItem, Button } from '@heroui/react'
import { useDataContext } from '@modules/context'

export interface UpdateJobModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onClose: () => void
  jobData: any
  onSuccess: () => void
  showAlert: (title: string, message: string, isError?: boolean) => void
}

export const UpdateJobModal: React.FC<UpdateJobModalProps> = ({ isOpen, onOpenChange, onClose, jobData, onSuccess, showAlert }) => {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', provincia: '', description: '', skills: new Set<string>([]) })

  useEffect(() => {
    if (isOpen && jobData) {
      const rawSkills = Array.isArray(jobData.competenze) ? jobData.competenze : (typeof jobData.competenze === 'string' ? jobData.competenze.split(',') : [])
      setForm({
        title: jobData.title || '',
        provincia: jobData.provincia || '',
        description: jobData.description || '',
        skills: new Set<string>(rawSkills.map((s: string) => s.trim()).filter(Boolean)),
      })
    }
  }, [isOpen, jobData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch(`/api/job/${jobData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          provincia: form.provincia.toUpperCase(),
          description: form.description.trim(),
          competenze: Array.from(form.skills),
        }),
      })

      if (res.ok) {
        onSuccess()
        onClose()
        showAlert('Successo', 'Inserzione aggiornata!')
      } else {
        const data = await res.json()
        showAlert('Errore', data.message || 'Errore aggiornamento.', true)
      }
    } catch {
      showAlert('Errore API', 'Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" backdrop="blur">
      <ModalContent>
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="text-xl font-bold">Modifica Inserzione</ModalHeader>
            <ModalBody className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Input label="Titolo Posizione" isRequired variant="flat" className="col-span-3" value={form.title} onValueChange={(v) => setForm({ ...form, title: v })} />
                <Input label="Provincia" isRequired maxLength={2} variant="flat" className="col-span-1" value={form.provincia} onValueChange={(v) => setForm({ ...form, provincia: v.toUpperCase() })} />
              </div>
              <Select label="Competenze" selectionMode="multiple" variant="flat" selectedKeys={form.skills} onSelectionChange={(keys) => setForm({ ...form, skills: keys as Set<string> })}>
                {(competenze || []).map((skill: any) => <SelectItem key={skill.value || skill.name}>{skill.name || skill.value}</SelectItem>)}
              </Select>
              <Textarea label="Descrizione Offerta" isRequired minRows={4} variant="flat" value={form.description} onValueChange={(v) => setForm({ ...form, description: v })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button type="submit" isLoading={loading} className="bg-[#009245] text-white">Salva</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}