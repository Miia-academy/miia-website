import React, { useState, useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input, Divider, Textarea } from '@heroui/react'

export interface BusinessProfileData {
  azienda: string
  referente: string
  sms: string
  indirizzo: string
  sito_web: string
  descrizione: string
  logo_url: string
}

interface BusinessProfileModalProps {
  isOpen: boolean
  onClose: () => void
  initialData: BusinessProfileData
  onSuccess: (updatedData: BusinessProfileData) => void
  showAlert: (title: string, msg: string, isError?: boolean) => void
}

export function BusinessProfileModal({ isOpen, onClose, initialData, onSuccess, showAlert }: BusinessProfileModalProps) {
  const [editForm, setEditForm] = useState<BusinessProfileData>(initialData)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEditForm(initialData)
      setLogoFile(null)
    }
  }, [isOpen, initialData])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let logoBase64 = '', logoFileName = '', logoMimeType = ''
      if (logoFile) {
        if (logoFile.size > 3 * 1024 * 1024) {
          showAlert('Errore', 'Il logo non può superare i 3MB.', true)
          setLoading(false)
          return
        }

        logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.readAsDataURL(logoFile)
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = (error) => reject(error)
        })
        logoFileName = logoFile.name
        logoMimeType = logoFile.type
      }

      const payload = {
        azienda: editForm.azienda,
        referente: editForm.referente,
        sms: editForm.sms,
        indirizzo: editForm.indirizzo,
        sito_web: editForm.sito_web,
        descrizione: editForm.descrizione,
        logoBase64,
        logoFileName,
        logoMimeType,
      }

      const res = await fetch('/api/user/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (res.ok) {
        onSuccess({
          ...editForm,
          logo_url: data.user?.logo_url || editForm.logo_url
        })
        showAlert('Successo', 'Dati aziendali salvati con successo!')
        onClose()
      } else {
        showAlert('Errore', data.message || 'Errore durante l\'aggiornamento.', true)
      }
    } catch {
      showAlert('Errore', 'Connessione fallita. Riprova.', true)
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
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Identità Aziendale</span>
                <Input label="Nome Azienda" isRequired value={editForm.azienda} onValueChange={(v) => setEditForm({ ...editForm, azienda: v })} variant="flat" />

                <div className="pt-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">Logo (PNG/JPG max 3MB)</label>

                  {/* Anteprima visiva del logo esistente */}
                  <div className="flex items-center gap-3 mb-3 bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                    {editForm.logo_url ? (
                      <img
                        src={editForm.logo_url}
                        alt="Logo Attuale"
                        className="w-12 h-12 rounded-lg object-contain border border-neutral-200 bg-white p-1 shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-neutral-200/60 flex items-center justify-center font-bold text-neutral-400 text-xs shrink-0 border border-neutral-300 border-dashed">
                        No Logo
                      </div>
                    )}
                    <span className="text-xs text-neutral-500 font-medium">
                      {editForm.logo_url ? 'Seleziona un nuovo file solo se desideri sostituirlo.' : 'Nessun logo attualmente impostato.'}
                    </span>
                  </div>

                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-800 hover:file:bg-neutral-200 transition-colors"
                  />
                </div>
              </div>

              <Divider className="my-1" />

              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Contatti & Sede</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Referente / Contatto" isRequired value={editForm.referente} onValueChange={(v) => setEditForm({ ...editForm, referente: v })} variant="flat" />
                  <Input type="tel" label="Telefono (es. +39...)" value={editForm.sms} onValueChange={(v) => setEditForm({ ...editForm, sms: v })} variant="flat" />
                </div>
                <Input label="Indirizzo Sede" placeholder="Via/Piazza, Città, CAP" value={editForm.indirizzo} onValueChange={(v) => setEditForm({ ...editForm, indirizzo: v })} variant="flat" />
              </div>

              <Divider className="my-1" />

              <div className="space-y-4">
                <span className="text-[11px] font-bold uppercase text-neutral-400 tracking-wider">Presentazione</span>
                <Input type="url" label="Sito Web" placeholder="https://..." value={editForm.sito_web} onValueChange={(v) => setEditForm({ ...editForm, sito_web: v })} variant="flat" />
                <Textarea label="Chi Siamo" placeholder="Descrivi brevemente l'azienda per i candidati..." value={editForm.descrizione} onValueChange={(v) => setEditForm({ ...editForm, descrizione: v })} variant="flat" minRows={4} />
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-neutral-100 px-6 py-4">
              <Button variant="flat" onPress={onClose} disabled={loading} className="w-full sm:w-auto">
                Annulla
              </Button>
              <Button type="submit" isLoading={loading} className="w-full sm:w-auto bg-black text-white font-bold shadow-sm">
                Salva Modifiche
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  )
}