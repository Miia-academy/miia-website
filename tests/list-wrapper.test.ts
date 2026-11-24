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
