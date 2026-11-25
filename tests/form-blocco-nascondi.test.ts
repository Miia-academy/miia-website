import { it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { mergeForm } from '@components/form'
import { HideMobile } from '@components/hide-mobile'

const alias = { content: { component: 'form', _uid: 'a', label: 'Scarica la brochure', title: 'Brochure', tracking: 'brochure', list: ['16'], fields: [] }, uuid: 'x', name: 'Brochure', slug: 'b', full_slug: 'b' }

it('modulo con alias: vince quello che è scritto nel blocco', () => {
  const form = mergeForm({ component: 'form', _uid: 'f', alias, label: 'Richiedi la brochure', title: '', list: ['32'] } as any)
  expect(form.label).toBe('Richiedi la brochure')
  expect(form.title).toBe('Brochure')
  expect(form.tracking).toBe('brochure')
  expect(form.list).toEqual(['32', '16'])
})

it('Nascondi da mobile: nascosto sotto i 480px, colonne invariate', () => {
  const hidden = renderToStaticMarkup(h(HideMobile as any, { blok: { hide_mobile: true } }, h('p', null, 'x')))
  expect(hidden).toBe('<div class="contents max-sm:hidden"><p>x</p></div>')
  expect(renderToStaticMarkup(h(HideMobile as any, { blok: {} }, h('p', null, 'x')))).toBe('<p>x</p>')
})
