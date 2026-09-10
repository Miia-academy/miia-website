import type { Page as PageBlok, Location as LocationBlok } from '@types'
import type { ISbStoryData } from '@storyblok/react'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import Meta from '@components/meta'
import Nav from '@components/nav'

interface PageComponentProps {
  blok: PageBlok
  locations?: Array<ISbStoryData<LocationBlok>>
}

export default function Page({ blok, locations = [] }: PageComponentProps) {
  // Guard clause e calcoli sicuri
  const body = blok.body || []
  const singleSection = body.length === 1

  // Type narrowing per risolvere in modo sicuro le relazioni in Strict Mode
  const headerStory = blok.header as ISbStoryData<any> | string | undefined
  const headerContent =
    headerStory && typeof headerStory !== 'string' ? headerStory.content : null

  const footerStory = blok.footer as ISbStoryData<any> | string | undefined
  const footerContent =
    footerStory && typeof footerStory !== 'string' ? footerStory.content : null

  return (
    <div {...storyblokEditable(blok as any)}>
      <Meta {...(blok as any)} />

      {headerContent && <Nav parent="header" blok={headerContent} />}

      <main className="min-h-cover">
        {body.map((bodyBlok: any) => (
          <StoryblokComponent
            blok={bodyBlok}
            parent="page"
            locations={locations}
            key={bodyBlok._uid}
            singleSection={singleSection}
          />
        ))}
      </main>

      {footerContent && <Nav parent="footer" blok={footerContent} />}
    </div>
  )
}