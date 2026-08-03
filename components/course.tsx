import type { Course as CourseBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import type { PropsWithChildren } from 'react'
import { storyblokEditable } from '@storyblok/react'
import { Card, CardBody, CardHeader } from '@heroui/react'
import { getLongDate, getShortDate } from '@modules/formats'
import { resolveAlias } from '@modules/relations'
import Link from 'next/link'

interface CourseComponentProps {
  blok: CourseBlok
  story?: ISbStoryData<CourseBlok>
  parent?: string
}

export default function Course({ blok, story, parent }: CourseComponentProps) {
  // 1. Risoluzione safe del pattern Alias/Mirror
  const { content: course } = resolveAlias<CourseBlok>(
    blok.alias as ISbStoryData<CourseBlok> | string | undefined,
    blok,
    story?.full_slug
  )

  // 2. Early return sui campi obbligatori per il rendering
  if (!course.title || !course.days?.length || !course.hours?.length) {
    return null
  }

  const link = course.page?.cached_url || course.page?.url

  const Container = ({ children }: PropsWithChildren) =>
    parent && ['section', 'aside'].includes(parent) ? (
      <div className="col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3">
        {children}
      </div>
    ) : (
      <>{children}</>
    )

  const Wrapper = ({ children }: PropsWithChildren) =>
    link ? <Link href={link}>{children}</Link> : <>{children}</>

  return (
    <Container>
      <div {...storyblokEditable(blok as any)}>
        <Wrapper>
          <Card>
            <CardHeader className="flex-col items-start">
              <h4 className="font-bold leading-snug text-2xl">{course.title}</h4>
              <small>
                {course.hours.includes('20:00/23:00')
                  ? 'Frequenza serale'
                  : 'Frequenza al sabato'}
              </small>
            </CardHeader>

            <CardBody>
              <ul className="text-sm space-y-1">
                <li className="space-x-0.5">
                  <i className="iconoir-calendar pr-1" />
                  <span className="md:max-lg:hidden">lezioni:</span>
                  <span>{course.days.join(', ')}</span>
                </li>

                <li className="space-x-0.5">
                  <i className="iconoir-clock pr-1" />
                  <span className="md:max-lg:hidden">orari:</span>
                  <span>{course.hours.join(', ')}</span>
                </li>

                <li className="space-x-0.5">
                  <i className="iconoir-calendar-arrow-up pr-1" />
                  <span className="md:max-lg:hidden">inizio:</span>
                  <span>
                    {course.starts ? getLongDate(course.starts) : 'in programmazione'}
                  </span>
                </li>

                {course.ends && (
                  <li className="space-x-0.5">
                    <i className="iconoir-calendar-arrow-down pr-1" />
                    <span className="md:max-lg:hidden">fine:</span>
                    <span>{getShortDate(course.ends)}</span>
                  </li>
                )}

                {course.seats && (
                  <li className="space-x-0.5">
                    <i className="iconoir-group pr-1" />
                    <span className="md:max-lg:hidden">posti:</span>
                    <span>{course.seats}</span>
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>
        </Wrapper>
      </div>
    </Container>
  )
}