import { describe, expect, it } from 'vitest'
import { textStyle } from '@components/ui/text-styles'

describe('Text block size combinations', () => {
  it('has no combination when the field is empty or unknown', () => {
    expect(textStyle(undefined)).toBeUndefined()
    expect(textStyle('')).toBeUndefined()
    expect(textStyle('huge')).toBeUndefined()
  })

  it('sets title and description size together', () => {
    expect(textStyle('highlight')).toEqual({ title: 'type-display', description: 'large' })
    expect(textStyle('standard')).toEqual({ title: 'type-title-2' })
    expect(textStyle('section')).toEqual({ title: 'type-title-3' })
    expect(textStyle('compact')).toEqual({ title: 'type-title-4', description: 'small' })
  })
})
