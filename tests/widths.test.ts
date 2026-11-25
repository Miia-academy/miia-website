import { it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { blokWidths, gridBaseClass, widthList, wrapperWidthClasses } from '@components/ui/wrapper-width'
import Text from '@components/text'

it('campi per dispositivo: indipendenti, ripetibili, vuoto = eredita', () => {
  const w = blokWidths({ width_mobile: '1/2', width_desktop: '1/2', width: ['1/3'] })
  expect(w).toEqual({ base: '1/2', md: undefined, lg: '1/2', xl: undefined })
  expect(gridBaseClass(w)).toBe('col-span-6')
  expect(widthList(w)).toEqual(['1/2', undefined, '1/2', undefined])
  expect(wrapperWidthClasses(w)).toContain('w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]')
  expect(wrapperWidthClasses(w)).toContain('lg:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]')
})

it('senza campi nuovi vale il vecchio campo Larghezza [sm, md, lg, xl]', () => {
  const w = blokWidths({ width: ['1/1', '1/2', '1/3'] })
  expect(w).toEqual({ sm: '1/1', md: '1/2', lg: '1/3', xl: undefined })
  expect(gridBaseClass(w)).toBeUndefined()
  expect(blokWidths({})).toEqual({ sm: undefined, md: undefined, lg: undefined, xl: undefined })
})

it('Testo con Larghezza mobile 1/2: due colonne anche sul telefono', () => {
  const html = renderToStaticMarkup(h(Text as any, { blok: { component: 'text', _uid: 't', title: '18', description: 'competenze', width_mobile: '1/2', width_desktop: '1/4' } }))
  expect(html).toMatch(/class="[^"]*\bcol-span-6\b/)
  expect(html).not.toMatch(/class="[^"]*\bcol-span-12\b/)
  expect(html).toContain('lg:col-span-3')
})
