import { it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import List from '@components/list'

const items = [{ _uid: 'i1', title: 'Domanda', description: 'Risposta' }]

it('fisarmonica nel Wrapper: larghezza calcolata, non col-span', () => {
  const html = renderToStaticMarkup(h(List as any, { blok: { component: 'list', _uid: 'l', items, size: '1/2' }, parent: 'wrapper' }))
  expect(html).toContain('sm:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]')
  expect(html).not.toContain('sm:col-span-6')
})

it('fisarmonica nella sezione: col-span come prima', () => {
  const html = renderToStaticMarkup(h(List as any, { blok: { component: 'list', _uid: 'l', items, size: '1/2' } }))
  expect(html).toContain('sm:col-span-6')
})

it('video nel Wrapper: larghezza calcolata dalla Larghezza', async () => {
  const { default: Video } = await import('@components/video')
  const blok = { component: 'video', _uid: 'v', source: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', width: ['1/2', '1/3'] }
  const inWrapper = renderToStaticMarkup(h(Video as any, { blok, parent: 'wrapper' }))
  expect(inWrapper).toContain('sm:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]')
  expect(inWrapper).toContain('md:w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]')
  expect(renderToStaticMarkup(h(Video as any, { blok }))).toContain('sm:col-span-6')
})
