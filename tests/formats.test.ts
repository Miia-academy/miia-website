import { describe, expect, it } from 'vitest'
import { parentPath } from '@modules/formats'

describe('folder page of a story', () => {
  it('the folder the article is in', () => {
    expect(parentPath('blog/interior-design/focus-cucina')).toBe('/blog/interior-design')
    expect(parentPath('/corsi/interior-design/storie/cambiare-lavoro/')).toBe('/corsi/interior-design/storie')
  })

  it('the home for a story at the top level', () => {
    expect(parentPath('chi-siamo')).toBe('/')
    expect(parentPath('')).toBe('/')
  })
})
