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
