import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'

export interface ApplicationsModalProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  onClose: () => void
  job: any
}

export const ApplicationsModal: React.FC<ApplicationsModalProps> = ({ isOpen, onOpenChange, onClose, job }) => {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchApplications = () => {
    if (job?.id) {
      setLoading(true)
      fetch(`/api/job/${job.id}/application`)
        .then((res) => res.json())
        .then((data) => setApplications(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchApplications()
    }
  }, [isOpen, job])

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="3xl" backdrop="blur" scrollBehavior="inside">
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <h3 className="text-xl font-bold">Candidati per: {job?.title}</h3>
              <p className="text-sm font-normal text-neutral-500">Totale candidature valide: {applications.length}</p>
            </ModalHeader>
            <ModalBody>
              {loading ? (
                <div className="flex justify-center p-8"><span className="animate-pulse font-medium text-neutral-500">Caricamento candidati...</span></div>
              ) : applications.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-neutral-300 rounded-xl bg-neutral-50">
                  <p className="text-neutral-500">Nessuna candidatura approvata per questa inserzione.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {applications.map((app) => {
                    const studentFullName = [app.nome, app.cognome].filter(Boolean).join(' ') || 'Candidato'

                    return (
                      <div key={app.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors gap-3">
                        <div>
                          <p className="font-bold text-base text-neutral-900">{studentFullName}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Candidato il: {new Date(app.applied_at).toLocaleDateString('it-IT')}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {app.viewed_at ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                ✓ Visto il {new Date(app.viewed_at).toLocaleDateString('it-IT')}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                ● Non ancora letto
                              </span>
                            )}

                            {app.cv_downloaded_at && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                📄 CV Scaricato
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            as={Link}
                            href={`/aziende/candidati/${encodeURIComponent(app.student_email)}?jobId=${job.id}&appId=${app.id}`}
                            size="sm"
                            className="bg-black text-white font-semibold px-4"
                          >
                            Vedi Dettaglio Candidato &rarr;
                          </Button>
                        </div>
                      </div>
                    )
                  })}
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