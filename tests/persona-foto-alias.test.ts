import { describe, expect, it } from 'vitest'
import { isEmpty } from '../components/person'

describe('Persona: foto presa dall\'alias', () => {
  it('un\'immagine vuota senza filename conta come vuota', () => {
    expect(isEmpty({ fieldtype: 'asset', meta_data: {} })).toBe(true)
    expect(isEmpty({ fieldtype: 'asset', filename: '' })).toBe(true)
    expect(isEmpty({ fieldtype: 'asset', filename: null })).toBe(true)
  })
  it('un\'immagine con filename non è vuota', () => {
    expect(isEmpty({ fieldtype: 'asset', filename: 'https://a.storyblok.com/f/1/a.jpg' })).toBe(false)
  })
  it('testo e liste come prima', () => {
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('Beatrice')).toBe(false)
    expect(isEmpty([])).toBe(true)
  })
})
