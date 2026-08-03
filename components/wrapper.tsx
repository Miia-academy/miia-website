import type { Wrapper as WrapperBlok } from '@types'
import { StoryblokComponent, storyblokEditable } from '@storyblok/react'
import { tv } from 'tailwind-variants'

// Tipizzazioni strette per Tailwind Variants
type OrderVariant = 'none' | '1' | '2' | '3' | '4' | '5' | '6'
type WidthVariant = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | '1/1' | undefined

interface WrapperComponentProps {
  blok: WrapperBlok
  theme?: 'dark' | 'light'
  parent?: string
}

export default function Wrapper({ blok, theme, parent }: WrapperComponentProps) {
  // 1. Protection Fallback: gestiamo array undefined dal CMS
  const rawContents = blok.contents || []

  // 2. Separiamo lo sfondo dagli altri elementi figli
  const background = rawContents.find(
    (content: any) => content.component === 'background'
  )
  const contents = rawContents.filter(
    (content: any) => content.component !== 'background'
  )

  const isCarouselChild = parent === 'carousel'
  const orderAttr: OrderVariant = blok.order
    ? (blok.order.toString() as OrderVariant)
    : 'none'

  // 3. Calcolo Type-Safe per il valore di Justify
  const justifyKey = `${blok.row ? 'justify' : 'items'}-${blok.justify || 'left'}`

  return (
    <div
      {...storyblokEditable(blok as any)}
      className={classes({
        order: orderAttr,
        smWidth: blok.width?.[0] as WidthVariant,
        mdWidth: blok.width?.[1] as WidthVariant,
        lgWidth: blok.width?.[2] as WidthVariant,
        xlWidth: blok.width?.[3] as WidthVariant,
        row: blok.row,
        justify: justifyKey as any,
        hasBackground: !!background,
        isCarouselChild,
      })}
    >
      {/* Renderizziamo SOLO i contenuti (escluso il componente background) */}
      {contents.map((content: any) => (
        <StoryblokComponent
          key={content._uid}
          blok={content}
          parent={blok.component}
          theme={theme}
        />
      ))}

      {/* Sfondo posizionato in overlay */}
      {!!background && (
        <>
          <div className={gradientClasses()} />
          <StoryblokComponent blok={background} />
        </>
      )}
    </div>
  )
}

const gradientClasses = tv({
  base: 'gradient absolute inset-0 bg-gradient-to-tr to-60% -z-10 from-dark mix-blend-multiply',
})

const classes = tv({
  base: 'col-span-12 flex flex-col flex-wrap gap-4 min-h-12 sm:order-none items-start',
  variants: {
    row: {
      true: 'flex-row sm:max-md:col-span-12',
    },
    hasBackground: {
      true: 'relative aspect-4/3 shadow-inner z-0 rounded-xl p-3 md:p-6 overflow-hidden justify-end [&_article]:flex-none [&_article]:backdrop-blur-sm [&_article]:rounded-3xl [&_article]:gap-1',
    },
    justify: {
      'items-right': 'sm:items-end',
      'items-center': 'sm:items-center',
      'items-left': 'sm:items-start',
      'justify-right': 'sm:justify-start',
      'justify-center': 'sm:justify-center',
      'justify-left': 'sm:justify-end',
    },
    order: {
      none: 'order-none',
      '1': '-order-1',
      '2': '-order-2',
      '3': '-order-3',
      '4': '-order-4',
      '5': '-order-5',
      '6': '-order-6',
    },
    smWidth: {
      '1/4': 'sm:col-span-3',
      '1/3': 'sm:col-span-4',
      '1/2': 'sm:col-span-6',
      '2/3': 'sm:col-span-8',
      '3/4': 'sm:col-span-9',
      '1/1': 'sm:col-span-12',
    },
    mdWidth: {
      '1/4': 'md:col-span-3',
      '1/3': 'md:col-span-4',
      '1/2': 'md:col-span-6',
      '2/3': 'md:col-span-8',
      '3/4': 'md:col-span-9',
      '1/1': 'md:col-span-12',
    },
    lgWidth: {
      '1/4': 'lg:col-span-3',
      '1/3': 'lg:col-span-4',
      '1/2': 'lg:col-span-6',
      '2/3': 'lg:col-span-8',
      '3/4': 'lg:col-span-9',
      '1/1': 'lg:col-span-12',
    },
    xlWidth: {
      '1/4': 'xl:col-span-3',
      '1/3': 'xl:col-span-4',
      '1/2': 'xl:col-span-6',
      '2/3': 'xl:col-span-8',
      '3/4': 'xl:col-span-9',
      '1/1': 'xl:col-span-12',
    },
    isCarouselChild: {
      true: 'w-full',
    },
  },
  compoundVariants: [
    {
      isCarouselChild: true,
      smWidth: '1/2',
      class: 'md:w-1/2',
    },
    {
      isCarouselChild: true,
      smWidth: '1/3',
      class: 'md:w-1/3',
    },
    {
      isCarouselChild: true,
      smWidth: '1/4',
      class: 'md:w-1/2',
    },
    {
      isCarouselChild: true,
      smWidth: '2/3',
      class: 'md:w-2/3',
    },
  ],
})