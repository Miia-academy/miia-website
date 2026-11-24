import { describe, expect, it } from 'vitest'
import { isLogo } from '@components/ui/logo-strip'

const img = (filename: string) => ({ component: 'image', image: { filename } })

describe('isLogo', () => {
  it('riconosce le immagini piccole come loghi', () => {
    expect(isLogo(img('https://a.storyblok.com/f/311109/256x256/1d107efba2/franzin.png'))).toBe(true)
  })
  it('esclude le foto grandi', () => {
    expect(isLogo(img('https://a.storyblok.com/f/311109/2540x1695/2355b2c10e/tavolo.jpg'))).toBe(false)
  })
  it('esclude slide che non sono immagini', () => {
    expect(isLogo({ component: 'section' })).toBe(false)
    expect(isLogo({ component: 'image', image: { filename: '' } })).toBe(false)
  })
})
