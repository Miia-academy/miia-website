import type { GetServerSideProps } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import { buildSitemap, SITEMAP_COMPONENTS, type SitemapStory } from '@modules/sitemap'

// The XML is written in getServerSideProps; the component never renders
export default function Sitemap() {
  return null
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  try {
    const stories = (await getStoryblokApi().getAll('cdn/stories', {
      version: 'published',
      filter_query: { component: { in: SITEMAP_COMPONENTS.join(',') } },
      excluding_fields: 'body,header,footer',
    })) as SitemapStory[]

    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')
    res.write(buildSitemap(stories))
    res.end()
  } catch (error) {
    console.error('[Sitemap] Lettura delle pagine da Storyblok non riuscita:', error)
    res.statusCode = 503
    res.end()
  }
  return { props: {} }
}
