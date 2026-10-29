import { describe, expect, it } from 'vitest'
import {
  articleAuthor,
  authorOptions,
  byVisibility,
  categoryOptions,
  folderCategory,
  filterKeys,
  gridControls,
  tagLabel,
  tagOptions,
} from '@modules/grid'

const articles = [
  { uuid: 'a', hidden: true, tagList: ['storia', 'interni-primo-livello'] },
  { uuid: 'b', tagList: ['Storia'] },
  { uuid: 'c', hidden: false, tagList: [] },
]

describe('hidden articles', () => {
  it('without a choice only the visible ones, as today', () => {
    expect(byVisibility(articles, '').map((a) => a.uuid)).toEqual(['b', 'c'])
    expect(byVisibility(articles, undefined).map((a) => a.uuid)).toEqual(['b', 'c'])
  })

  it('only the hidden ones, or all', () => {
    expect(byVisibility(articles, 'hidden').map((a) => a.uuid)).toEqual(['a'])
    expect(byVisibility(articles, 'all').map((a) => a.uuid)).toEqual(['a', 'b', 'c'])
  })

  it('always a new array, so sorting it does not touch the site data', () => {
    expect(byVisibility(articles, 'all')).not.toBe(articles)
  })
})

describe('filter field', () => {
  it('one or more tags separated by commas', () => {
    expect(filterKeys(' Storia , scopo-lavoro,, ')).toEqual(['storia', 'scopo-lavoro'])
    expect(filterKeys('')).toEqual([])
    expect(filterKeys(undefined)).toEqual([])
  })
})

describe('interactive filters', () => {
  it('tags without duplicates (ignoring case), in order of label', () => {
    expect(tagOptions(articles)).toEqual(['interni-primo-livello', 'storia'])
  })

  it('readable tag labels', () => {
    expect(tagLabel('interni-primo-livello')).toBe('Interni primo livello')
    expect(tagLabel('Storia')).toBe('Storia')
  })

  it('authors without duplicates, in alphabetical order', () => {
    const items = [
      { author: { uuid: '2', name: 'Zoe Verdi' } },
      { author: { uuid: '1', name: 'Anna Rossi' } },
      { author: { uuid: '2', name: 'Zoe Verdi' } },
      {},
    ]
    expect(authorOptions(items)).toEqual([
      { uuid: '1', name: 'Anna Rossi' },
      { uuid: '2', name: 'Zoe Verdi' },
    ])
  })

  it('categories without duplicates, in order of label', () => {
    expect(categoryOptions([{ category: 'moda' }, { category: 'interior-design' }, { category: 'Moda' }, {}])).toEqual([
      'interior-design',
      'moda',
    ])
  })

  it('category from the folder of the article', () => {
    expect(folderCategory('blog/moda/sfilata-2025')).toBe('moda')
    expect(folderCategory('/blog/interior-design/focus-cucina/')).toBe('interior-design')
    expect(folderCategory('articolo')).toBeUndefined()
    expect(folderCategory(undefined)).toBeUndefined()
  })

  it('only the known controls', () => {
    expect(gridControls(['tags', 'categories', 'authors', 'other', ''])).toEqual(['tags', 'categories', 'authors'])
    expect(gridControls('tags')).toEqual(['tags'])
    expect(gridControls(undefined)).toEqual([])
  })
})

describe('article author', () => {
  const persons = [{ uuid: 'p1', name: 'Anna Rossi' }]

  it('from the resolved relation', () => {
    expect(articleAuthor({ uuid: 'p2', name: 'zoe', content: { title: 'Zoe Verdi' } }, persons)).toEqual({
      uuid: 'p2',
      name: 'Zoe Verdi',
    })
  })

  it('from the uuid, looking among the persons', () => {
    expect(articleAuthor('p1', persons)).toEqual({ uuid: 'p1', name: 'Anna Rossi' })
    expect(articleAuthor('unknown', persons)).toBeUndefined()
    expect(articleAuthor('', persons)).toBeUndefined()
  })
})
