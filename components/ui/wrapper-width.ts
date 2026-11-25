/**
 * Width of a child inside a Wrapper.
 *
 * The Wrapper is a flex container, so the 12-column `col-span-*` classes the
 * children use in a Section grid do nothing there. The width is computed from
 * the same twelfths, adding the gap back:
 *   (100% + gap) * N / 12 - gap
 * so 1/2 + 1/2 (or 1/3 + 2/3, ...) fill the row exactly, whatever the gap is.
 * The gap is the CSS variable --gap, set by the Wrapper for each breakpoint.
 * Below sm the child is full width, as in the grid.
 */
export type WidthFraction = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1'

type WidthClasses = Record<WidthFraction, string>

const sm: WidthClasses = {
  '1/4': 'sm:w-[calc((100%_+_var(--gap))_*_3_/_12_-_var(--gap))]',
  '1/3': 'sm:w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]',
  '1/2': 'sm:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]',
  '2/3': 'sm:w-[calc((100%_+_var(--gap))_*_8_/_12_-_var(--gap))]',
  '3/4': 'sm:w-[calc((100%_+_var(--gap))_*_9_/_12_-_var(--gap))]',
  '1/1': 'sm:w-full',
}

const md: WidthClasses = {
  '1/4': 'md:w-[calc((100%_+_var(--gap))_*_3_/_12_-_var(--gap))]',
  '1/3': 'md:w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]',
  '1/2': 'md:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]',
  '2/3': 'md:w-[calc((100%_+_var(--gap))_*_8_/_12_-_var(--gap))]',
  '3/4': 'md:w-[calc((100%_+_var(--gap))_*_9_/_12_-_var(--gap))]',
  '1/1': 'md:w-full',
}

const lg: WidthClasses = {
  '1/4': 'lg:w-[calc((100%_+_var(--gap))_*_3_/_12_-_var(--gap))]',
  '1/3': 'lg:w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]',
  '1/2': 'lg:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]',
  '2/3': 'lg:w-[calc((100%_+_var(--gap))_*_8_/_12_-_var(--gap))]',
  '3/4': 'lg:w-[calc((100%_+_var(--gap))_*_9_/_12_-_var(--gap))]',
  '1/1': 'lg:w-full',
}

const xl: WidthClasses = {
  '1/4': 'xl:w-[calc((100%_+_var(--gap))_*_3_/_12_-_var(--gap))]',
  '1/3': 'xl:w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]',
  '1/2': 'xl:w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]',
  '2/3': 'xl:w-[calc((100%_+_var(--gap))_*_8_/_12_-_var(--gap))]',
  '3/4': 'xl:w-[calc((100%_+_var(--gap))_*_9_/_12_-_var(--gap))]',
  '1/1': 'xl:w-full',
}

const base: WidthClasses = {
  '1/4': 'w-[calc((100%_+_var(--gap))_*_3_/_12_-_var(--gap))]',
  '1/3': 'w-[calc((100%_+_var(--gap))_*_4_/_12_-_var(--gap))]',
  '1/2': 'w-[calc((100%_+_var(--gap))_*_6_/_12_-_var(--gap))]',
  '2/3': 'w-[calc((100%_+_var(--gap))_*_8_/_12_-_var(--gap))]',
  '3/4': 'w-[calc((100%_+_var(--gap))_*_9_/_12_-_var(--gap))]',
  '1/1': 'w-full',
}

/**
 * Larghezza di un blocco per dispositivo. base = da mobile in su (sotto sm),
 * poi sm (480px), md (768px, tablet), lg (1024px, desktop), xl (1280px, schermo grande).
 * Un valore mancante eredita quello del dispositivo più piccolo; senza nessuno, tutta larghezza.
 */
export type Widths = { base?: WidthFraction; sm?: WidthFraction; md?: WidthFraction; lg?: WidthFraction; xl?: WidthFraction }

const FRACTIONS = new Set<string>(['1/4', '1/3', '1/2', '2/3', '3/4', '1/1'])
const fraction = (value: unknown): WidthFraction | undefined =>
  typeof value === 'string' && FRACTIONS.has(value) ? (value as WidthFraction) : undefined

type WidthFields = {
  width?: unknown
  width_mobile?: unknown
  width_tablet?: unknown
  width_desktop?: unknown
  width_wide?: unknown
}

/**
 * Larghezze del blocco dai campi di Storyblok. I campi per dispositivo (Larghezza mobile,
 * tablet, desktop, schermo grande) vincono; se sono tutti vuoti vale il vecchio campo
 * "Larghezza", la scelta multipla in cui l'ordine è [sm, md, lg, xl].
 */
export function blokWidths(blok: WidthFields): Widths {
  const byDevice: Widths = {
    base: fraction(blok.width_mobile),
    md: fraction(blok.width_tablet),
    lg: fraction(blok.width_desktop),
    xl: fraction(blok.width_wide),
  }
  if (byDevice.base || byDevice.md || byDevice.lg || byDevice.xl) return byDevice
  const legacy = Array.isArray(blok.width) ? blok.width : []
  return { sm: fraction(legacy[0]), md: fraction(legacy[1]), lg: fraction(legacy[2]), xl: fraction(legacy[3]) }
}

/** Le larghezze come lista [sm, md, lg, xl], per il codice che legge il vecchio campo. */
export function widthList(widths: Widths): Array<WidthFraction | undefined> {
  return [widths.sm ?? widths.base, widths.md, widths.lg, widths.xl]
}

const gridBase: WidthClasses = {
  '1/4': 'col-span-3',
  '1/3': 'col-span-4',
  '1/2': 'col-span-6',
  '2/3': 'col-span-8',
  '3/4': 'col-span-9',
  '1/1': 'col-span-12',
}

/** Colonne della griglia della sezione su mobile (sotto sm); sm e oltre restano alle varianti dei blocchi. */
export function gridBaseClass(widths: Widths): string | undefined {
  return widths.base ? gridBase[widths.base] : undefined
}

const byBreakpoint: Array<[keyof Widths, WidthClasses]> = [
  ['base', base],
  ['sm', sm],
  ['md', md],
  ['lg', lg],
  ['xl', xl],
]

// Classes for a Wrapper child, from the widths per device (or the old list [sm, md, lg, xl])
export function wrapperWidthClasses(widths?: Widths | Array<string | undefined>): string {
  const w: Widths = Array.isArray(widths)
    ? { sm: fraction(widths[0]), md: fraction(widths[1]), lg: fraction(widths[2]), xl: fraction(widths[3]) }
    : widths || {}
  const classes = byBreakpoint.map(([key, table]) => (w[key] ? table[w[key] as WidthFraction] : ''))
  return ['w-full flex-none', ...classes].filter(Boolean).join(' ')
}
