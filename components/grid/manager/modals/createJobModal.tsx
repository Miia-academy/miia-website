import React, { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Select, SelectItem, Button } from '@heroui/react'
import { useDataContext } from '@modules/context'

export const CreateJobModal = ({ isOpen, onOpenChange, onClose, userData, onJobCreated, showAlert }: any) => {
  const { competenze } = useDataContext()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', location: '', skills: new Set<string>([]), description: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/job/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: userData?.storyblok_uuid || userData?.storyblok_id || '',
          companyName: userData?.company || '',
          title: form.title,
          location: form.location,
          skills: Array.from(form.skills),
          description: form.description,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        if (onJobCreated) onJobCreated(data.story)
        onClose()
        setForm({ title: '', location: '', skills: new Set([]), description: '' })
        showAlert('Successo', 'Inserzione creata con successo!')
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
              <Input label="Titolo Posizione" isRequired variant="flat" value={form.title} onValueChange={(val) => setForm({ ...form, title: val })} />
              <Input label="Sede / Luogo di lavoro" variant="flat" value={form.location} onValueChange={(val) => setForm({ ...form, location: val })} />
              <Select label="Skills richieste" selectionMode="multiple" variant="flat" selectedKeys={form.skills} onSelectionChange={(keys) => setForm({ ...form, skills: keys as Set<string> })}>
                {competenze.map((skill) => <SelectItem key={skill.value}>{skill.name}</SelectItem>)}
              </Select>
              <Textarea label="Descrizione Offerta" minRows={4} variant="flat" value={form.description} onValueChange={(val) => setForm({ ...form, description: val })} />
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button type="submit" isLoading={loading} className="bg-[#009245] text-white">Pubblica</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}