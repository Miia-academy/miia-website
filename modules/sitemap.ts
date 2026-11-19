import { SITE_URL } from '@config/site'

// Story types that are pages of the site, and slugs that are not pages on their own
export const SITEMAP_COMPONENTS = ['page', 'article', 'project']
const HOME_SLUGS = ['home']
const EXCLUDED_SLUGS = ['splash']

export interface SitemapStory {
  full_slug: string
  published_at?: string | null
  content?: { component?: string; auth?: boolean }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Address of a story on the site, without trailing slash; the home is "/". */
export function storyUrl(fullSlug: string): string {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '')
  return HOME_SLUGS.includes(slug) || slug === '' ? `${SITE_URL}/` : `${SITE_URL}/${slug}`
}

/** sitemap.xml of the published pages, articles and projects; pages behind login are left out. */
export function buildSitemap(stories: SitemapStory[]): string {
  const seen = new Set<string>()
  const entries: string[] = []

  for (const story of stories) {
    const slug = story.full_slug.replace(/^\/+|\/+$/g, '')
    if (EXCLUDED_SLUGS.includes(slug)) continue
    if (!SITEMAP_COMPONENTS.includes(story.content?.component || '')) continue
    if (story.content?.auth) continue

    const loc = storyUrl(slug)
    if (seen.has(loc)) continue
    seen.add(loc)

    const lastmod = story.published_at ? `<lastmod>${story.published_at.slice(0, 10)}</lastmod>` : ''
    entries.push(`<url><loc>${escapeXml(loc)}</loc>${lastmod}</url>`)
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n')
}
