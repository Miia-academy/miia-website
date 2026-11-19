import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalUrl, plainText } from '@components/meta'
import { buildSitemap, storyUrl } from '@modules/sitemap'

describe('canonical address', () => {
  it.each([
    ['/', 'https://miia.it/'],
    ['/index', 'https://miia.it/'],
    ['/home', 'https://miia.it/'],
    ['/corsi/interior-design/', 'https://miia.it/corsi/interior-design'],
    ['/blog/articolo?utm_source=meta#inizio', 'https://miia.it/blog/articolo'],
  ])('%s → %s', (path, url) => {
    expect(canonicalUrl(path)).toBe(url)
  })
})

describe('text for title and description', () => {
  it('drops Markdown marks, links and line breaks', () => {
    expect(plainText('# Progettare **una cucina**\n\n[leggi](/blog) _ora_')).toBe('Progettare una cucina leggi ora')
  })

  it('nothing for missing values', () => {
    expect(plainText(undefined)).toBe('')
  })
})

describe('sitemap', () => {
  const xml = buildSitemap([
    { full_slug: 'home', published_at: '2026-10-01T10:00:00.000Z', content: { component: 'page' } },
    { full_slug: 'splash', content: { component: 'page' } },
    { full_slug: 'corsi/interior-design/', content: { component: 'page' } },
    { full_slug: 'blog/interior-design/cucina', content: { component: 'article' } },
    { full_slug: 'progetti/interior-design/casa', content: { component: 'project' } },
    { full_slug: 'area-riservata', content: { component: 'page', auth: true } },
    { full_slug: 'config/header', content: { component: 'nav' } },
  ])

  it('lists published pages, articles and projects', () => {
    expect(xml).toContain('<url><loc>https://miia.it/</loc><lastmod>2026-10-01</lastmod></url>')
    expect(xml).toContain('<loc>https://miia.it/corsi/interior-design</loc>')
    expect(xml).toContain('<loc>https://miia.it/blog/interior-design/cucina</loc>')
    expect(xml).toContain('<loc>https://miia.it/progetti/interior-design/casa</loc>')
  })

  it('leaves out splash, pages behind login and non-page stories', () => {
    expect(xml).not.toContain('splash')
    expect(xml).not.toContain('area-riservata')
    expect(xml).not.toContain('config/header')
  })

  it('story addresses', () => {
    expect(storyUrl('/blog/a/')).toBe('https://miia.it/blog/a')
  })
})

describe('robots.txt', () => {
  const robots = readFileSync('public/robots.txt', 'utf8')

  it('points to the sitemap on miia.it and keeps private areas out', () => {
    expect(robots).toContain('Sitemap: https://miia.it/sitemap.xml')
    expect(robots).toContain('Disallow: /api/')
    expect(robots).toContain('Disallow: /admin')
  })
})
