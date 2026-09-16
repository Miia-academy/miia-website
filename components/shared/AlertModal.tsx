import React from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

export interface AlertModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  isError?: boolean
}

export function AlertModal({ isOpen, onOpenChange, title, message, isError = false }: AlertModalProps) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} backdrop="blur">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className={`text-xl font-bold ${isError ? 'text-red-600' : 'text-[#009245]'}`}>
              {title}
            </ModalHeader>
            <ModalBody>
              <p className="text-neutral-700">{message}</p>
            </ModalBody>
            <ModalFooter>
              <Button color={isError ? 'danger' : 'primary'} onPress={onClose}>
                OK
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}