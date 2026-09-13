import React from 'react'
import { Button, Chip } from '@heroui/react'

export interface JobsTableProps {
  jobs: any[]
  onEdit: (job: any) => void
  onDelete: (job: any) => void
  onToggleStatus: (jobId: string, currentStatus: string) => void
  actionLoading: string | null
}

export const JobsTable: React.FC<JobsTableProps> = ({ jobs, onEdit, onDelete, onToggleStatus, actionLoading }) => {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-neutral-500">Nessuna inserzione pubblicata. Creane una nuova per iniziare.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm text-neutral-600">
        <thead className="border-b border-neutral-100 bg-neutral-50 text-xs font-semibold uppercase text-neutral-500">
          <tr>
            <th className="px-6 py-4">Titolo</th>
            <th className="px-6 py-4">Sede</th>
            <th className="px-6 py-4">Competenze</th>
            <th className="px-6 py-4">Stato</th>
            <th className="px-6 py-4 text-right">Azioni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {jobs.map((job) => (
            <tr key={job.id} className="hover:bg-neutral-50/50 transition-colors">
              <td className="px-6 py-4 font-medium text-neutral-900">{job.title}</td>
              <td className="px-6 py-4 font-semibold uppercase">{job.provincia}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {(job.competenze || []).slice(0, 3).map((c: string) => (
                    <Chip key={c} size="sm" variant="flat" className="text-[10px]">
                      {c}
                    </Chip>
                  ))}
                  {(job.competenze?.length || 0) > 3 && (
                    <span className="text-[10px] text-neutral-400">+{job.competenze.length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <Chip
                  size="sm"
                  color={job.status === 'attiva' ? 'success' : 'default'}
                  variant="flat"
                >
                  {job.status === 'attiva' ? 'Attiva' : 'Chiusa'}
                </Chip>
              </td>
              <td className="px-6 py-4 text-right space-x-2">
                <Button
                  size="sm"
                  variant="light"
                  isLoading={actionLoading === job.id}
                  onPress={() => onToggleStatus(job.id, job.status)}
                  className="text-xs font-semibold"
                >
                  {job.status === 'attiva' ? 'Disattiva' : 'Attiva'}
                </Button>
                <Button size="sm" variant="light" color="primary" onPress={() => onEdit(job)} className="text-xs font-semibold">
                  Modifica
                </Button>
                <Button size="sm" variant="light" color="danger" onPress={() => onDelete(job)} className="text-xs font-semibold">
                  Elimina
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}