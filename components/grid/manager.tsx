// components/grid/manager.tsx
import React, { useState } from 'react'
import { useDisclosure } from '@heroui/react'

import { ActionBar, StudentActionBar } from './manager/actionBars'
import { JobGrid } from './manager/jobGrid'
import { CreateJobModal } from "./manager/modals/createJobModal"
import { UpdateJobModal } from './manager/modals/updateJobModal'
import { UpdateBusinessModal } from './manager/modals/updateBusinessModal'
import { UpdateStudentModal } from './manager/modals/updateStudentModal'
import { DeleteConfirmModal, AlertModal } from './manager/modals/feedbackModals'

export interface GridManagerProps {
  jobs: any[]
  isDarkSection: boolean
  userData: {
    email?: string
    company?: string
    contact_person?: string
    storyblok_id?: string
    storyblok_uuid?: string
    address?: string
    website?: string
    description?: string
    area?: string
    sms?: string
    newsletter?: boolean
    occupazione?: string
    comune?: string
    provincia?: string
    ricerca?: boolean
    competenze?: string[]
    cv?: string
  } | null
  onDeleteJob: (storyId: string) => void
  onJobCreated?: (newJob: any) => void
  onJobUpdated?: () => void
}

export default function GridManager({
  jobs,
  isDarkSection,
  userData,
  onDeleteJob,
  onJobCreated,
  onJobUpdated,
}: GridManagerProps) {
  // Disclosures HeroUI
  const { isOpen: isJobOpen, onOpen: onJobOpen, onOpenChange: onJobOpenChange, onClose: onJobClose } = useDisclosure()
  const { isOpen: isEditOpen, onOpen: onEditOpen, onOpenChange: onEditOpenChange, onClose: onEditClose } = useDisclosure()
  const { isOpen: isProfileOpen, onOpen: onProfileOpen, onOpenChange: onProfileOpenChange, onClose: onProfileClose } = useDisclosure()
  const { isOpen: isStudentOpen, onOpen: onStudentOpen, onOpenChange: onStudentOpenChange, onClose: onStudentClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onOpenChange: onDeleteOpenChange, onClose: onDeleteClose } = useDisclosure()
  const { isOpen: isAlertModalOpen, onOpen: onAlertModalOpen, onOpenChange: onAlertModalOpenChange } = useDisclosure()

  // Stati locali per azioni
  const [jobToDelete, setJobToDelete] = useState<{ id: string; title: string } | null>(null)
  const [jobToEdit, setJobToEdit] = useState<any | null>(null)
  const [alertInfo, setAlertInfo] = useState<{ title: string; message: string; isError?: boolean }>({ title: '', message: '' })

  const isCompany = !!(userData?.company || userData?.storyblok_id)

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ title, message, isError })
    onAlertModalOpen()
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('[Logout Error]', error)
    } finally {
      window.location.reload()
    }
  }

  const handleDeleteRequest = (id: string, title: string) => {
    setJobToDelete({ id, title })
    onDeleteOpen()
  }

  const handleEditRequest = (job: any) => {
    setJobToEdit(job)
    onEditOpen()
  }

  const executeDelete = () => {
    if (jobToDelete) {
      onDeleteJob(jobToDelete.id)
      onDeleteClose()
      setJobToDelete(null)
    }
  }

  return (
    <div className="space-y-6">
      {isCompany ? (
        <ActionBar
          userData={userData}
          onOpenProfile={onProfileOpen}
          onOpenJob={onJobOpen}
          onLogout={handleLogout}
        />
      ) : (
        <StudentActionBar
          onOpenProfile={onStudentOpen}
          onLogout={handleLogout}
        />
      )}

      <JobGrid
        jobs={jobs}
        isDarkSection={isDarkSection}
        userData={userData}
        onRequestDelete={handleDeleteRequest}
        onRequestEdit={handleEditRequest}
      />

      {/* --- MODALI SEPARATE --- */}
      <CreateJobModal
        isOpen={isJobOpen}
        onOpenChange={onJobOpenChange}
        onClose={onJobClose}
        userData={userData}
        onJobCreated={onJobCreated}
        showAlert={showAlert}
      />

      <UpdateJobModal
        isOpen={isEditOpen}
        onOpenChange={onEditOpenChange}
        onClose={onEditClose}
        jobData={jobToEdit}
        onJobUpdated={onJobUpdated || (() => window.location.reload())}
        showAlert={showAlert}
      />

      <UpdateBusinessModal
        isOpen={isProfileOpen}
        onOpenChange={onProfileOpenChange}
        onClose={onProfileClose}
        userData={userData}
        showAlert={showAlert}
      />

      <UpdateStudentModal
        isOpen={isStudentOpen}
        onOpenChange={onStudentOpenChange}
        onClose={onStudentClose}
        userData={userData}
        showAlert={showAlert}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        onClose={onDeleteClose}
        jobToDelete={jobToDelete}
        onConfirm={executeDelete}
      />

      <AlertModal
        isOpen={isAlertModalOpen}
        onOpenChange={onAlertModalOpenChange}
        alertInfo={alertInfo}
      />
    </div>
  )
}