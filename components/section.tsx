import type { Section as SectionBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'

// Tipizzazioni strette per Tailwind Variants
type AlignVariant = 'start' | 'center' | 'end' | 'stretch' | undefined

interface SectionComponentProps {
  blok: SectionBlok
  parent?: 'page' | 'carousel'
  singleSection?: boolean
}

export default function Section({
  blok,
  parent,
  singleSection,
}: SectionComponentProps) {
  const Tag = parent !== 'carousel' ? 'section' : 'div'

  // Fallback di protezione per evitare crash a runtime
  const rawContents = blok.contents || []

  const background = rawContents.find(
    (content: any) => content.component === 'background'
  )
  const contents = rawContents.filter(
    (content: any) => content.component !== 'background'
  )

  // Type narrowing per prevenire errori sul metodo replaceAll
  const sectionId =
    typeof blok.id === 'string' ? blok.id.replaceAll(' ', '-') : undefined

  return (
    <Tag
      id={sectionId}
      className={tagClasses({
        themeDark: blok.dark,
        isSlide: parent === 'carousel',
        hasBackground: !!background,
        singleSection: singleSection,
      })}
      {...storyblokEditable(blok as any)}
    >
      <div
        className={containerClasses({
          hasBackground: !!background,
          align: (blok.align?.[0] as AlignVariant) || undefined,
          smAlign: (blok.align?.[1] as AlignVariant) || undefined,
        })}
      >
        {contents.map((content: any) => (
          <StoryblokComponent
            key={content._uid}
            blok={content}
            theme={blok.dark ? 'dark' : 'light'}
            parent={blok.component}
          />
        ))}
      </div>
      {!!background && (
        <>
          <div className={gradientClasses({ themeDark: blok.dark })} />
          <StoryblokComponent blok={background} />
        </>
      )}
    </Tag>
  )
}

const gradientClasses = tv({
  base: 'absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r md:to-60% -z-10',
  variants: {
    themeDark: {
      true: 'from-dark mix-blend-multiply',
      false: 'from-light mix-blend-screen',
    },
  },
})

const containerClasses = tv({
  base: 'p-6 sm:py-8 md:py-10 lg:py-12 max-w-[1280px] min-h-inherit mx-auto grid grid-cols-12 gap-x-2 sm:gap-x-4 md:gap-x-6 gap-y-6 sm:gap-y-8 md:gap-y-10 items-baseline',
  variants: {
    hasBackground: {
      true: 'max-md:pb-24',
    },
    align: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    },
    smAlign: {
      start: 'sm:items-start',
      center: 'sm:items-center',
      end: 'sm:items-end',
      stretch: 'sm:items-stretch',
    },
  },
})

const tagClasses = tv({
  base: 'overflow-hidden',
  variants: {
    themeDark: {
      true: 'dark text-foreground bg-background',
      false: 'light',
    },
    isSlide: {
      true: 'px-8',
    },
    hasBackground: {
      true: 'relative z-0 py-0 min-h-cover [&_article]:backdrop-blur-sm [&_article]:rounded-3xl',
    },
    singleSection: {
      true: 'min-h-cover',
    },
  },
  compoundVariants: [
    {
      singleSection: true,
      hasBackground: true,
      class: 'sm:min-h-cover',
    },
    {
      singleSection: false,
      hasBackground: true,
      class: 'sm:min-h-3/4',
    },
    {
      hasBackground: true,
      themeDark: true,
      class:
        '[&_h1]:drop-shadow-dark [&_h2]:drop-shadow-dark [&_h3]:drop-shadow-dark [&_h4]:drop-shadow-dark [&_h5]:drop-shadow-dark [&_h6]:drop-shadow-dark [&_p]:drop-shadow-dark',
    },
    {
      hasBackground: true,
      themeDark: false,
      class:
        '[&_h1]:drop-shadow-light [&_h2]:drop-shadow-light [&_h3]:drop-shadow-light [&_h4]:drop-shadow-light [&_h5]:drop-shadow-light [&_h6]:drop-shadow-light [&_p]:drop-shadow-light',
    },
  ],
})