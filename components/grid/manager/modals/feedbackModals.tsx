import React from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

export const DeleteConfirmModal = ({ isOpen, onOpenChange, onClose, jobToDelete, onConfirm }: any) => (
  <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
    <ModalContent>
      {() => (
        <>
          <ModalHeader className="text-xl font-bold text-red-600">Attenzione</ModalHeader>
          <ModalBody>
            <p>Sei sicuro di voler eliminare definitivamente <strong>{jobToDelete?.title}</strong>?</p>
            <p className="text-sm text-neutral-500">Questa operazione non può essere annullata e l'inserzione verrà rimossa immediatamente.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>Annulla</Button>
            <Button color="danger" onPress={onConfirm}>Sì, elimina</Button>
          </ModalFooter>
        </>
      )}
    </ModalContent>
  </Modal>
)

export const AlertModal = ({ isOpen, onOpenChange, alertInfo }: any) => (
  <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
    <ModalContent>
      {(onClose) => (
        <>
          <ModalHeader className={`text-xl font-bold ${alertInfo.isError ? 'text-red-600' : 'text-[#009245]'}`}>
            {alertInfo.title}
          </ModalHeader>
          <ModalBody>
            <p className="text-neutral-700 dark:text-neutral-300">{alertInfo.message}</p>
          </ModalBody>
          <ModalFooter>
            <Button color={alertInfo.isError ? 'danger' : 'primary'} onPress={onClose}>
              OK
            </Button>
          </ModalFooter>
        </>
      )}
    </ModalContent>
  </Modal>
)