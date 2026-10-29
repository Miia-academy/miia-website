import { describe, expect, it } from 'vitest'
import { fittingCount } from '@components/cards/tagRow'

describe('card tags on one line', () => {
  it('all of them when they fit', () => {
    expect(fittingCount([60, 80], 200, 30)).toBe(2)
    expect(fittingCount([], 200, 30)).toBe(0)
  })

  it('leaves room for the "+N" pill', () => {
    // 60 + 8 + 80 = 148; with the third left out it needs 148 + 8 + 30 = 186
    expect(fittingCount([60, 80, 100], 180, 30)).toBe(1)
    expect(fittingCount([60, 80, 100], 190, 30)).toBe(2)
  })

  it('only "+N" when not even the first fits', () => {
    expect(fittingCount([300, 40], 200, 30)).toBe(0)
  })
})
