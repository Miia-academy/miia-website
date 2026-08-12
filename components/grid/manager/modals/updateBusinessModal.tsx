import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Select, SelectItem, Checkbox, Button } from '@heroui/react'
import { fileToBase64 } from '../utils'

export const UpdateBusinessModal = ({ isOpen, onOpenChange, onClose, userData, showAlert }: any) => {
  const [loading, setLoading] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  const [form, setForm] = useState({
    nome: '',
    contact_person: '',
    email: '',
    sms: '',
    address: '',
    website: '',
    description: '',
    area: new Set<string>([]),
    newsletter: false,
  })

  useEffect(() => {
    if (isOpen && userData) {
      setForm({
        nome: userData.company || '',
        contact_person: userData.contact_person || '',
        email: userData.email || '',
        sms: userData.sms || '',
        address: userData.address || '',
        website: userData.website || '',
        description: userData.description || '',
        area: new Set<string>(userData.area ? [userData.area] : []),
        newsletter: userData.newsletter || false,
      })
      setLogoFile(null)
    }
  }, [isOpen, userData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      let logoBase64 = '', logoFileName = '', logoMimeType = ''

      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile)
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const areaValue = Array.from(form.area)[0] || ''

      const res = await fetch('/api/user/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          area: areaValue,
          logoBase64,
          logoFileName,
          logoMimeType,
        }),
      })

      if (res.ok) {
        onClose()
        showAlert('Successo', 'Dati aziendali aggiornati con successo!')
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" backdrop="blur">
      <ModalContent className="p-2">
        {() => (
          <form onSubmit={handleSubmit}>
            <ModalHeader className="text-xl font-bold">Aggiorna Profilo Aziendale</ModalHeader>
            <ModalBody className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Nome Azienda" isRequired variant="flat" value={form.nome} onValueChange={(val) => setForm({ ...form, nome: val })} />
                <Input label="Nome Referente" isRequired variant="flat" value={form.contact_person} onValueChange={(val) => setForm({ ...form, contact_person: val })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input type="email" label="Email Aziendale" isRequired variant="flat" value={form.email} onValueChange={(val) => setForm({ ...form, email: val })} />
                <Input type="tel" label="Telefono" variant="flat" value={form.sms} onValueChange={(val) => setForm({ ...form, sms: val })} />
              </div>

              <Input label="Indirizzo Sede Operativa" variant="flat" value={form.address} onValueChange={(val) => setForm({ ...form, address: val })} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Sito Web (es. www.azienda.it)" variant="flat" value={form.website} onValueChange={(val) => setForm({ ...form, website: val })} />
                <Select label="Settore / Area" variant="flat" selectedKeys={form.area} onSelectionChange={(keys) => setForm({ ...form, area: keys as Set<string> })}>
                  <SelectItem key="interior">Interior Design</SelectItem>
                  <SelectItem key="fashion">Fashion Design</SelectItem>
                </Select>
              </div>

              <Textarea label="Breve Descrizione / Chi siamo" minRows={3} variant="flat" value={form.description} onValueChange={(val) => setForm({ ...form, description: val })} />

              <div className="flex flex-col gap-1 w-full pt-2">
                <label className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sostituisci Logo Aziendale (Opzionale)</label>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  onChange={(e) => { if (e.target.files && e.target.files[0]) setLogoFile(e.target.files[0]) }}
                  className="text-xs text-neutral-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-medium file:bg-neutral-100 dark:file:bg-neutral-800 file:text-neutral-700 dark:file:text-neutral-300 hover:file:bg-neutral-200 cursor-pointer"
                />
              </div>

              <div className="pt-2">
                <Checkbox isSelected={form.newsletter} onValueChange={(val) => setForm({ ...form, newsletter: val })} size="sm" color="primary">
                  <span className="text-xs text-neutral-600 dark:text-neutral-400">Iscritto alla newsletter per ricevere aggiornamenti.</span>
                </Checkbox>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button type="submit" isLoading={loading} className="bg-[#009245] text-white">Salva Modifiche</Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}