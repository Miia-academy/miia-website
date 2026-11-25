import { it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Image from '@components/image'

const logo = { filename: 'https://a.storyblok.com/f/311109/512x512/abc/logo.png', alt: 'logo' }
const render = (blok: Record<string, unknown>, parent?: string) =>
  renderToStaticMarkup(h(Image as any, { blok: { component: 'image', _uid: 'i', image: logo, ...blok }, parent }))

it('Dimensione nella sezione senza larghezza: colonna da un quarto, immagine centrata', () => {
  const html = render({ size: 'lg', aspect: '1/1' }, 'section')
  expect(html).toContain('sm:col-span-3')
  expect(html).toContain('justify-center')
  expect(html).toContain('max-w-64')
  expect(html).toContain('h-auto')
})

it('Dimensione nella sezione con larghezza: vale la larghezza scelta', () => {
  const html = render({ size: 'md', width: ['1/3'] }, 'section')
  expect(html).toContain('sm:col-span-4')
  expect(html).not.toContain('sm:col-span-3')
})

it('Molto grande: fino a 384px', () => {
  expect(render({ size: 'xl' }, 'section')).toContain('max-w-96')
})

it('Dimensione nel Contenitore: come prima, senza colonna', () => {
  const html = render({ size: 'sm' }, 'wrapper')
  expect(html).toContain('max-w-32')
  expect(html).not.toContain('sm:col-span-3')
  expect(html).not.toContain('justify-center')
})

it('Mostra intera: niente ritaglio', () => {
  expect(render({ contain: true, width: ['1/4'] }, 'section')).toContain('object-contain')
  expect(render({ width: ['1/4'] }, 'section')).not.toContain('object-contain')
})
