import React, { useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

export interface DeleteJobModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onClose: () => void
  jobData: any
  onSuccess: () => void
  showAlert: (title: string, message: string, isError?: boolean) => void
}

export const DeleteJobModal: React.FC<DeleteJobModalProps> = ({ isOpen, onOpenChange, onClose, jobData, onSuccess, showAlert }) => {
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/job/${jobData.id}`, { method: 'DELETE' })
      if (res.ok) {
        onSuccess()
        onClose()
        showAlert('Successo', 'Inserzione eliminata in modo permanente.')
      } else {
        const data = await res.json()
        showAlert('Errore', data.message || 'Impossibile eliminare.', true)
      }
    } catch {
      showAlert('Errore', 'Connessione al server fallita.', true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="text-xl font-bold text-red-600">Conferma Eliminazione</ModalHeader>
            <ModalBody>
              <p>Sei sicuro di voler eliminare l'inserzione <strong>{jobData?.title}</strong>?</p>
              <p className="text-sm text-neutral-500">Questa operazione rimuoverà l'annuncio e le relative candidature dal database. Non può essere annullata.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose} disabled={loading}>Annulla</Button>
              <Button color="danger" isLoading={loading} onPress={handleConfirm}>Sì, elimina</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}