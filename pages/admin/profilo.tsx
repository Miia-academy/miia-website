import { GetServerSideProps } from 'next'
import React, { useState } from 'react'
import { useRouter } from 'next/router'
import jwt from 'jsonwebtoken'
import { getAllApplications } from '@modules/applications/db'
import { JobFormModal } from '@components/business/JobFormModal'
import { AdminApplicationsList } from '@components/admin/AdminApplicationsList'
import { AlertModal } from '@components/shared/AlertModal'
import type { AuthPayload } from '@modules/auth'
import { LogoutButton } from '@components/shared/LogoutButton'
import { Button, useDisclosure } from '@heroui/react'

interface AdminProfileProps {
  user: { email: string }
  initialApplications: any[]
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-miia-secret-change-in-env'

export default function AdminProfile({ user, initialApplications }: AdminProfileProps) {
  const router = useRouter()

  const {
    isOpen: isJobOpen,
    onOpen: onJobOpen,
    onClose: onJobClose,
    onOpenChange: onJobOpenChange,
  } = useDisclosure()

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '', isError: false })

  const showAlert = (title: string, message: string, isError = false) => {
    setAlertInfo({ isOpen: true, title, message, isError })
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
              Pannello Operativo
            </h1>
            <p className="mt-1 text-sm text-neutral-500">
              Accesso come Admin: <span className="font-mono text-neutral-800">{user.email}</span>
            </p>
          </div>
          <div>
            <LogoutButton
              redirectTo="/admin/login"
              variant="light"
              color="default"
              label="Esci"
            />
            <Button color="primary" onPress={onJobOpen} className="font-bold text-white shadow-sm">
              + Nuova Inserzione
            </Button>
          </div>
        </div>

        {/* Componente Tabella Candidature Isolato */}
        <AdminApplicationsList initialApplications={initialApplications} />

        {/* Modale Form Inserzione (Shared Component con modalità Admin) */}
        <JobFormModal
          isOpen={isJobOpen}
          onOpenChange={onJobOpenChange}
          onClose={onJobClose}
          isAdmin={true}
          onSuccess={() => {
            router.replace(router.asPath)
          }}
          showAlert={showAlert}
        />

        <AlertModal
          isOpen={alertInfo.isOpen}
          onOpenChange={(open) => setAlertInfo({ ...alertInfo, isOpen: open })}
          title={alertInfo.title}
          message={alertInfo.message}
          isError={alertInfo.isError}
        />
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const token = context.req.cookies['miia_auth_token']

  if (!token) {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload

    if (decoded.tipo_utente !== 'Admin') {
      return { redirect: { destination: '/', permanent: false } }
    }

    const applications = await getAllApplications()

    return {
      props: {
        user: { email: decoded.email },
        initialApplications: JSON.parse(JSON.stringify(applications)),
      },
    }
  } catch {
    return { redirect: { destination: '/admin/login', permanent: false } }
  }
}