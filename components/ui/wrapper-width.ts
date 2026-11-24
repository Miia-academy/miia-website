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

const byBreakpoint: WidthClasses[] = [sm, md, lg, xl]

// Classes for a Wrapper child, from the Storyblok width per breakpoint [sm, md, lg, xl]
export function wrapperWidthClasses(widths?: Array<string | undefined>): string {
  const classes = byBreakpoint.map((table, i) => table[(widths?.[i] || '') as WidthFraction])
  return ['w-full flex-none', ...classes].filter(Boolean).join(' ')
}
