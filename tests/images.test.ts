import { describe, expect, it } from 'vitest'
import { gridSizes, responsiveImage, storyblokImageUrl } from '@modules/images'

const photo = 'https://a.storyblok.com/f/311109/1920x1081/89c123c0de/cucina.jpg'
const small = 'https://a.storyblok.com/f/311109/600x400/abc/ritratto.png'

describe('Storyblok resized images', () => {
  it('asks the image service for the width shown', () => {
    expect(storyblokImageUrl(photo, 768)).toBe(`${photo}/m/768x0/filters:quality(70)`)
  })

  it('never asks for more than the original', () => {
    expect(storyblokImageUrl(small, 1440)).toBe(`${small}/m/600x0/filters:quality(70)`)
  })

  it('srcSet with one step per width, up to the original', () => {
    const image = responsiveImage(photo, '100vw')
    expect(image.srcSet?.split(', ').map((s) => s.split(' ')[1])).toEqual(['480w', '768w', '1024w', '1440w', '1920w'])
    expect(image.src).toBe(`${photo}/m/1024x0/filters:quality(70)`)
    expect(image.sizes).toBe('100vw')

    const portrait = responsiveImage(small, '320px', [320, 640])
    expect(portrait.srcSet).toBe(`${small}/m/320x0/filters:quality(70) 320w, ${small}/m/600x0/filters:quality(70) 600w`)
  })

  it('SVG, GIF and other sites stay as they are', () => {
    const svg = 'https://a.storyblok.com/f/311109/100x100/abc/logo.svg'
    expect(responsiveImage(svg, '100vw')).toEqual({ src: svg })
    expect(responsiveImage('https://example.com/a.jpg', '100vw')).toEqual({ src: 'https://example.com/a.jpg' })
    expect(responsiveImage(undefined, '100vw')).toEqual({ src: '' })
  })
})

describe('sizes in the grid', () => {
  it('from the Storyblok widths per breakpoint', () => {
    expect(gridSizes(['1/1', '1/2', '1/3', '1/3'])).toBe(
      '(min-width: 1280px) 428px, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, (min-width: 640px) 100vw, 100vw'
    )
  })

  it('full width when nothing is set', () => {
    expect(gridSizes(undefined)).toBe('100vw')
  })
})
