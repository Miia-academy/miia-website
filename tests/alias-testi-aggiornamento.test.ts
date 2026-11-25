// @vitest-environment jsdom
import { it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

vi.mock('@storyblok/react', () => ({ storyblokEditable: () => ({}), StoryblokComponent: () => h('button', null, 'Registrati') }))
vi.mock('@components/ui/image', () => ({ Image: () => null }))
import NextEvent from '@components/next-event'

const event: any = { uuid: 'e1', date: '2026-12-14 21:00', title: 'Titolo', description: 'DESCRIZIONE', docenti: [], prezzo_agevolato: true, page: { cached_url: 'open-day/interior-design/' } }
const blok = (n: number) => ({ component: 'alias', _uid: 'a', resource: 'next-event', versione: 'registrazione', agevolazione_testo: 'AGEVOLAZIONE ' + n, submit: [{ component: 'form', _uid: 'f' }] })

it("la descrizione resta una sola anche quando l'editor aggiorna il blocco", () => {
  const el = document.createElement('div')
  const root = createRoot(el)
  for (let n = 0; n < 4; n++) flushSync(() => root.render(h(NextEvent as any, { blok: blok(n), event, persons: [] })))
  expect(el.innerHTML.split('DESCRIZIONE').length - 1).toBe(1)
  expect(el.innerHTML.split('AGEVOLAZIONE').length - 1).toBe(1)
  root.unmount()
})
