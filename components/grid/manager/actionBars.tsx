import React from 'react'
import { Button } from '@heroui/react'

interface ActionBarProps {
  userData: { company?: string; email?: string } | null
  onOpenProfile: () => void
  onOpenJob: () => void
  onLogout: () => void
}

export const ActionBar = ({ userData, onOpenProfile, onOpenJob, onLogout }: ActionBarProps) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60">
    <div>
      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Pannello Gestione Offerte</h3>
      <p className="text-xs text-neutral-500">
        Azienda: <span className="font-semibold">{userData?.company || userData?.email}</span>
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
      <Button onPress={onOpenProfile} className='font-medium' variant="bordered" color="primary">
        Aggiorna Profilo
      </Button>
      <Button onPress={onOpenJob} className='font-medium' color="primary">
        Nuova Inserzione
      </Button>
      <Button onPress={onLogout} className='font-medium' variant="light">
        Esci
      </Button>
    </div>
  </div>
)

export const StudentActionBar = ({
  onOpenProfile,
  onLogout,
}: {
  onOpenProfile: () => void
  onLogout: () => void
}) => (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/60">
    <div>
      <h3 className="text-sm font-bold text-neutral-900 dark:text-white">Pannello Studente</h3>
      <p className="text-xs text-neutral-500">Gestisci le tue preferenze per ricevere le notifiche più adatte a te.</p>
    </div>
    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
      <Button onPress={onOpenProfile} className='font-medium' color='primary' variant='bordered' radius='lg'>
        Aggiorna Profilo
      </Button>
      <Button onPress={onLogout} className='font-medium' variant="light" radius='lg'>
        Esci
      </Button>
    </div>
  </div>
)