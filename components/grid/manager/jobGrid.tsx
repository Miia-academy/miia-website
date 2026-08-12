import React from 'react'
import JobCard from '@components/cards/jobCard'

interface JobGridProps {
  jobs: any[]
  isDarkSection: boolean
  userData: any
  onRequestDelete: (id: string, title: string) => void
  onRequestEdit: (job: any) => void
}

export const JobGrid = ({ jobs, isDarkSection, userData, onRequestDelete, onRequestEdit }: JobGridProps) => {
  const isCompany = !!(userData?.company || userData?.storyblok_id)

  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <p className="text-neutral-500">
          {isCompany ? 'Non hai ancora pubblicato nessuna inserzione.' : 'Nessuna offerta di lavoro trovata.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {jobs.map((job) => {
        const exactOwnership =
          job.company === userData?.storyblok_id ||
          job.content?.company === userData?.storyblok_id ||
          job.company === userData?.storyblok_uuid ||
          job.content?.company === userData?.storyblok_uuid ||
          job.content?.business === userData?.storyblok_uuid

        return (
          <JobCard
            key={job.uuid || job.fullSlug || job._uid}
            job={job}
            isDark={isDarkSection}
            isOwner={exactOwnership}
            onDelete={() => onRequestDelete(job.uuid || job.id, job.content?.title || 'questa inserzione')}
            onEdit={() => onRequestEdit(job)}
          />
        )
      })}
    </div>
  )
}