// components/business/ApplicationsModal.tsx
import React, { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Chip } from '@heroui/react'

export interface ApplicationsModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onClose: () => void
  job: any
}

export const ApplicationsModal: React.FC<ApplicationsModalProps> = ({ isOpen, onOpenChange, onClose, job }) => {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && job?.id) {
      setLoading(true)
      // Path aggiornato al singolare come richiesto
      fetch(`/api/job/${job.id}/application`)
        .then((res) => res.json())
        .then((data) => setApplications(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [isOpen, job])

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" backdrop="blur" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">Candidati per: {job?.title}</h3>
              <p className="text-sm font-normal text-neutral-500">Totale candidature: {applications.length}</p>
            </ModalHeader>
            <ModalBody>
              {loading ? (
                <div className="flex justify-center p-8"><span className="animate-pulse font-medium text-neutral-500">Caricamento candidati...</span></div>
              ) : applications.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-neutral-300 rounded-xl bg-neutral-50">
                  <p className="text-neutral-500">Nessuno si è ancora candidato a questa inserzione.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {applications.map((app) => (
                    <div key={app.id} className="flex items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
                      <div>
                        <p className="font-semibold text-neutral-900">{app.student_email}</p>
                        <p className="text-xs text-neutral-500">
                          Candidato il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {app.status === 'in_revisione' && (
                          <Chip size="sm" variant="flat" color="primary">Nuovo</Chip>
                        )}
                        <Button
                          as="a"
                          href={app.cv_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          className="bg-black text-white font-medium"
                        >
                          Apri CV
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onClose}>Chiudi</Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}