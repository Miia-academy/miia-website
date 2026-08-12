import { useMemo } from 'react'
import Markdown from 'markdown-to-jsx'
import { Typography } from '@components/typography'
import { tv } from 'tailwind-variants'

interface GridHeadingProps {
  title?: string
  subtitle?: string
  totalCount: number
  isDarkSection: boolean
}

export default function GridHeading({
  title,
  subtitle,
  totalCount,
  isDarkSection,
}: GridHeadingProps) {
  const parsedTitle = useMemo(() => {
    if (!title) return ''
    return title.replace(/{{total}}|{{count}}/g, totalCount.toString())
  }, [title, totalCount])

  const parsedSubtitle = useMemo(() => {
    if (!subtitle) return ''
    return subtitle.replace(/{{total}}|{{count}}/g, totalCount.toString())
  }, [subtitle, totalCount])

  const baseTypography = Typography({ theme: isDarkSection ? 'light' : 'dark' })

  const titleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h2,
    h2: baseTypography.h2,
    h3: baseTypography.h3,
  }

  const subtitleTypographyOverrides = {
    ...baseTypography,
    h1: baseTypography.h4,
    h2: baseTypography.h5,
    p: {
      component: ({ children }: any) => (
        <p className={isDarkSection ? 'text-neutral-300' : 'text-neutral-600'}>
          {children}
        </p>
      ),
    },
  }

  if (!parsedTitle && !parsedSubtitle) return null

  return (
    <div className={headerClasses()}>
      {parsedTitle && (
        <Markdown options={{ overrides: titleTypographyOverrides }}>
          {parsedTitle}
        </Markdown>
      )}
      {parsedSubtitle && (
        <Markdown options={{ overrides: subtitleTypographyOverrides }}>
          {parsedSubtitle}
        </Markdown>
      )}
    </div>
  )
}

const headerClasses = tv({
  base: 'mb-10 space-y-3 text-center md:text-left',
})