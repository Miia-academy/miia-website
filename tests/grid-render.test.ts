import { it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToString } from 'react-dom/server'
import Grid from '@components/grid'
import { DataProvider } from '@modules/context'
const a = (uuid: string, extra: any) => ({ uuid, title: 'T'+uuid, fullSlug: '/x/'+uuid, createdAt: '2025-01-0'+uuid, tagList: [], ...extra })
const data: any = { courses: [], events: [], locations: [], persons: [], projects: [], competenze: [{name:'x',value:'x'}],
  articles: [a('1',{category:'moda', hidden:true, tagList:['storia'], author:{uuid:'p1',name:'Anna'}}), a('2',{category:'interior-design', tagList:['interni-primo-livello'], author:{uuid:'p2',name:'Bruno'}}), a('3',{})] }
const render = (blok: any) => renderToString(h(DataProvider, { data, children: h(Grid, { blok: { component: 'grid', _uid: 'u', resource: 'articles', title: '{{total}} articoli', ...blok } }) }))
it('default as today, then hidden, tags and interactive filters', () => {
  const def = render({})
  expect(def).toContain('2 articoli'); expect(def).not.toContain('Filtra')
  const all = render({ visibility: 'all', controls: ['tags', 'categories', 'authors'] })
  expect(all).toContain('3 articoli'); expect(all).toContain('Interni primo livello'); expect(all).toContain('Tutti gli autori'); expect(all).toContain('Tutte le categorie'); expect(all).toContain('Interior design')
  expect(render({ visibility: 'hidden' })).toContain('1 articoli')
  expect(render({ filter: 'storia, interni-primo-livello', visibility: 'all' })).toContain('2 articoli')
})
it('progetti: su mobile solo i primi 3, poi "Carica altri"', () => {
  const p = (i: number) => ({ uuid: 'pr' + i, slug: 'pr' + i, fullSlug: '/progetti/pr' + i, title: 'Progetto ' + i, tagList: [], firstPublishedAt: `2026-01-${10 + i}` })
  const renderProjects = (n: number) =>
    renderToString(h(DataProvider, { data: { ...data, projects: Array.from({ length: n }, (_, i) => p(i)) }, children: h(Grid, { blok: { component: 'grid', _uid: 'g', resource: 'projects', limit: '6' } }) }))
  const six = renderProjects(6)
  expect(six).toContain('max-md:[&amp;&gt;*:nth-child(n+4)]:hidden')
  expect(six).toContain('Carica altri')
  expect(six).toMatch(/md:hidden[^"]*">.*?3<\/span>/)
  // Progetti più recenti per primi (data di prima pubblicazione)
  expect(six.indexOf('Progetto 5')).toBeLessThan(six.indexOf('Progetto 0'))
  const three = renderProjects(3)
  expect(three).not.toContain('nth-child(n+4)')
  expect(three).not.toContain('Carica altri')
})
