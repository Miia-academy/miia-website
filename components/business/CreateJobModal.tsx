// components/business/CreateJobModal.tsx
import React, { useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Textarea,
  Select,
  SelectItem,
  Button
} from '@heroui/react'
import { useDataContext } from '@modules/context'

export interface CreateJobModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onClose: () => void
  onSuccess: () => void
  showAlert: (title: string, message: string, isError?: boolean) => void
}

export const CreateJobModal: React.FC<CreateJobModalProps> = ({
  isOpen,
  onOpenChange,
  onClose,
  onSuccess,
  showAlert,
}) => {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    title: '',
    provincia: '',
    description: '',
    skills: new Set<string>([]),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        title: form.title.trim(),
        provincia: form.provincia.toUpperCase(),
        description: form.description.trim(),
        competenze: Array.from(form.skills),
      }

      const res = await fetch('/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess()
        onClose()
        setForm({ title: '', provincia: '', description: '', skills: new Set([]) })
        showAlert('Successo', 'Inserzione pubblicata con successo!')
      } else {
        showAlert('Errore', data.message || 'Errore durante la creazione.', true)
      }
    } catch {
      showAlert('Errore di connessione', 'Riprova più tardi.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" backdrop="blur">
      <ModalContent className="p-2">
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="text-xl font-bold">Crea Nuova Inserzione</ModalHeader>
            <ModalBody className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Titolo Posizione"
                  isRequired
                  variant="flat"
                  className="md:col-span-3"
                  value={form.title}
                  onValueChange={(val) => setForm({ ...form, title: val })}
                />
                <Input
                  label="Provincia (Sigla)"
                  placeholder="Es. MI"
                  isRequired
                  maxLength={2}
                  variant="flat"
                  className="md:col-span-1"
                  value={form.provincia}
                  onValueChange={(val) => setForm({ ...form, provincia: val.toUpperCase() })}
                />
              </div>

              <Select
                label="Competenze richieste"
                selectionMode="multiple"
                variant="flat"
                selectedKeys={form.skills}
                onSelectionChange={(keys) => setForm({ ...form, skills: keys as Set<string> })}
              >
                {(competenze || []).map((skill: any) => (
                  <SelectItem key={skill.value || skill.name}>
                    {skill.name || skill.value}
                  </SelectItem>
                ))}
              </Select>

              <Textarea
                label="Descrizione Offerta"
                isRequired
                minRows={4}
                variant="flat"
                value={form.description}
                onValueChange={(val) => setForm({ ...form, description: val })}
              />

            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>
                Annulla
              </Button>
              <Button type="submit" isLoading={loading} className="bg-[#009245] text-white">
                Pubblica
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}